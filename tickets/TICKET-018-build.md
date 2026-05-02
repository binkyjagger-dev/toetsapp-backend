# TICKET-018 — Build-rapport

**Ticket:** TICKET-018 — Per-groep moltest-completion en reveal-overgang
**Builder:** Cowork sessie B
**Datum:** 2026-05-02

## Bestanden gewijzigd

- `server.js` — 4 wijzigingen, +47 / -4 regels netto.
- `tests/mol-groep-test-reveal.test.js` — nieuw, 231 regels (6 tests).
- `tests/groep-volgende-fase.test.js` — 1 assertie aangepast (zie afwijking AC9).

## Wijzigingen per bestand

### server.js — wijziging 1 — `bepaalGroepStatus`
**Functie:** `bepaalGroepStatus`, briefing-tak (regels 1844-1846 in originele bestand).
**Wat:** vervangen `if (groep?.fase === 'test')` (returnde altijd `wacht_op:[]`) door:
- Nieuwe tak `if (groep?.fase === 'reveal')` → fase `'reveal'`, `wacht_op:[]`.
- Vernieuwde tak `if (groep?.fase === 'test')` → per-groep ingediend-check.
  Wacht-lijst is alle groepsleden zonder rij in `mol_test_antwoorden`.
  Als wacht_op leeg én groep heeft leden → `'reveal'`, anders `'test'`.

Citaat (regels 1844-1858 in nieuwe bestand):
```js
    if (groep?.fase === 'reveal') {
      return { fase: 'reveal', ronde_nr: groep.ronde_nr || 1, wacht_op: [] };
    }
    if (groep?.fase === 'test') {
      const ingediendIds = new Set(
        (testAntw || [])
          .filter(t => leerlingIds.includes(t.leerling_id))
          .map(t => t.leerling_id)
      );
      const wacht_test = leerlingIds.filter(id => !ingediendIds.has(id));
      if (wacht_test.length === 0 && leerlingIds.length > 0) {
        return { fase: 'reveal', ronde_nr: groep.ronde_nr || 1, wacht_op: [] };
      }
      return { fase: 'test', ronde_nr: groep.ronde_nr || 1, wacht_op: wacht_test };
    }
```

### server.js — wijziging 2 — POST `/api/mol/sessies/:id/test`
**Functie:** `app.post('/api/mol/sessies/:id/test', ...)` (regels 2096-2106 in
originele bestand).
**Wat:** na de upsert in `mol_test_antwoorden` een per-groep completion-check.
Idempotent dankzij guard op `groep.fase !== 'reveal'`. Roept
`berekenScoresIntern(sid)` aan en zet `mol_groepen.fase = 'reveal'` zodra
alle groepsleden een testrij hebben.

Citaat (relevante toevoegingen):
```js
    const { data: speler } = await supabase.from('mol_leerlingen')
      .select('groep_id').eq('id', leerling_id).single();
    const groep_id = speler?.groep_id;
    if (groep_id) {
      const { data: groep } = await supabase.from('mol_groepen')
        .select('fase').eq('id', groep_id).single();
      if (groep?.fase !== 'reveal') {
        const { data: leden } = await supabase.from('mol_leerlingen')
          .select('id').eq('sessie_id', sid).eq('groep_id', groep_id);
        const { data: tests } = await supabase.from('mol_test_antwoorden')
          .select('leerling_id').eq('sessie_id', sid);
        const ledenIds = new Set((leden || []).map(l => l.id));
        const ingediend = (tests || [])
          .filter(t => ledenIds.has(t.leerling_id)).length;
        if (ledenIds.size > 0 && ingediend >= ledenIds.size) {
          await berekenScoresIntern(sid);
          await supabase.from('mol_groepen')
            .update({ fase: 'reveal' }).eq('id', groep_id);
        }
      }
    }
```

### server.js — wijziging 3 — veldnaam-fallback in `berekenScoresIntern`
**Functie:** `berekenScoresIntern` regels 1614 en 1650.
**Wat:** `t.mol_verdachte_id === mol.id` vervangen door
`(t.verdachte_id || t.mol_verdachte_id) === mol.id`. Idem op regel 1650 voor
`test.mol_verdachte_id`. Lees-fallback maakt scoreberekening compatibel met
nieuwe schrijfkant (`verdachte_id`) zónder bestaande data te breken.

### server.js — wijziging 4 — veldnaam-fallback in `/resultaten`
**Functie:** `app.get('/api/mol/sessies/:id/resultaten', ...)` regel 2152.
**Wat:** `t.verdachte_id === mol_id` vervangen door
`(t.verdachte_id || t.mol_verdachte_id) === mol_id`. Zelfde lees-fallback,
nu in het frontend-leesendpoint.

