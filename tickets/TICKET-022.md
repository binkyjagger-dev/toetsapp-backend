# TICKET-022: Nieuwe score-berekening volgens puntenverdeling-spec

**Status:** Ready for Build (na TICKET-021)
**Grootte:** M
**Aangemaakt door:** Architect
**Datum:** 2026-05-04

## Doel
De score-berekening van een Mol-sessie volgt de nieuwe puntenverdeling-
specificatie: detective-pot-formule, mol-rolbonus, sabotage op basis
van fout antwoordende niet-mollen, mol speelt MC mee.

## Achtergrond

De huidige `berekenScoresIntern` (`server.js:1593-1701`) gebruikt
hardcoded waardes die afwijken van de officiële spec. Specifiek:

| Component | Huidig | Spec |
|---|---|---|
| Niet-mol — groep correct | +10 | +5 |
| Niet-mol — groep fout | −5 | −2 |
| Niet-mol — rader-bonus | round(50 / raders) | (10 + 10×n) / raders |
| Mol — individuele MC | 0 (niet meegerekend) | optiePunten per ronde |
| Mol — rolbonus | 0 | +10 |
| Mol — sabotage | +20 per ronde als groep fout | +3 × foutePerRonde per ronde |
| Mol — niet-ontmaskerd | round((1 − raders/nietMol) × 50) | (1 − raders/nietMol) × (10 + 10×n) |

Detective-pot = `DETECTIVE_BASIS + DETECTIVE_PER_RONDE × aantalRondes`
(default 10 + 10×n, schaalt mee met sessie-lengte).

Configureerbaarheid: alle constants worden in een aparte module
`lib/scoreConfig.js` gezet zodat tests ze kunnen importeren en
toekomstige admin-UI ze kan aanpassen.

## Scope

### Wel
- **Nieuw bestand `lib/scoreConfig.js`** — geëxporteerde constants:
  `MC_MAX`, `GROEP_CORRECT`, `GROEP_FOUT`, `MOL_ROLBONUS`,
  `SABOTAGE_PER_FOUT`, `DETECTIVE_BASIS`, `DETECTIVE_PER_RONDE`.
- **`server.js:1593-1701`** — `berekenScoresIntern` herschrijven:
  - `require('./lib/scoreConfig')` toevoegen bovenaan file.
  - Niet-mol: groep `+5/-2`, rader-bonus =
    `(BASIS + PER_RONDE × n) / raders`.
  - Mol: indivPunten per ronde (met fallback `optie?.punten || 0`),
    rolbonus `+10`, sabotage `+3 × foutePerRonde`, niet-ontmaskerd
    `(1 - raders/nietMol) × detectivePot`.
  - Helper `bepaalFoutePerRonde(antwoorden, cases, leerlingen, mol, r)`
    die telt hoeveel niet-mollen niet-max-punten hebben gekozen.
- **`netlify-deploy/mol-js/reveal.js`** — `bouwScoreOpbouw`
  (regel 69-114): mol-tak uitbreiden met rijen voor
  `ronde_X_individueel` + `mol_rolbonus`.
- **`tests/mol-puntentelling-intern.test.js`** — bestaande tests
  bijwerken naar nieuwe formules. Per test: oude waarde als comment
  laten staan, nieuwe waarde uitrekenen via spec en asserten.
- **`tests/mol-puntentelling-spec.test.js`** (nieuw) — expliciete
  spec-edge-cases (1 ronde, geen raders, alle raders, mol-MC
  meegerekend).

### Niet
- **Geen** admin-UI of DB-kolom voor configureerbare waardes.
  `lib/scoreConfig.js` is voorlopig de bron van waarheid; admin-UI
  is een vervolgticket.
- **Geen** migratie van bestaande `mol_scores`-rijen. Oude sessies
  houden hun oude scores in DB. Alleen sessies waarbij na deploy
  `berekenScoresIntern` getriggerd wordt krijgen nieuwe formule.
- **Geen** wijziging aan `mol_groep_stemmen.is_correct` of de
  punten-veld-logica in `/api/mol/groep-stem-hoofd`. De
  score-berekening leest alleen uit de bestaande velden.
- **Geen** wijziging aan `tests/mol-puntentelling-groep.test.js`
  tenzij hij faalt — dan minimale aanpassing.
