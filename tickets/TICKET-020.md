# TICKET-020: Fix mol_test_antwoorden upsert — DB-kolom heet mol_verdachte_id

**Status:** Ready for Build (kritisch — productiebug)
**Grootte:** S
**Aangemaakt door:** Architect
**Datum:** 2026-05-02

## Doel
De moltest-indiening landt weer in de database, zodat de per-groep
reveal-overgang (TICKET-018) daadwerkelijk kan triggeren in productie.

## Achtergrond — root cause

De Supabase-tabel `mol_test_antwoorden` heeft kolom `mol_verdachte_id`,
**niet** `verdachte_id`. Het endpoint `POST /api/mol/sessies/:id/test`
(`server.js:2110-2144`) probeert te schrijven naar `verdachte_id`, wat
in Postgres een fout geeft. Maar op regel 2114 wordt het `error`-veld
van de Supabase-response **niet gecheckt** — dus de upsert faalt stil
en het endpoint retourneert `{ok:true}` aan de client.

Het frontend ziet `{ok:true}`, denkt dat het gelukt is, springt naar
wachtscherm. Maar de DB blijft leeg → completion-check telt 0 rijen →
fase blijft `'test'` → polling levert oneindig
`{fase:'test', wacht_op:[alle leden]}` → speler hangt op
`screen-speler-wacht-test`.

**Diagnose op productie 2026-05-02 bevestigd via console:**

- STAP 1 (vóór indiening): `groep.fase='test'`, `wacht_op=[2 leden]`,
  `tests=0` — gezond.
- STAP 2 (direct na 2 indieningen): `groep.fase='test'` ongewijzigd,
  `tests=0`. Beide POSTs landden niet in DB ondanks `200 OK`.
- STAP 3 (10 sec later): identiek aan STAP 2 — permanent stuck.
- Tegentest: POST naar oud endpoint `/api/mol/test-antwoord` met body
  `{leerling_id, mol_verdachte_id}` → rij **wel** opgeslagen, met
  kolom `mol_verdachte_id` gevuld. Dit bewijst de DB-kolomnaam.

**Hoe dit door TICKET-018-review heen kwam:** mijn architectuurkeuze
"behoud beide veldnamen" baseerde op endpoint-code (`/api/mol/test-antwoord`
schreef `mol_verdachte_id`, het nieuwere `/api/mol/sessies/:id/test`
schreef `verdachte_id` — beide leken legitiem). Ik heb niet het
DB-schema verifieerd. De Builder-tests gebruiken JS-mocks (`makeChain`
op tabelniveau) die geen schema-validatie doen, dus de upsert "lukte"
in de tests terwijl hij in productie faalde. **Aanvullende les:**
ontbrekende `.error`-check verbergt deze klasse fouten — die fix is
onderdeel van dit ticket.

## Scope

### Wel
- `server.js:2113-2118` — DB-mapping fixen: schrijf
  `mol_verdachte_id: verdachte_id` (body-parameter blijft
  `verdachte_id`, alleen de DB-kolom wordt correct).
- `server.js:2114` — `.error`-check toevoegen op de upsert. Bij fout:
  status 500 + error-message.
- Nieuw testbestand `tests/mol-test-upsert-veld.test.js`:
  - bevestigt dat upsert wordt aangeroepen met object dat
    `mol_verdachte_id` bevat (niet `verdachte_id`).
  - bevestigt dat een upsert-error nu 500 + body retourneert.

### Niet
- **Geen** rename van body-parameter `verdachte_id`. Het frontend
  stuurt dat (`speler.js:1037`), bestaande tests asserten dat
  (`mol-test-scherm.test.js:72`, `mol-frontend-flow.test.js:42`).
  Alleen de DB-mapping wordt aangepast.
- **Geen** wijziging aan leesfallback `(t.verdachte_id ||
  t.mol_verdachte_id)` op regels 1614, 1650, 2152 en in `reveal.js`.
  Met onze fix is `t.verdachte_id` altijd `undefined` (kolom bestaat
  niet), dus de fallback gaat automatisch naar `t.mol_verdachte_id`.
  Geen regressie; opruim van overbodige fallback is een toekomstig
  cleanup-ticket.
- **Geen** wijziging aan `/api/mol/test-antwoord` (oud endpoint dat
  niet door speler-frontend wordt gebruikt).
- **Geen** frontend-wijziging.

### Cleanup achteraf (Martijn handmatig)
Verwijder de diagnose-rij die tijdens debug is aangemaakt:
```sql
DELETE FROM mol_test_antwoorden WHERE leerling_id LIKE '%_diag';
```
Via Supabase dashboard. Niet door builder.