### tests/mol-groep-test-reveal.test.js — nieuw
6 tests volgens patroon van `tests/discussie-resultaat-per-groep.test.js`.
Dekt AC1-AC6. Mock-chain is uitgebreid met een `_wantsSingle`-flag zodat
`.single()`-aanroepen op array-resolves het eerste element teruggeven (nodig
voor de nieuwe `mol_leerlingen.select('groep_id').eq('id').single()` in de
POST-handler).

## Test-output (laatste run)

```
Test Suites: 1 failed, 95 passed, 96 total
Tests:       505 passed, 505 total
```

- 1 falende suite: `tests/api-health.test.js`. Reden: `supabaseUrl is required`
  bij `createClient` zonder `SUPABASE_URL`. **Pre-existing op `main`** —
  ge-stash't en bevestigd dat deze al rood stond zonder mijn wijzigingen.
- Alle 505 individuele tests slagen.

## Self-check tegen acceptatiecriteria

| AC | Status | Toelichting |
|----|--------|-------------|
| AC1 — moltest in progress | ✓ | Test groen in `mol-groep-test-reveal.test.js` (`AC1: 1/2 leden ingediend`). |
| AC2 — moltest compleet, fase nog `test` in DB | ✓ | Test groen (`AC2: 2/2 leden ingediend`). |
| AC3 — fase reeds `reveal` in DB | ✓ | Test groen (`AC3: groep.fase=reveal in DB`). Nieuwe tak voor `reveal` toegevoegd vóór de `test`-tak. |
| AC4 — onafhankelijkheid tussen groepen | ✓ | Test groen (`AC4: testAntw van andere groep telt niet mee`). |
| AC5 — endpoint zet fase + berekent scores | ✓ | Test groen (`AC5: laatste lid -> mol_groepen.update fase=reveal`). |
| AC6 — endpoint is idempotent | ✓ | Test groen (`AC6: idempotent — groep al reveal`). Guard op `groep.fase !== 'reveal'` voorkomt herberekening. |
| AC7 — score-berekening met `verdachte_id` | ✓ | `||`-fallback in `berekenScoresIntern` (regels 1614, 1650) en `/resultaten` (regel 2152). Bestaande `mol-puntentelling-intern.test.js` blijft groen — bevestigt dat oude `mol_verdachte_id`-data ook nog telt. |
| AC8 — bestaande tests groen | ✓ | Alle 505 tests slagen. Eén bestaande assertie bijgewerkt (zie afwijking AC9). |
| AC9 — diff-omvang precies 2 bestanden | ✗ | **Drie bestanden gewijzigd** i.p.v. twee — zie afwijking hieronder. |

## Afwijking van AC9 — drie bestanden gewijzigd i.p.v. twee

`tests/groep-volgende-fase.test.js` (TICKET-017) bevatte AC7 met de assertie
`expect(res.body.wacht_op).toEqual([])` voor `groep.fase === 'test'`. Die
assertie is een implementation-detail van het oude gedrag dat TICKET-018
expliciet vervangt: TICKET-018 AC1 zegt dat een groep met fase `'test'` en
nog niet ingediende leden `wacht_op` = die leden moet returnen.

Daardoor zijn AC1 en AC8 onverenigbaar zonder die test-assertie bij te
werken. AC9 (max 2 files) en AC8 (alle tests groen) zijn intern strijdig.
Ik heb gekozen voor AC8: de assertie in `groep-volgende-fase.test.js` AC7
is bijgewerkt naar de nieuwe semantiek (`wacht_op = ['lid1', 'lid2']`). De
intentie van TICKET-017's AC7 (fase blijft `'test'`, ronde_nr behouden)
blijft volledig gedekt. De testnaam en commentaar zijn aangepast om de
nieuwe semantiek te documenteren.

Reviewer: keurig om te beoordelen of dit een acceptabele afwijking is, of
of er een fix-ticket gewenst is om dit als aparte commit te splitsen.

## Opgemerkt, niet opgepakt

- `tests/api-health.test.js` faalt al op `main`: ontbrekende `SUPABASE_URL`
  in test-omgeving stopt de suite vóór tests draaien. Geen verband met
  TICKET-018; geen scope om dit te fixen.
- `/api/mol/test-antwoord` (regels 1560-1591) blijft ongewijzigd — ticket
  bevestigt dat dit endpoint bewust buiten scope is.
- De mock-chain-uitbreiding (`_wantsSingle`) in
  `tests/mol-groep-test-reveal.test.js` is alleen lokaal toegepast; andere
  testbestanden gebruiken nog de oudere chain zonder single-handling. Dat
  is geen regressie, maar er is opportunity om dit later naar een gedeelde
  helper te verplaatsen.

## Commit-instructie voor Martijn (uitvoeren in de terminal)