- **Geen** feature-flag of A/B-pad. Directe omschakeling.

## Acceptatiecriteria

Alle AC's testbaar via `berekenScoresIntern` met mocks (zie testpatroon).

1. [ ] **AC1 — niet-mol groep-bonus +5/-2:**
   In een sessie met `n_rondes=2`, niet-mol-leerling met `mol_antwoorden`
   ronde 1 max-punten (10), ronde 2 0 punten, en `mol_groep_stemmen`
   ronde 1 `is_correct=true`, ronde 2 `is_correct=false`:
   `opbouw['ronde_1_groep'] === 5` en `opbouw['ronde_2_groep'] === -2`.

2. [ ] **AC2 — niet-mol rader-bonus = detectivePot / raders:**
   `n_rondes=3`, 4 niet-mollen, 1 rader (de testpersoon):
   `opbouw['mol_geraden'] === 40` (detectivePot 10+10×3=40, /1=40).
   Met 2 raders: `opbouw['mol_geraden'] === 20` per rader.

3. [ ] **AC3 — mol indivPunten per ronde:**
   Mol-leerling met `mol_antwoorden` ronde 1 mc_optie met 10 punten,
   ronde 2 mc_optie met 0 punten:
   `opbouw['ronde_1_individueel'] === 10` en
   `opbouw['ronde_2_individueel'] === 0`.

4. [ ] **AC4 — mol rolbonus:**
   Mol totaal bevat `opbouw['mol_rolbonus'] === 10`.

5. [ ] **AC5 — mol sabotage per ronde op fout-count:**
   In ronde 1 hebben 2 van 3 niet-mollen een niet-max-punten optie
   gekozen → `opbouw['ronde_1_sabotage'] === 6`. Het groepsantwoord
   is **niet** relevant voor sabotage.

6. [ ] **AC6 — mol niet-ontmaskerd = (1 - raders/nietMol) × pot:**
   `n_rondes=3`, 4 niet-mollen, 1 rader:
   `opbouw['niet_ontmaskerd'] === Math.round((1 - 1/4) * 40) === 30`.
   Met 0 raders: `niet_ontmaskerd === 40`. Met 4 raders: `0`.

7. [ ] **AC7 — eindclamp blijft op 0:**
   Negatieve totaal-score wordt geclampt naar 0.

8. [ ] **AC8 — config-import werkt:**
   `require('../lib/scoreConfig')` in test geeft een object met
   alle 7 keys, met de in spec genoemde standaardwaarden.

9. [ ] **AC9 — frontend toont mol-individueel + rolbonus:**
   `bouwScoreOpbouw(score, true, n_rondes)` met
   `opbouw['ronde_1_individueel']=7, ronde_2_individueel=0,
    mol_rolbonus=10, ronde_1_sabotage=3, niet_ontmaskerd=20`
   bevat in de gerenderde HTML labels "Ronde 1 — individueel
   antwoord", "Mol-rolbonus", "Ronde 1 — sabotage geslaagd",
   "Niet ontmaskerd".

10. [ ] **AC10 — bestaande tests groen:** alle suites blijven slagen.
    Zal vereisen dat `tests/mol-puntentelling-intern.test.js`
    bijgewerkt wordt naar nieuwe waardes (geen schrappingen).

11. [ ] **AC11 — diff-omvang:** `git diff --stat` toont:
    - `lib/scoreConfig.js` (nieuw)
    - `server.js`
    - `netlify-deploy/mol-js/reveal.js`
    - `tests/mol-puntentelling-intern.test.js` (gewijzigd)
    - `tests/mol-puntentelling-spec.test.js` (nieuw)

## Bestanden die geraakt worden

- `lib/scoreConfig.js` — **nieuw**, ~15 regels.
- `server.js`, regels **1593-1701**: `berekenScoresIntern`
  herschrijven (~80 regels netto).
- `netlify-deploy/mol-js/reveal.js`, regels **69-114**:
  `bouwScoreOpbouw` mol-tak uitbreiden (~10 regels netto).
  - **Verifieer eerst** dat deze file geen literal emojis heeft
    (alleen escaped Unicode `\u{...}`):
    `grep -P "[\x{1F300}-\x{1FFFF}]" netlify-deploy/mol-js/reveal.js`
  - Geen output → Edit-tool werkt. Output → gebruik Python
    str.replace.
