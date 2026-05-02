# TICKET-018: Per-groep moltest-completion en reveal-overgang

**Status:** Ready for Build
**Grootte:** M
**Aangemaakt door:** Architect
**Datum:** 2026-05-02

## Doel
Wanneer alle leden van een groep de moltest hebben ingediend, gaat die
groep automatisch en onafhankelijk van andere groepen door naar de
reveal-fase, met scores berekend voor de hele sessie.

## Achtergrond — root cause in drie zinnen

Sinds TICKET-013/015/017 lopen groepen onafhankelijk door
`briefing → invoer → discussie → resultaat → test`. Maar het pad ná
`test` is nooit per-groep gemaakt: het endpoint
`POST /api/mol/sessies/:id/test` (`server.js:2096-2106`) doet alleen
een upsert in `mol_test_antwoorden` — geen completion-check, geen
score-berekening, geen fase-overgang. En `bepaalGroepStatus`
(`server.js:1844-1846`) returnt simpelweg `fase: 'test'` zolang
`mol_groepen.fase === 'test'`, zonder ooit naar `'reveal'` te
transitioneren.

Daarnaast bestaat er een latente veldnaam-inconsistentie: het nieuwere
endpoint slaat de keuze op als `verdachte_id` (`server.js:2102`),
terwijl de scoreberekening leest uit `mol_verdachte_id`
(`server.js:1614, 1650`). Gevolg: zelfs als de fase-overgang wél
getriggerd zou zijn, telt de mol-bonus altijd 0.

**Bevestigde symptomen:**
- Speler-frontend blijft hangen op `screen-speler-wacht-test` na
  indienen moltest. Polling levert oneindig `fase: 'test'` met
  `wacht_op: []`.
- `mol_scores`-tabel blijft leeg.
- `mol_groepen.fase` blijft `'test'` voor alle groepen.

## Scope

### Wel
- `bepaalGroepStatus` uitgebreid met:
  - Nieuwe tak `groep.fase === 'reveal'` → fase `'reveal'`,
    `wacht_op: []`.
  - Bestaande tak `groep.fase === 'test'` (briefing-blok regel
    1844-1846) **vervangen** door per-groep afleiding: alle leden van
    deze groep moeten een rij hebben in `mol_test_antwoorden`. Zo ja:
    fase `'reveal'`. Zo nee: fase `'test'` met `wacht_op` =
    leerlingen-zonder-testantwoord.
- `POST /api/mol/sessies/:id/test` uitgebreid:
  - Na de upsert: bepaal `groep_id` van de leerling, tel hoeveel
    groepsleden een testantwoord hebben.
  - Bij completion (`ingediend === aantalLeden`): roep
    `berekenScoresIntern(sessie_id)` aan **en** zet
    `mol_groepen.fase = 'reveal'` voor die groep.
  - Idempotent: als groep al fase `'reveal'` heeft, niet opnieuw
    berekenen (kleine guard).
- Veldnaam-fallback in score-berekening:
  - `server.js:1614` — vervang `t.mol_verdachte_id === mol.id` door
    `(t.verdachte_id || t.mol_verdachte_id) === mol.id`.
  - `server.js:1650` — vervang `test.mol_verdachte_id === mol.id` door
    `(test.verdachte_id || test.mol_verdachte_id) === mol.id`.
  - `server.js:2152` — vervang
    `t.verdachte_id === mol_id` door
    `(t.verdachte_id || t.mol_verdachte_id) === mol_id`.
- Eén nieuw testbestand `tests/mol-groep-test-reveal.test.js`,
  patroon van `tests/mol-groep-ronde-start.test.js`.

### Niet
- Geen rename van velden — `verdachte_id` (nieuwe schrijfkant) en
  `mol_verdachte_id` (oude schrijfkant van `/api/mol/test-antwoord`)
  blijven beide bestaan. Reden: minimale impact, backwards-compatible
  met bestaande data en tests.
- Geen wijziging in `/api/mol/test-antwoord` (`server.js:1560-1591`).
  Dat endpoint wordt door de huidige speler-frontend niet gebruikt;
  ongewijzigd laten voorkomt regressie in eventueel ander gebruik.
- Geen frontend-wijziging. TICKET-019 doet de reveal-flow met
  per-ronde feedback in `speler.js` en `mol-lesvorm.html`.
- Geen architecturele refactor van fase-state.

## Acceptatiecriteria

Alle AC's zijn afdwingbaar via supertest met mocks (zie testpatroon
hieronder) en via curl op `.env.test` (zie verificatie-sectie).