1. Open een terminal in de projectmap (`cd ~/projects/toetsapp-backend`).
2. Voer uit:
   ```
   git add server.js tests/mol-groep-test-reveal.test.js tests/groep-volgende-fase.test.js tickets/TICKET-018.md tickets/TICKET-018-build.md
   git commit -m "TICKET-018: per-groep moltest-completion en reveal-overgang"
   ```
3. Verwacht: je ziet `5 files changed, ...`. Op het scherm verschijnt de
   commit-hash en het commit-bericht.
4. Controleer met `git log -1 --stat` dat alleen de juiste bestanden in de
   commit zitten.
5. Bij fout: stuur de **exacte** foutmelding naar de Architect. Niet
   `--amend` of `reset --hard` zonder overleg.

## Deploy en test dan het volgende

(Reviewer-stappen; volg `WORKFLOW.md` § Preamble Reviewer Deel 2.)

### Setup

```bash
cp .env .env.productie-backup
cp .env.test .env
node scripts/reset-test-db.js
npm start > server.log 2>&1 &
sleep 3
curl http://localhost:8080/api/health
# verwacht: {"status":"ok"}
```

Maak via het docent-dashboard of seed-script een sessie met **2 groepen ×
2 leerlingen** (groep A: 1 mol + 1 speler, groep B: 1 mol + 1 speler).
Doorloop alle rondes tot beide groepen `mol_groepen.fase = 'test'` hebben.
Variabelen: `$SESSIE_ID`, `$GROEP_A`, `$GROEP_B`, `$LID_A1`, `$LID_A_MOL`,
`$LID_B1`, `$LID_B_MOL`.

### AC1 — moltest in progress (groep A)

```bash
curl -X POST http://localhost:8080/api/mol/sessies/$SESSIE_ID/test \
  -H "Content-Type: application/json" \
  -d "{\"leerling_id\":\"$LID_A1\",\"verdachte_id\":\"$LID_A_MOL\"}"

curl "http://localhost:8080/api/mol/sessies/$SESSIE_ID/groep-status?groep_id=$GROEP_A"
```
**Verwacht:** `{ "fase": "test", "ronde_nr": <r>, "wacht_op": ["LID_A_MOL"] }`.

### AC2 + AC5 — completion triggert reveal + scores

```bash
curl -X POST http://localhost:8080/api/mol/sessies/$SESSIE_ID/test \
  -H "Content-Type: application/json" \
  -d "{\"leerling_id\":\"$LID_A_MOL\",\"verdachte_id\":\"$LID_A1\"}"

curl "http://localhost:8080/api/mol/sessies/$SESSIE_ID/groep-status?groep_id=$GROEP_A"
```
**Verwacht:** `{ "fase": "reveal", "ronde_nr": <r>, "wacht_op": [] }`.

DB-check (Supabase dashboard test-DB of psql):
- `SELECT fase FROM mol_groepen WHERE id = '$GROEP_A';` → `reveal`.
- `SELECT count(*) FROM mol_scores WHERE sessie_id = '$SESSIE_ID';` → 4
  (één per leerling in de hele sessie — `berekenScoresIntern` doet
  sessie-breed).

### AC4 — onafhankelijkheid tussen groepen

```bash
curl "http://localhost:8080/api/mol/sessies/$SESSIE_ID/groep-status?groep_id=$GROEP_B"
```
**Verwacht:** `{ "fase": "test", "wacht_op": ["LID_B1", "LID_B_MOL"] }`.

DB-check: `SELECT fase FROM mol_groepen WHERE id = '$GROEP_B';` → `'test'`
(ongewijzigd; alleen groep A is naar `reveal` gegaan).

### AC6 — idempotentie

```bash
curl -X POST http://localhost:8080/api/mol/sessies/$SESSIE_ID/test \
  -H "Content-Type: application/json" \
  -d "{\"leerling_id\":\"$LID_A1\",\"verdachte_id\":\"$LID_A_MOL\"}"
```
**Verwacht:** `{ "ok": true }`. DB-check: `mol_groepen.fase` blijft `reveal`,
`mol_scores`-rij voor `$LID_A1` bevat geen dubbele waarde (totaal blijft
gelijk aan vorige run).

### AC7 — npm test

```bash
npm test
```
**Verwacht:** 505 tests groen. Eventueel `api-health.test.js` als suite-fail
(pre-existing op `main`, ontbrekende env-vars; niet door TICKET-018
veroorzaakt).

### AC9 — diff-omvang

```bash
git diff --stat main..HEAD
```
**Verwacht (afwijking, zie sectie hierboven):** drie gewijzigde bestanden:
`server.js`, `tests/mol-groep-test-reveal.test.js`,
`tests/groep-volgende-fase.test.js`. Wijziging in `server.js` ~47 regels
netto.

### Cleanup

```bash
kill %1
cp .env.productie-backup .env
rm .env.productie-backup
head -1 .env  # bevestig: productie-URL
```