- `tests/mol-puntentelling-intern.test.js`: bestaande assertions
  bijwerken naar nieuwe waardes (commentaar oude waarde behouden).
- `tests/mol-puntentelling-spec.test.js` — **nieuw**, ~150 regels.

## Tests

### Bestaande tests die groen moeten blijven (na bijwerking)
- `tests/mol-puntentelling-intern.test.js` — assertions bijwerken,
  niet schrappen. Per test: comment met "Oud: X, Nieuw: Y (formule)".
- `tests/mol-puntentelling-groep.test.js` — alleen aanpassen als hij
  faalt; controleer eerst.
- `tests/mol-groep-test-reveal.test.js` — ongewijzigd (test fase, niet
  scores).
- Alle andere mol-suite tests.
- `npm run lint:html`.

### Nieuw: `lib/scoreConfig.js`

```javascript
module.exports = {
  MC_MAX:               10,
  GROEP_CORRECT:         5,
  GROEP_FOUT:           -2,
  MOL_ROLBONUS:         10,
  SABOTAGE_PER_FOUT:     3,
  DETECTIVE_BASIS:      10,
  DETECTIVE_PER_RONDE:  10,
};
```

### Nieuw: `tests/mol-puntentelling-spec.test.js`

Skelet:

```javascript
/**
 * TICKET-022 — Nieuwe puntenverdeling-spec.
 *
 * Spec: zie tickets/TICKET-022.md "Achtergrond".
 * Constants: lib/scoreConfig.js
 */

const SCORE = require('../lib/scoreConfig');

let leerlingenResolve, antwoordenResolve, groepStemmenResolve,
    testAntwResolve, sessieResolve, casesResolve;

function makeChain(getResolve) {
  const c = {
    select: jest.fn(() => c),
    upsert: jest.fn(() => Promise.resolve({ error: null })),
    eq:     jest.fn(() => c),
    single: jest.fn(() => c),
    then:   (resolve, reject) =>
              Promise.resolve(getResolve()).then(resolve, reject),
  };
  return c;
}

const leerlingenChain   = makeChain(() => leerlingenResolve);
const antwoordenChain   = makeChain(() => antwoordenResolve);
const groepStemmenChain = makeChain(() => groepStemmenResolve);
const testAntwChain     = makeChain(() => testAntwResolve);
const sessieChain       = makeChain(() => sessieResolve);
const casesChain        = makeChain(() => casesResolve);
const scoresChain       = makeChain(() => ({ data: null, error: null }));

const mockFrom = jest.fn((table) => {
  if (table === 'mol_leerlingen')      return leerlingenChain;
  if (table === 'mol_antwoorden')      return antwoordenChain;
  if (table === 'mol_groep_stemmen')   return groepStemmenChain;
  if (table === 'mol_test_antwoorden') return testAntwChain;
  if (table === 'mol_sessies')         return sessieChain;
  if (table === 'mol_cases')           return casesChain;
  return scoresChain;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

// Builder: berekenScoresIntern is niet direct geëxporteerd. Aanroepen
// via eindpunt POST /api/mol/sessies/:id/test (na completion) of via
// een dedicated test-endpoint, of door het functie-patroon van
// mol-puntentelling-intern.test.js over te nemen.
const request = require('supertest');
const app     = require('../server');

function fixture3rondes4nietMol1Rader() {
  // 1 mol + 4 niet-mollen, 3 rondes, MC met max 10 punten.
  // Niet-mol1: ronde1 max(10), ronde2 max(10), ronde3 fout(0)
  // Niet-mol2-4: alle rondes max
  // Niet-mol1 raadt mol correct, anderen fout.
  // Groepsantwoord r1 correct, r2 fout, r3 correct.
  // Mol: r1=mc_b(0), r2=mc_b(0), r3=mc_b(0)  (alle sabotage)
  sessieResolve = { data: { id: 'sid', n_rondes: 3 }, error: null };
  leerlingenResolve = { data: [
    { id: 'm',  is_mol: true,  groep_id: 'g' },
    { id: 'n1', is_mol: false, groep_id: 'g' },
    { id: 'n2', is_mol: false, groep_id: 'g' },
    { id: 'n3', is_mol: false, groep_id: 'g' },
    { id: 'n4', is_mol: false, groep_id: 'g' },
  ], error: null };
  casesResolve = { data: [1,2,3].map(r => ({
    sessie_id: 'sid', ronde_nr: r,
    mc_opties: [
      { id: 'a', punten: 10 },
      { id: 'b', punten: 0  },
    ],
  })), error: null };
  antwoordenResolve = { data: [
    // r1
    { leerling_id: 'm',  ronde_nr: 1, mc_optie_id: 'b' },
    { leerling_id: 'n1', ronde_nr: 1, mc_optie_id: 'a' },
    { leerling_id: 'n2', ronde_nr: 1, mc_optie_id: 'a' },
    { leerling_id: 'n3', ronde_nr: 1, mc_optie_id: 'a' },
    { leerling_id: 'n4', ronde_nr: 1, mc_optie_id: 'a' },
    // r2
    { leerling_id: 'm',  ronde_nr: 2, mc_optie_id: 'b' },
    { leerling_id: 'n1', ronde_nr: 2, mc_optie_id: 'a' },
    { leerling_id: 'n2', ronde_nr: 2, mc_optie_id: 'a' },
    { leerling_id: 'n3', ronde_nr: 2, mc_optie_id: 'a' },
    { leerling_id: 'n4', ronde_nr: 2, mc_optie_id: 'a' },
    // r3 — n1 fout
    { leerling_id: 'm',  ronde_nr: 3, mc_optie_id: 'b' },
    { leerling_id: 'n1', ronde_nr: 3, mc_optie_id: 'b' },
    { leerling_id: 'n2', ronde_nr: 3, mc_optie_id: 'a' },
    { leerling_id: 'n3', ronde_nr: 3, mc_optie_id: 'a' },
    { leerling_id: 'n4', ronde_nr: 3, mc_optie_id: 'a' },
  ], error: null };
  groepStemmenResolve = { data: [
    { groep_id: 'g', ronde_nr: 1, is_correct: true  },
    { groep_id: 'g', ronde_nr: 2, is_correct: false },
    { groep_id: 'g', ronde_nr: 3, is_correct: true  },
  ], error: null };
  testAntwResolve = { data: [
    { leerling_id: 'n1', mol_verdachte_id: 'm' },  // raadt correct
    { leerling_id: 'n2', mol_verdachte_id: 'n1' }, // fout
    { leerling_id: 'n3', mol_verdachte_id: 'n1' }, // fout
    { leerling_id: 'n4', mol_verdachte_id: 'n1' }, // fout
    { leerling_id: 'm',  mol_verdachte_id: null }, // mol stemt
  ], error: null };
}

describe('TICKET-022 — score-berekening spec', () => {
  // De Builder verzint hoe berekenScoresIntern getriggerd wordt
  // (POST /test van laatste lid trigger het) en hoe de scores
  // opgehaald worden uit de mocked supabase.from('mol_scores').upsert(...)
  // calls. Patroon: spy op upsert, lees laatste argument.

  it('AC1: niet-mol groep-bonus +5 correct, -2 fout', async () => {
    fixture3rondes4nietMol1Rader();
    // ... trigger berekening ...
    // const scoreN1 = ...; // haal opbouw op
    // expect(scoreN1.opbouw.ronde_1_groep).toBe(5);
    // expect(scoreN1.opbouw.ronde_2_groep).toBe(-2);
    // expect(scoreN1.opbouw.ronde_3_groep).toBe(5);
  });

  it('AC2: rader-bonus = detectivePot / aantalRaders', async () => {
    fixture3rondes4nietMol1Rader();
    // detectivePot = 10 + 10*3 = 40
    // 1 rader -> 40 / 1 = 40
    // expect(scoreN1.opbouw.mol_geraden).toBe(40);
    // niet-raders krijgen 0
    // expect(scoreN2.opbouw.mol_geraden).toBe(0);
  });

  it('AC3 + AC4: mol indivPunten + rolbonus', async () => {
    fixture3rondes4nietMol1Rader();
    // mol heeft 'b' (0 punten) gekozen elke ronde
    // expect(scoreMol.opbouw.ronde_1_individueel).toBe(0);
    // expect(scoreMol.opbouw.mol_rolbonus).toBe(10);
  });

  it('AC5: sabotage = 3 * foutePerRonde, ongeacht groepsantwoord', async () => {
    fixture3rondes4nietMol1Rader();
    // r1: 0 niet-mollen fout -> 0
    // r2: 0 niet-mollen fout -> 0
    // r3: 1 niet-mol fout (n1) -> 3
    // expect(scoreMol.opbouw.ronde_1_sabotage).toBe(0);
    // expect(scoreMol.opbouw.ronde_3_sabotage).toBe(3);
  });

  it('AC6: niet-ontmaskerd = (1 - raders/nietMol) * pot', async () => {
    fixture3rondes4nietMol1Rader();
    // (1 - 1/4) * 40 = 30
    // expect(scoreMol.opbouw.niet_ontmaskerd).toBe(30);
  });

  it('AC7: eindclamp op 0', async () => {
    // Maak fixture met sterk negatief totaal voor een niet-mol.
    // ... expect(score.totaal).toBe(0);
  });

  it('AC8: scoreConfig levert juiste defaults', () => {
    expect(SCORE.MC_MAX).toBe(10);
    expect(SCORE.GROEP_CORRECT).toBe(5);
    expect(SCORE.GROEP_FOUT).toBe(-2);
    expect(SCORE.MOL_ROLBONUS).toBe(10);
    expect(SCORE.SABOTAGE_PER_FOUT).toBe(3);
    expect(SCORE.DETECTIVE_BASIS).toBe(10);
    expect(SCORE.DETECTIVE_PER_RONDE).toBe(10);
  });

  it('AC: 0 raders -> mol krijgt volledige pot', async () => {
    // testAntwoorden zonder correcte gokken
    // expect(scoreMol.opbouw.niet_ontmaskerd).toBe(40);
    // expect(scoreN1.opbouw.mol_geraden).toBe(0);
  });

  it('AC: 1-ronde sessie -> detectivePot = 20', async () => {
    // sessie n_rondes = 1
    // expect(scoreMol.opbouw.niet_ontmaskerd).toBe(Math.round((1 - r/n) * 20));
  });
});
```