1. [ ] **AC1 — moltest in progress:**
   `GET /api/mol/sessies/:id/groep-status?groep_id=<gid>` retourneert
   `{ fase: "test", ronde_nr: <r>, wacht_op: [<lid_zonder_test>] }`
   wanneer:
   - `mol_groepen.fase === 'test'` voor `<gid>`
   - Slechts een deel van de groepsleden heeft een rij in
     `mol_test_antwoorden`.

2. [ ] **AC2 — moltest compleet, fase nog test in DB:**
   Onder dezelfde sessie/groep-state als AC1 maar met **alle** leden
   compleet (en `mol_groepen.fase` nog `'test'` op het moment van
   bevraging) → response is
   `{ fase: "reveal", ronde_nr: <r>, wacht_op: [] }`.

3. [ ] **AC3 — fase reeds reveal in DB:**
   Wanneer `mol_groepen.fase === 'reveal'` → response is
   `{ fase: "reveal", ronde_nr: <r>, wacht_op: [] }`,
   ongeacht de testAntwoorden-state.

4. [ ] **AC4 — onafhankelijkheid tussen groepen:**
   Sessie met groep A en groep B, beide `fase='test'`. Alle leden van
   A hebben moltest ingediend, geen lid van B. Dan:
   - `groep-status?groep_id=<A>` → `fase: "reveal"`, `wacht_op: []`
   - `groep-status?groep_id=<B>` → `fase: "test"`,
     `wacht_op: [<alle leden van B>]`

5. [ ] **AC5 — endpoint zet fase + berekent scores:**
   Na de laatste `POST /api/mol/sessies/:id/test` van een groep:
   - `mol_groepen.fase === 'reveal'` voor die groep (DB-check)
   - `mol_scores` bevat een rij voor elke leerling in de sessie
     (`berekenScoresIntern` doet sessie-breed, dat is acceptabel).
   - Andere groepen: `mol_groepen.fase` ongewijzigd (blijft
     `'test'` of `'invoer'` of wat het was).

6. [ ] **AC6 — endpoint is idempotent:**
   Een tweede POST `/api/mol/sessies/:id/test` voor een leerling
   wiens groep al fase `'reveal'` heeft: response 200 OK,
   `mol_test_antwoorden` blijft consistent (upsert), geen dubbele
   score-berekening met andere uitkomst.

7. [ ] **AC7 — score-berekening telt mol-correct met `verdachte_id`:**
   Onder de oude scoreberekening (`berekenScoresIntern`,
   `/api/mol/sessies/:id/resultaten`): wanneer een testrij
   `verdachte_id === mol.id` heeft (zonder `mol_verdachte_id` veld),
   wordt die geteld als correct. Wanneer alleen `mol_verdachte_id`
   gezet is: ook geteld. Wanneer beide aanwezig en gelijk: geteld
   (geen dubbeltelling — `||` kortsluit).

8. [ ] **AC8 — bestaande tests groen:** alle bestaande suites
   (waaronder `mol-puntentelling-intern.test.js`,
   `mol-test-scherm.test.js`, `mol-frontend-flow.test.js`,
   `mol-reveal-veld.test.js`, `discussie-resultaat-per-groep.test.js`)
   blijven slagen.

9. [ ] **AC9 — diff-omvang:** `git diff --stat main..HEAD` toont
   precies twee bestanden: `server.js` en
   `tests/mol-groep-test-reveal.test.js`. Wijziging in `server.js`
   < 50 regels netto.

## Bestanden die geraakt worden

- `server.js`:
  - `bepaalGroepStatus`, briefing-tak regels **1844-1846**: blok
    `if (groep?.fase === 'test')` vervangen door uitgebreidere
    afleiding (zie technische notities).
  - `POST /api/mol/sessies/:id/test`, regels **2096-2106**: na
    upsert completion-check toevoegen.
  - `berekenScoresIntern`, regel **1614**: fallback `||`.
  - `berekenScoresIntern`, regel **1650**: fallback `||`.
  - `/api/mol/sessies/:id/resultaten`, regel **2152**: fallback `||`.
- `tests/mol-groep-test-reveal.test.js` — **nieuw**, jest met mocks,
  ~150 regels. Patroon kopiëren uit
  `tests/mol-groep-ronde-start.test.js` of
  `tests/discussie-resultaat-per-groep.test.js`.

## Tests