## Acceptatiecriteria

1. [ ] **AC1 — schrijfkant gebruikt mol_verdachte_id:**
   Na `POST /api/mol/sessies/:sid/test` met body
   `{leerling_id:"L", verdachte_id:"X"}` wordt de Supabase-upsert
   aangeroepen met een object dat `mol_verdachte_id: "X"` bevat (en
   géén key `verdachte_id`). Testbaar via spy op de mocked
   `from('mol_test_antwoorden').upsert(...)`.

2. [ ] **AC2 — error-propagation:**
   Als de upsert een error retourneert, geeft het endpoint status
   `500` met body `{error: "<message>"}`. Niet meer `200/{ok:true}`
   bij stille fout.

3. [ ] **AC3 — happy path eindigt in reveal:**
   In een sessie met 2 leerlingen, beide doen
   `POST /api/mol/sessies/:sid/test`. Daarna:
   - DB: 2 rijen in `mol_test_antwoorden` met `mol_verdachte_id`
     gevuld.
   - DB: `mol_groepen.fase === 'reveal'` voor die groep.
   - DB: rijen in `mol_scores`.
   - API: `GET /groep-status?groep_id=X` retourneert
     `{fase:"reveal", wacht_op:[]}`.

4. [ ] **AC4 — bestaande tests groen:** alle bestaande suites
   blijven slagen, met name:
   - `tests/mol-groep-test-reveal.test.js` (TICKET-018)
   - `tests/mol-puntentelling-intern.test.js`
   - `tests/mol-test-scherm.test.js`
   - `tests/mol-frontend-flow.test.js`
   - `tests/mol-feedback-flow.test.js` (TICKET-019)

5. [ ] **AC5 — leesfallback ongewijzigd en correct:**
   `(t.verdachte_id || t.mol_verdachte_id)`-uitdrukkingen in
   `server.js:1614, 1650, 2152` blijven staan en geven correct het
   `mol_verdachte_id`-veld terug.

6. [ ] **AC6 — diff-omvang:**
   `git diff --stat main..HEAD` toont 1-2 bestanden (`server.js` +
   nieuwe testfile). Wijziging in `server.js` < 10 regels.

## Bestanden die geraakt worden

- `server.js`, regel **2110-2144**:
  - Upsert-object: `verdachte_id,` →
    `mol_verdachte_id: verdachte_id,` (één regel).
  - `await supabase.from(...).upsert([...])` → vangen in
    `const { error: insertErr } = await ...` + `if (insertErr)
    return res.status(500).json({ error: insertErr.message });`
- `tests/mol-test-upsert-veld.test.js` (nieuw, ~80 regels).

## Tests

### Bestaande tests die groen moeten blijven
- Alle hierboven onder AC4 genoemde suites.
- `npm run lint:html`.

### Nieuwe tests in `tests/mol-test-upsert-veld.test.js`

Skelet, patroon van `tests/mol-groep-test-reveal.test.js`:

```javascript
/**
 * TICKET-020 — POST /sessies/:id/test mapt body verdachte_id
 * naar DB-kolom mol_verdachte_id en propageert errors.
 */

let upsertCallArgs = null;
let upsertResult   = { error: null };

const upsertSpy = jest.fn((rows) => {
  upsertCallArgs = rows;
  return {
    then: (r) => Promise.resolve(upsertResult).then(r),
  };
});

const leerlingenSelect = jest.fn(() => ({
  eq: jest.fn(() => ({
    single: () => Promise.resolve({ data: { groep_id: 'gid1' }, error: null }),
    eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
  })),
}));

const groepenSelect = jest.fn(() => ({
  eq: jest.fn(() => ({
    single: () => Promise.resolve({ data: { fase: 'test' }, error: null }),
  })),
  update: jest.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
}));

const testAntwSelect = jest.fn(() => ({
  eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
}));

const mockFrom = jest.fn((table) => {
  if (table === 'mol_test_antwoorden') {
    return { upsert: upsertSpy, select: testAntwSelect };
  }
  if (table === 'mol_leerlingen') return { select: leerlingenSelect };
  if (table === 'mol_groepen')    return { select: groepenSelect, update: groepenSelect.update };
  // andere tabellen voor berekenScoresIntern: return lege chains
  return {
    select: () => ({ eq: () => Promise.resolve({ data: [], error: null }),
                     single: () => Promise.resolve({ data: null, error: null }) }),
    upsert: () => Promise.resolve({ error: null }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
  };
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

const request = require('supertest');
const app     = require('../server');

describe('TICKET-020 — POST /sessies/:id/test', () => {
  beforeEach(() => {
    upsertCallArgs = null;
    upsertResult   = { error: null };
    jest.clearAllMocks();
  });

  it('AC1: upsert ontvangt mol_verdachte_id (niet verdachte_id)', async () => {
    const res = await request(app)
      .post('/api/mol/sessies/sid1/test')
      .send({ leerling_id: 'lid1', verdachte_id: 'lid_mol' });
    expect(res.status).toBe(200);
    expect(upsertCallArgs).toBeDefined();
    expect(upsertCallArgs[0]).toHaveProperty('mol_verdachte_id', 'lid_mol');
    expect(upsertCallArgs[0]).not.toHaveProperty('verdachte_id');
  });

  it('AC2: upsert error -> 500 met message', async () => {
    upsertResult = { error: { message: 'column "verdachte_id" does not exist' } };
    const res = await request(app)
      .post('/api/mol/sessies/sid1/test')
      .send({ leerling_id: 'lid1', verdachte_id: 'lid_mol' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/column/);
  });
});
```