**Builder-let-op:** het patroon van triggering + score-uitlezen kan
het beste gekopieerd worden uit `tests/mol-puntentelling-intern.test.js`
(bestaande techniek: spy op `mol_scores`-upsert, lees `score.opbouw`).

### Bestaande tests bijwerken — werkwijze

Voor elke test in `mol-puntentelling-intern.test.js`:
1. Lees de assertion. Identificeer welke component (groep, rader,
   sabotage, niet-ontmaskerd) hij test.
2. Reken nieuwe waarde uit volgens spec, op papier.
3. Voeg comment toe boven de assertion:
   `// Oud: X (formule). Nieuw: Y (formule TICKET-022)`
4. Wijzig assertion naar nieuwe waarde.
5. **Pas nooit een test aan om hem groen te krijgen zonder spec-check.**

Voorbeeld:
```js
// Oud: round(50 / 1) = 50. Nieuw: (10 + 10*3) / 1 = 40 (TICKET-022)
expect(scoreN1.opbouw.mol_geraden).toBe(40);
```

## Mockup
N/A — score-velden in eindstand worden uitgebreid maar bestaande
opmaak blijft. Reveal-frontend gebruikt al dynamische rij-rendering.

## Technische notities

### Wat exact wijzigen — server.js regel 1593-1701