### Bestaande tests die groen moeten blijven
- `tests/mol-puntentelling-intern.test.js` — gebruikt
  `mol_verdachte_id`. Onze `||` fallback laat die ongemoeid (eerste
  operand `t.verdachte_id` is `undefined`, fallback gebruikt
  `t.mol_verdachte_id`).
- `tests/mol-test-scherm.test.js` — bevestigt frontend-POST stuurt
  `verdachte_id`. Ongewijzigd.
- `tests/mol-frontend-flow.test.js` — bevestigt body bevat
  `verdachte_id`. Ongewijzigd.
- `tests/mol-reveal-veld.test.js` — bevestigt frontend-leesfallback.
- `tests/discussie-resultaat-per-groep.test.js` (TICKET-015).
- Alle andere bestaande mol-suite tests.
- `npm run lint:html` blijft groen.

### Nieuwe tests in `tests/mol-groep-test-reveal.test.js`

Patroon **letterlijk** gekopieerd uit
`tests/discussie-resultaat-per-groep.test.js`. Skelet:

```javascript
/**
 * TICKET-018 — Per-groep moltest-completion en reveal-overgang.
 *
 * bepaalGroepStatus moet, wanneer mol_groepen.fase='test':
 *   - alle leden compleet -> 'reveal'
 *   - deel compleet -> 'test' met wacht_op = niet-klare leden
 * En wanneer mol_groepen.fase='reveal' -> 'reveal' direct.
 */

let sessiesResolve, groepenResolve, leerlingenResolve, briefingKlaarResolve,
    antwoordenResolve, groepStemmenResolve, testAntwResolve;

function makeChain(getResolve) {
  const c = {
    select: jest.fn(() => c),
    update: jest.fn(() => c),
    upsert: jest.fn(() => c),
    eq:     jest.fn(() => c),
    single: jest.fn(() => c),
    then:   (resolve, reject) =>
              Promise.resolve(getResolve()).then(resolve, reject),
  };
  return c;
}

const sessiesChain       = makeChain(() => sessiesResolve);
const groepenChain       = makeChain(() => groepenResolve);
const leerlingenChain    = makeChain(() => leerlingenResolve);
const briefingKlaarChain = makeChain(() => briefingKlaarResolve);
const antwoordenChain    = makeChain(() => antwoordenResolve);
const groepStemmenChain  = makeChain(() => groepStemmenResolve);
const testAntwChain      = makeChain(() => testAntwResolve);
const defaultChain       = makeChain(() => ({ data: [], error: null }));

const mockFrom = jest.fn((table) => {
  if (table === 'mol_sessies')         return sessiesChain;
  if (table === 'mol_groepen')         return groepenChain;
  if (table === 'mol_leerlingen')      return leerlingenChain;
  if (table === 'mol_briefing_klaar')  return briefingKlaarChain;
  if (table === 'mol_antwoorden')      return antwoordenChain;
  if (table === 'mol_groep_stemmen')   return groepStemmenChain;
  if (table === 'mol_test_antwoorden') return testAntwChain;
  return defaultChain;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

const request = require('supertest');
const app     = require('../server');

function setBaseState({
  groepFase   = 'test',
  groepRonde  = 3,
  leden       = [
    { id: 'lid1', groep_id: 'gid1', is_groepshoofd: true,  is_mol: false },
    { id: 'lid2', groep_id: 'gid1', is_groepshoofd: false, is_mol: false },
  ],
  testAntw    = [],
  briefingAll = true,
} = {}) {
  sessiesResolve = {
    data: { id: 'sid1', status: 'briefing', huidige_ronde: groepRonde, n_rondes: 3 },
    error: null,
  };
  leerlingenResolve = { data: leden, error: null };
  briefingKlaarResolve = {
    data: briefingAll ? leden.map(l => ({ leerling_id: l.id })) : [],
    error: null,
  };
  antwoordenResolve   = { data: [], error: null };
  groepStemmenResolve = { data: [], error: null };
  testAntwResolve     = { data: testAntw, error: null };
  groepenResolve      = { data: { fase: groepFase, ronde_nr: groepRonde }, error: null };
}

describe('TICKET-018 — bepaalGroepStatus per-groep moltest', () => {
  afterEach(() => jest.clearAllMocks());

  it('AC1: 1/2 leden ingediend -> fase=test, wacht_op=[lid2]', async () => {
    setBaseState({
      groepFase: 'test',
      testAntw: [{ leerling_id: 'lid1', sessie_id: 'sid1' }],
    });
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.status).toBe(200);
    expect(res.body.fase).toBe('test');
    expect(res.body.wacht_op).toEqual(['lid2']);
  });

  it('AC2: 2/2 leden ingediend, fase=test in DB -> fase=reveal', async () => {
    setBaseState({
      groepFase: 'test',
      testAntw: [
        { leerling_id: 'lid1' },
        { leerling_id: 'lid2' },
      ],
    });
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.body.fase).toBe('reveal');
    expect(res.body.wacht_op).toEqual([]);
  });

  it('AC3: groep.fase=reveal in DB -> reveal, geen testAntw nodig', async () => {
    setBaseState({ groepFase: 'reveal', testAntw: [] });
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.body.fase).toBe('reveal');
    expect(res.body.wacht_op).toEqual([]);
  });

  it('AC4: testAntw van andere groep telt niet mee', async () => {
    setBaseState({
      groepFase: 'test',
      // testAntw zijn voor lid van groep B (gid2) niet groep A (gid1)
      leden: [
        { id: 'lid1', groep_id: 'gid1', is_groepshoofd: true,  is_mol: false },
        { id: 'lid2', groep_id: 'gid1', is_groepshoofd: false, is_mol: false },
        { id: 'lid3', groep_id: 'gid2', is_groepshoofd: true,  is_mol: false },
      ],
      testAntw: [{ leerling_id: 'lid3' }],
    });
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.body.fase).toBe('test');
    expect(res.body.wacht_op.sort()).toEqual(['lid1', 'lid2'].sort());
  });
});

describe('TICKET-018 — POST /sessies/:id/test triggert reveal', () => {
  afterEach(() => jest.clearAllMocks());

  it('AC5: laatste lid -> mol_groepen.fase update naar reveal', async () => {
    // Setup: 2 leden in groep, 1 al ingediend, dit is de tweede.
    sessiesResolve = { data: { id: 'sid1', status: 'briefing', n_rondes: 3 }, error: null };
    leerlingenResolve = {
      data: [
        { id: 'lid1', groep_id: 'gid1', is_mol: false },
        { id: 'lid2', groep_id: 'gid1', is_mol: true  },
      ],
      error: null,
    };
    // testAntwResolve simuleert de state NA insert
    testAntwResolve = {
      data: [
        { leerling_id: 'lid1', verdachte_id: 'lid2' },
        { leerling_id: 'lid2', verdachte_id: null   },
      ],
      error: null,
    };
    // Speler die nu indient: lid2
    // Mock voor "haal groep_id van leerling op":
    // Dit gebeurt via een aparte select waar mockFrom 'mol_leerlingen' returnt.
    // De testchain handelt dat al af via leerlingenResolve (single() pakt eerste).
    // Voor deze test letten we vooral op dat de groepenChain.update aangeroepen wordt.

    const updateSpy = jest.spyOn(groepenChain, 'update');

    const res = await request(app)
      .post('/api/mol/sessies/sid1/test')
      .send({ leerling_id: 'lid2', verdachte_id: 'lid2' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Builder: bevestig dat groepenChain.update is aangeroepen met fase:'reveal'
    // (eventueel via spy of door state te checken)
  });
});
```