**Builder-let-op:** de mock-structuur hierboven is een suggestie.
Pas aan op het bestaande `makeChain`-patroon uit
`tests/mol-groep-test-reveal.test.js` als dat schoner past. Het
kernpunt is: een spy die de upsert-arguments vasthoudt + een setbare
`upsertResult.error`.

### Edge cases die in bovenstaande tests gedekt worden
- Kolomnaam-conflict — exact het scenario dat in productie crashte.
- Stille fout opvangen — voorkomt regressie van dit type bug.

## Mockup
N/A — pure backend.

## Technische notities

### Wat exact wijzigen — server.js regel 2113-2118

**Vóór:**
```js
app.post('/api/mol/sessies/:id/test', async (req, res) => {
  try {
    const sid = req.params.id;
    const { leerling_id, verdachte_id } = req.body;
    await supabase.from('mol_test_antwoorden').upsert([{
      id: `test_${sid}_${leerling_id}`,
      sessie_id: sid, leerling_id,
      verdachte_id, submitted_at: Date.now(),
    }]);
    // Per-groep completion-check ...
```

**Na:**
```js
app.post('/api/mol/sessies/:id/test', async (req, res) => {
  try {
    const sid = req.params.id;
    const { leerling_id, verdachte_id } = req.body;
    const { error: insertErr } = await supabase
      .from('mol_test_antwoorden').upsert([{
        id: `test_${sid}_${leerling_id}`,
        sessie_id: sid, leerling_id,
        mol_verdachte_id: verdachte_id,
        submitted_at: Date.now(),
      }]);
    if (insertErr) return res.status(500).json({ error: insertErr.message });
    // Per-groep completion-check ...
```

Twee netto-wijzigingen, geen regel weg, ~5 regels gewijzigd. De rest
van het endpoint (completion-check, fase-update) ongewijzigd.

### Waarom geen rename van body-parameter

Het frontend stuurt `verdachte_id` (`speler.js:1037`). Bestaande
tests asserten dat (`mol-test-scherm.test.js:72`,
`mol-frontend-flow.test.js:42`). Renamen zou:
- `speler.js` aanpassen (raakt emoji-tooling-restrictie),
- twee testfiles aanpassen,
- mogelijk andere onbekende callers raken.

Mapping van body→DB houdt blast radius minimaal.

### Waarom de leesfallback laten staan

`(t.verdachte_id || t.mol_verdachte_id)` op `server.js:1614, 1650,
2152` en `reveal.js:8, 26, 215` is met onze fix een no-op die altijd
de tweede operand pakt (`t.verdachte_id` is `undefined` want de
kolom bestaat niet). Geen regressie. Opruimen kost extra wijzigingen
buiten scope; doe in cleanup-ticket.

### Waarom alleen `.error`-check op upsert (niet andere queries)

Andere queries in dit endpoint (de `select`-calls) vallen al buiten
de upsert. Hun ontbrekende error-check is een algemener patroon dat
overal in `server.js` voorkomt. Buiten scope; één bug, één fix.

## Verificatie door Reviewer

### Setup
Volg `WORKFLOW.md` § Preamble Reviewer Deel 2. Maak een sessie met
**2 leerlingen × 1 groep × 1 ronde**, doorloop tot
`mol_groepen.fase = 'test'`. `$SESSIE_ID`, `$GROEP_A`, `$LID_1`,
`$LID_MOL`, `$RAILWAY` (test-URL) bekend.