**Vóór:** zie huidige `berekenScoresIntern`.

**Na:** structuur als volgt (nieuwe versie volledig):

```js
const SCORE = require('./lib/scoreConfig');

function bepaalFoutePerRonde(antwoorden, cases, leerlingen, mol, r) {
  const caseR = (cases || []).find(c => c.ronde_nr === r);
  if (!caseR?.mc_opties || caseR.mc_opties.length === 0) return 0;
  const maxPunten  = Math.max(...caseR.mc_opties.map(o => o.punten || 0));
  const correctIds = new Set(
    caseR.mc_opties.filter(o => (o.punten || 0) === maxPunten).map(o => o.id)
  );
  const nietMolIds = new Set(
    (leerlingen || []).filter(l => !l.is_mol).map(l => l.id)
  );
  return (antwoorden || [])
    .filter(a => a.ronde_nr === r && nietMolIds.has(a.leerling_id))
    .filter(a => !correctIds.has(a.mc_optie_id))
    .length;
}

async function berekenScoresIntern(sessie_id) {
  try {
    const [
      { data: leerlingen }, { data: antwoorden },
      { data: groepStemmen }, { data: testAntwoorden }, { data: sessie },
      { data: cases },
    ] = await Promise.all([
      supabase.from('mol_leerlingen').select('*').eq('sessie_id', sessie_id),
      supabase.from('mol_antwoorden').select('*').eq('sessie_id', sessie_id),
      supabase.from('mol_groep_stemmen').select('*').eq('sessie_id', sessie_id),
      supabase.from('mol_test_antwoorden').select('*').eq('sessie_id', sessie_id),
      supabase.from('mol_sessies').select('*').eq('id', sessie_id).single(),
      supabase.from('mol_cases').select('*').eq('sessie_id', sessie_id),
    ]);

    const mol           = (leerlingen || []).find(l => l.is_mol);
    const nietMolCount  = (leerlingen || []).filter(l => !l.is_mol).length;
    const nRondes       = sessie?.n_rondes || 3;
    const detectivePot  = SCORE.DETECTIVE_BASIS + SCORE.DETECTIVE_PER_RONDE * nRondes;
    const aantalRaders  = (testAntwoorden || []).filter(
      t => mol && t.leerling_id !== mol.id &&
           (t.verdachte_id || t.mol_verdachte_id) === mol.id
    ).length;

    const scores = [];

    for (const leerling of (leerlingen || [])) {
      const isMol  = leerling.is_mol;
      const opbouw = {};
      let totaal  = 0;

      // Individuele MC — voor iedereen.
      for (let r = 1; r <= nRondes; r++) {
        const ant     = (antwoorden || []).find(a => a.leerling_id === leerling.id && a.ronde_nr === r);
        const caseR   = (cases || []).find(c => c.ronde_nr === r);
        const optie   = (caseR?.mc_opties || []).find(o => o.id === ant?.mc_optie_id);
        const pnt     = optie?.punten || 0;
        opbouw['ronde_' + r + '_individueel'] = pnt;
        totaal += pnt;
      }

      if (!isMol) {
        // Groepsantwoord +5/-2.
        for (let r = 1; r <= nRondes; r++) {
          const stem = (groepStemmen || []).find(
            s => s.groep_id === leerling.groep_id && s.ronde_nr === r
          );
          if (stem) {
            const bonus = stem.is_correct ? SCORE.GROEP_CORRECT : SCORE.GROEP_FOUT;
            opbouw['ronde_' + r + '_groep'] = bonus;
            totaal += bonus;
          }
        }

        // Mol-rader-bonus.
        const test = (testAntwoorden || []).find(t => t.leerling_id === leerling.id);
        const heeftGeraden = test && mol &&
          (test.verdachte_id || test.mol_verdachte_id) === mol.id;
        const bonus = heeftGeraden && aantalRaders > 0
          ? Math.round(detectivePot / aantalRaders)
          : 0;
        opbouw['mol_geraden'] = bonus;
        totaal += bonus;

      } else {
        // Mol-rolbonus.
        opbouw['mol_rolbonus'] = SCORE.MOL_ROLBONUS;
        totaal += SCORE.MOL_ROLBONUS;

        // Sabotage per ronde.
        for (let r = 1; r <= nRondes; r++) {
          const fout = bepaalFoutePerRonde(antwoorden, cases, leerlingen, mol, r);
          const sab  = SCORE.SABOTAGE_PER_FOUT * fout;
          opbouw['ronde_' + r + '_sabotage'] = sab;
          totaal += sab;
        }

        // Niet-ontmaskerd-bonus.
        const ontmFactor = nietMolCount > 0
          ? (1 - aantalRaders / nietMolCount)
          : 0;
        const ontm = Math.round(ontmFactor * detectivePot);
        opbouw['niet_ontmaskerd'] = ontm;
        totaal += ontm;
      }

      totaal = Math.max(0, totaal);
      scores.push({
        id:          `score_${sessie_id}_${leerling.id}`,
        sessie_id,
        leerling_id: leerling.id,
        totaal,
        opbouw,
      });
    }

    for (const score of scores) {
      await supabase.from('mol_scores').upsert([score]);
    }
    return scores;
  } catch (e) {
    console.error('berekenScoresIntern fout:', e.message);
    return [];
  }
}
```