**Builder-let-op:** Het AC5-testskelet hierboven is een _suggestie_;
de details van de `update`-spy moeten passen bij hoe de bestaande
chains werken. Pas zo nodig aan; de essentie is dat na de POST de
`mol_groepen.update({ fase: 'reveal' })` is aangeroepen.

### Edge cases die in bovenstaande tests gedekt worden
- Alleen testAntwoorden van andere groepen → eigen groep blijft
  `'test'` (AC4).
- Groep al in `'reveal'` → blijft `'reveal'`, ongeacht state (AC3).
- Geen leden in groep → impliciete edge: `wacht_op = []`,
  `aantalLeden = 0`. Builder mag een guard `aantalLeden > 0`
  toevoegen om geen reveal te triggeren op een lege groep.

## Mockup
N/A — pure backend.

## Technische notities

### Wat exact wijzigen — server.js regel 1844-1846 (bepaalGroepStatus)

**Vóór:**
```js
    if (groep?.fase === 'test') {
      return { fase: 'test', ronde_nr: groep.ronde_nr || 1, wacht_op: [] };
    }
```

**Na:**
```js
    if (groep?.fase === 'reveal') {
      return { fase: 'reveal', ronde_nr: groep.ronde_nr || 1, wacht_op: [] };
    }
    if (groep?.fase === 'test') {
      const groepLedenIds = leerlingIds; // al gefilterd op groep
      const ingediendIds = new Set(
        (testAntw || [])
          .filter(t => groepLedenIds.includes(t.leerling_id))
          .map(t => t.leerling_id)
      );
      const wacht_op = groepLedenIds.filter(id => !ingediendIds.has(id));
      if (wacht_op.length === 0 && groepLedenIds.length > 0) {
        return { fase: 'reveal', ronde_nr: groep.ronde_nr || 1, wacht_op: [] };
      }
      return { fase: 'test', ronde_nr: groep.ronde_nr || 1, wacht_op };
    }
```