Maak de tabel leeg vóór de test:
```sql
DELETE FROM mol_test_antwoorden WHERE sessie_id = '$SESSIE_ID';
```

### AC1 + AC3 — happy path eindigt in reveal

```bash
curl -X POST $RAILWAY/api/mol/sessies/$SESSIE_ID/test \
  -H "Content-Type: application/json" \
  -d "{\"leerling_id\":\"$LID_1\",\"verdachte_id\":\"$LID_MOL\"}"
# Verwacht: 200 OK, body {"ok":true}

curl -X POST $RAILWAY/api/mol/sessies/$SESSIE_ID/test \
  -H "Content-Type: application/json" \
  -d "{\"leerling_id\":\"$LID_MOL\",\"verdachte_id\":\"$LID_1\"}"
# Verwacht: 200 OK
```

DB-checks (Supabase dashboard of CLI):
```sql
SELECT leerling_id, mol_verdachte_id FROM mol_test_antwoorden WHERE sessie_id = '$SESSIE_ID';
-- Verwacht: 2 rijen, mol_verdachte_id-kolom gevuld

SELECT fase FROM mol_groepen WHERE id = '$GROEP_A';
-- Verwacht: 'reveal'

SELECT count(*) FROM mol_scores WHERE sessie_id = '$SESSIE_ID';
-- Verwacht: 2
```

API-check:
```bash
curl "$RAILWAY/api/mol/sessies/$SESSIE_ID/groep-status?groep_id=$GROEP_A"
# Verwacht: {"fase":"reveal","ronde_nr":1,"wacht_op":[]}
```

### AC2 — error-propagation

Forceer een DB-fout door een non-existing sessie of leerling:
```bash
curl -X POST $RAILWAY/api/mol/sessies/SESSIE_BOGUS/test \
  -H "Content-Type: application/json" \
  -d "{\"leerling_id\":\"BOGUS\",\"verdachte_id\":\"X\"}"
# Verwacht: 500, body {"error":"<DB-message>"}
```
(Of forceer een andere fout via FK-violation.)

### AC4 — npm test
```bash
npm test
```
**Verwacht:** alle suites groen incl. nieuwe `mol-test-upsert-veld`.

### AC6 — diff-omvang
```bash
git diff --stat main..HEAD
```
**Verwacht:** `server.js` + `tests/mol-test-upsert-veld.test.js`.

### Browser-verificatie (handmatig, einde flow)

Speler 1 en speler 2 doen moltest in de browser. **Verwacht:**
binnen 5 seconden springt het scherm voor beide spelers naar
`screen-speler-reveal` met Mol-naam en eindstand. De per-ronde
feedback-knop (TICKET-019) is zichtbaar.

### Cleanup
- `DELETE FROM mol_test_antwoorden WHERE leerling_id LIKE '%_diag';`
  (verwijder console-diag-rij uit eerdere debugging).
- Standaard env-restore.

## Architect self-check

- [x] **Klein genoeg?** Ja, S. ~5 regels server.js + ~80 regels test.
- [x] **Eén probleem?** Ja: DB-kolomnaam mismatch + ontbrekende
      error-check. De error-check is randvoorwaarde voor zichtbaarheid
      van toekomstige bugs van dit type.
- [x] **Acceptatiecriteria testbaar?** Ja: AC1+2 via mocks, AC3 via
      curl + DB-query, AC4 via npm test, AC6 via git diff.
- [x] **Mijn fout uit TICKET-018 erkend?** Ja, expliciet in de
      Achtergrond-sectie.
- [x] **Productiediagnose bevestigd?** Ja, drie console-stappen +
      tegentest met oud endpoint op 2026-05-02.

## Lessons learned (voor toekomstige tickets)

- **Schema-validatie**: bij elk endpoint dat naar Supabase schrijft,
  vóór architectuurkeuze het tabel-schema bevestigen via dashboard
  (kolomnamen) — niet alleen op endpoint-code afgaan. JS-mocks dekken
  dit niet af.
- **`.error`-check standaard**: in toekomstige tickets standaard
  vereisen dat elke `supabase.from(...).insert/upsert/update/delete`
  in een `{ error }`-destructuring staat met `if (error) return ...`.
  Een lint-regel of grep-check kan dit afdwingen.
- **Integratietest met test-DB**: één test per nieuw schrijf-endpoint
  die tegen `.env.test` (echte DB) draait, zou deze bug gevangen
  hebben. Voor nu: curl-stappen op het Reviewer-pad. Voor structureel
  beter: integratietest-suite in een vervolgticket.