Netto delta ~80 regels — vervanging van bestaande functie. Function-
header en sluiting blijven gelijk.

### Wat exact wijzigen — reveal.js regel 69-114 (`bouwScoreOpbouw`)

In de `else { /* mol */ }`-tak:

**Vóór (regel 83-90):**
```js
} else {
  for (let r = 1; r <= nRondes; r++) {
    const sab = opbouw['ronde_' + r + '_sabotage'];
    if (sab !== undefined) rijen.push({ label: `Ronde ${r} — sabotage geslaagd`, val: sab });
  }
  const ontm = opbouw['niet_ontmaskerd'];
  if (ontm !== undefined) rijen.push({ label: 'Niet ontmaskerd', val: ontm });
}
```

**Na:**
```js
} else {
  for (let r = 1; r <= nRondes; r++) {
    const ind = opbouw['ronde_' + r + '_individueel'];
    if (ind !== undefined) rijen.push({ label: `Ronde ${r} — individueel antwoord`, val: ind });
  }
  const rol = opbouw['mol_rolbonus'];
  if (rol !== undefined) rijen.push({ label: 'Mol-rolbonus', val: rol });
  for (let r = 1; r <= nRondes; r++) {
    const sab = opbouw['ronde_' + r + '_sabotage'];
    if (sab !== undefined) rijen.push({ label: `Ronde ${r} — sabotage geslaagd`, val: sab });
  }
  const ontm = opbouw['niet_ontmaskerd'];
  if (ontm !== undefined) rijen.push({ label: 'Niet ontmaskerd', val: ontm });
}
```