### Wat exact wijzigen — server.js regel 2096-2106 (POST /test)

**Vóór:**
```js
app.post('/api/mol/sessies/:id/test', async (req, res) => {
  try {
    const { leerling_id, verdachte_id } = req.body;
    await supabase.from('mol_test_antwoorden').upsert([{
      id: `test_${req.params.id}_${leerling_id}`,
      sessie_id: req.params.id, leerling_id,
      verdachte_id, submitted_at: Date.now(),
    }]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

**Na:**
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
    // Per-groep completion check.
    const { data: speler } = await supabase.from('mol_leerlingen')
      .select('groep_id').eq('id', leerling_id).single();
    const groep_id = speler?.groep_id;
    if (groep_id) {
      const { data: leden } = await supabase.from('mol_leerlingen')
        .select('id').eq('sessie_id', sid).eq('groep_id', groep_id);
      const { data: tests } = await supabase.from('mol_test_antwoorden')
        .select('leerling_id').eq('sessie_id', sid);
      const ledenIds = new Set((leden || []).map(l => l.id));
      const ingediend = (tests || []).filter(t => ledenIds.has(t.leerling_id)).length;
      if (ledenIds.size > 0 && ingediend >= ledenIds.size) {
        await berekenScoresIntern(sid);
        await supabase.from('mol_groepen')
          .update({ fase: 'reveal' }).eq('id', groep_id);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

### Wat exact wijzigen — score-berekening fallback

**Regel 1614, vóór:**
```js
    const aantalCorrectGeraden = (testAntwoorden || []).filter(
      t => mol && t.leerling_id !== mol.id && t.mol_verdachte_id === mol.id
    ).length;
```
**Regel 1614, na:**
```js
    const aantalCorrectGeraden = (testAntwoorden || []).filter(
      t => mol && t.leerling_id !== mol.id &&
           (t.verdachte_id || t.mol_verdachte_id) === mol.id
    ).length;
```

**Regel 1650, vóór:**
```js
        const molGeraden = test && mol && test.mol_verdachte_id === mol.id;
```
**Regel 1650, na:**
```js
        const molGeraden = test && mol &&
          (test.verdachte_id || test.mol_verdachte_id) === mol.id;
```

**Regel 2152, vóór:**
```js
        .filter(t => ledenIds.has(t.leerling_id) && t.verdachte_id === mol_id)
```
**Regel 2152, na:**
```js
        .filter(t => ledenIds.has(t.leerling_id) &&
                     (t.verdachte_id || t.mol_verdachte_id) === mol_id)
```

### Waarom geen wijziging in `/api/mol/test-antwoord`

Dat endpoint (`server.js:1560-1591`) wordt door de huidige
speler-frontend niet aangeroepen — `submitTest` in
`netlify-deploy/mol-js/speler.js:1025` gebruikt
`/api/mol/sessies/:id/test`. Het oude endpoint kan in de toekomst
opgeruimd worden, maar valt buiten dit ticket om scope minimaal te
houden.

### Frontend-handlers zijn al deels aanwezig

`pollSpelerStatus` (`speler.js:197-202`) handelt fase `'reveal'` al
af door `renderSpelerReveal` aan te roepen en het reveal-scherm te
tonen. Score-data komt uit `sessieState.scores` (gevuld via
`/api/mol/sessie/:id` regel 1196). Na TICKET-018 is dit al voldoende
om Mol-onthulling + eindstand te tonen. TICKET-019 voegt vervolgens
de per-ronde feedback-flow toe.

## Verificatie door Reviewer

Onderstaande stappen volgen `WORKFLOW.md` § Preamble Reviewer Deel 2.

### Setup (eenmalig)
```bash
cp .env .env.productie-backup
cp .env.test .env
node scripts/reset-test-db.js
npm start > server.log 2>&1 &
sleep 3
curl http://localhost:8080/api/health
# verwacht: {"status":"ok"}
```

Maak een sessie met **1 groep × 2 leerlingen** (Mol + speler), zorg
dat alle rondes doorlopen zijn en `mol_groepen.fase = 'test'` voor
deze groep. Resulterende variabelen: `$SESSIE_ID`, `$GROEP_A`,
`$LID_SPELER`, `$LID_MOL`.

### AC1 — moltest in progress

```bash
# Eén lid dient in:
curl -X POST http://localhost:8080/api/mol/sessies/$SESSIE_ID/test \
  -H "Content-Type: application/json" \
  -d "{\"leerling_id\":\"$LID_SPELER\",\"verdachte_id\":\"$LID_MOL\"}"

curl "http://localhost:8080/api/mol/sessies/$SESSIE_ID/groep-status?groep_id=$GROEP_A"
```
**Verwacht:**
```json
{ "fase": "test", "ronde_nr": 3, "wacht_op": ["LID_MOL"] }
```

### AC2 + AC5 — completion triggert reveal + score-berekening

```bash
# Tweede lid (de Mol zelf) dient in:
curl -X POST http://localhost:8080/api/mol/sessies/$SESSIE_ID/test \
  -H "Content-Type: application/json" \
  -d "{\"leerling_id\":\"$LID_MOL\",\"verdachte_id\":\"$LID_SPELER\"}"

curl "http://localhost:8080/api/mol/sessies/$SESSIE_ID/groep-status?groep_id=$GROEP_A"
```
**Verwacht:**
```json
{ "fase": "reveal", "ronde_nr": 3, "wacht_op": [] }
```

DB-check:
```bash
# Via Supabase dashboard of test-DB CLI:
# SELECT fase FROM mol_groepen WHERE id = '$GROEP_A';
# Verwacht: 'reveal'
# SELECT count(*) FROM mol_scores WHERE sessie_id = '$SESSIE_ID';
# Verwacht: 2 (één per leerling)
```

### AC4 — onafhankelijkheid

Maak een sessie met 2 groepen × 2 leerlingen, beide
`mol_groepen.fase='test'`. Dien beide leden van groep A in, geen lid
van groep B.
```bash
curl "http://localhost:8080/api/mol/sessies/$SESSIE_ID2/groep-status?groep_id=$GROEP_A"
# Verwacht: { "fase": "reveal", ... }
curl "http://localhost:8080/api/mol/sessies/$SESSIE_ID2/groep-status?groep_id=$GROEP_B"
# Verwacht: { "fase": "test", "wacht_op": ["LID_B1", "LID_B2"] }
```

### AC6 — idempotentie

```bash
# Tweede maal POST voor lid uit groep met fase='reveal':
curl -X POST http://localhost:8080/api/mol/sessies/$SESSIE_ID/test \
  -H "Content-Type: application/json" \
  -d "{\"leerling_id\":\"$LID_SPELER\",\"verdachte_id\":\"$LID_MOL\"}"
```
**Verwacht:** `{ "ok": true }`. DB-check: scores blijven gelijk
(geen dubbeltelling), `mol_groepen.fase` blijft `'reveal'`.

### AC7 — npm test

```bash
npm test
```
**Verwacht:** alle suites groen, inclusief de nieuwe suite
`mol-groep-test-reveal`.

### AC9 — diff-omvang

```bash
git diff --stat main..HEAD
```
**Verwacht:** precies twee gewijzigde bestanden:
- `server.js`
- `tests/mol-groep-test-reveal.test.js`

### Cleanup

```bash
kill %1
cp .env.productie-backup .env
rm .env.productie-backup
head -1 .env  # bevestig: productie-URL
```

## Architect self-check

- [x] **Klein genoeg?** Net binnen M (~40 regels server.js + ~150
      test). Vier wijzigingen in server.js, alle binnen een straal van
      duidelijk afgebakende functies.
- [x] **Eén probleem?** Ja: post-moltest-overgang per groep. De
      veldnaam-fallback is randvoorwaarde voor AC7 — zonder die fix
      tellen geraden mollen 0 punten op, en is reveal cosmetisch.
- [x] **Acceptatiecriteria testbaar zonder menselijk oordeel?** Ja,
      alle via supertest of curl + DB-check.
- [x] **Welk deel van server.js?** 1614, 1650, 1844-1846, 2096-2106,
      2152. Geen ander deel aangeraakt.
- [x] **Geen frontend?** Bevestigd: TICKET-019 doet de UI-flow.

## Vervolgticket-suggestie

**TICKET-019:** reveal-flow met per-ronde feedback in de
speler-frontend. Voorwaarde: TICKET-018 staat live en is groen
gereviewd.