### Waarom helper apart

`bepaalFoutePerRonde` wordt 1× per ronde aangeroepen, alleen voor de
mol. Een pure helper houdt de mol-tak leesbaar en de helper testbaar
in isolatie indien gewenst.

### Waarom géén feature-flag

De score-spec is een product-beslissing van de PO. Een feature-flag
zou twee parallelle berekeningen vereisen en alle frontend-rendering
verdubbelen. Bij onverwachte regressie: `git revert` is voldoende.

## Verificatie door Reviewer

### Setup
Standaard volgens WORKFLOW.md.

### AC1-AC7: unit-tests
```bash
npm test -- mol-puntentelling-spec
```
**Verwacht:** alle test-cases groen.

### AC8: config-import
```bash
node -e "console.log(require('./lib/scoreConfig'))"
```
**Verwacht:** object met 7 keys met spec-defaults.

### AC9: frontend rendering (handmatig browser-check)
Speel een sessie uit tot reveal. Mol ziet in de eindstand-uitsplitsing
rijen voor:
- "Ronde 1 — individueel antwoord"
- "Mol-rolbonus"
- "Ronde 1 — sabotage geslaagd"
- "Niet ontmaskerd"

### AC10: npm test
```bash
npm test
```
**Verwacht:** alle suites groen.

### AC11: diff-omvang
```bash
git diff --stat main..HEAD
```
**Verwacht:** 5 bestanden zoals genoemd in AC11.

### Cleanup
Standaard env-restore.

## Architect self-check

- [x] **Klein genoeg?** M — vereist ~80 regels server.js, ~10
      reveal.js, ~150 tests. Net binnen M-grens, niet op te splitsen
      zonder halve oplossing in productie.
- [x] **Eén probleem?** Ja: score-berekening volgens spec.
      Configureerbaarheid is randvoorwaarde, niet apart probleem.
- [x] **Acceptatiecriteria testbaar?** Ja, AC1-AC8 + AC10 via npm test,
      AC9 via browser, AC11 via git diff.
- [x] **Welk deel server.js?** Regel 1593-1701 (volledige functie).
      Geen ander deel aangeraakt.
- [x] **Voorwaarde TICKET-021 vermeld?** Ja, in titel + status.

## Vervolgticket-suggestie

**TICKET-023:** admin-UI voor scoreConfig. Eindgebruiker (docent of
beheerder) kan via een admin-paneel de waardes aanpassen per sessie of
globaal. Vereist nieuwe tabel/kolom + UI. Ligt buiten scope nu.
