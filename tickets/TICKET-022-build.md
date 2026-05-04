# TICKET-022 — Build-rapport

**Datum:** 2026-05-04
**Builder:** Claude (Cowork sessie B)
**Status:** Klaar voor review

## Bestanden gewijzigd

| Bestand | Status | Regels |
|---|---|---|
| `lib/scoreConfig.js` | nieuw | 11 |
| `server.js` | gewijzigd | regel 14 (require), regel 1594-1715 (functie + helper) |
| `netlify-deploy/mol-js/reveal.js` | gewijzigd | regel 83-96 (mol-tak `bouwScoreOpbouw`) |
| `tests/mol-puntentelling-intern.test.js` | gewijzigd | 6 assertions geüpdatet met "Oud→Nieuw" comments |
| `tests/mol-puntentelling-spec.test.js` | nieuw | 11 testcases (AC1-AC8 + 3 edge-cases) |

`git diff --stat` (modified) toont 3 files; daarnaast 2 nieuwe untracked files in
`lib/` en `tests/` — totaal **5 bestanden zoals AC11**.

## Verificatie vooraf — TICKET-021

Geen `tickets/TICKET-021-review.md` aangetroffen op disk. Commit `828e1be`
(TICKET-021) staat wel in git log. De productie-DB-check
(rij in `mol_antwoorden` per ronde voor mol) kan ik niet uitvoeren vanuit deze
sandbox. **Open punt voor Martijn:** als TICKET-021 nog niet gereviewd
APPROVED is of nog niet gedeployed, course-correct dan op deze build.

## Testresultaten

```
$ npm test (jest --verbose && npm run lint:html)
Test Suites: 1 failed, 98 passed, 99 total
Tests:       526 passed, 526 total

$ npm run lint:html
lint:html — geen inline <script> blokken gevonden
```

De ene falende suite is `tests/api-health.test.js` met
`supabaseUrl is required.` — dit is een **pre-existing** issue (geen `.env` op
deze sandbox). Verifieerd door dezelfde test op `git stash` (HEAD pre-TICKET-022)
te draaien — zelfde failure, dus niet door TICKET-022 veroorzaakt en
out-of-scope.

`tests/mol-puntentelling-spec.test.js` (nieuw): 11/11 groen.
`tests/mol-puntentelling-intern.test.js` (geüpdatet): 6/6 groen.

## Self-check acceptatiecriteria

- ✓ **AC1** — `tests/mol-puntentelling-spec.test.js`
  "AC1: niet-mol groep-bonus +5 correct, -2 fout" passes.
  `opbouw.ronde_1_groep === 5`, `ronde_2_groep === -2`, `ronde_3_groep === 5`.
- ✓ **AC2** — "AC2: rader-bonus = detectivePot/raders" passes.
  `n1.opbouw.mol_geraden === 40`, `n2-n4.opbouw.mol_geraden === 0`
  (detectivePot = 10 + 10×3 = 40, /1 = 40).
- ✓ **AC3** — "AC3: mol indivPunten per ronde" passes.
  Mol koos 'b' (0 pts) elke ronde →
  `ronde_1_individueel = ronde_2 = ronde_3 = 0`. Bevestigt dat mol-MC
  meegerekend wordt (ronde_X_individueel staat in opbouw, los van
  optie-waarde).
- ✓ **AC4** — "AC4: mol rolbonus = MOL_ROLBONUS" passes.
  `m.opbouw.mol_rolbonus === 10`.
- ✓ **AC5** — "AC5: sabotage = 3×foutePerRonde" passes.
  `ronde_1_sabotage = 0`, `ronde_2_sabotage = 0` (groepsantwoord r2 was fout
  maar niet relevant), `ronde_3_sabotage = 3` (1 niet-mol fout × 3).
- ✓ **AC6** — "AC6: niet-ontmaskerd = (1 - raders/nietMol) * pot" passes.
  `m.opbouw.niet_ontmaskerd === 30` voor 1/4. Edge-test "alle raders
  correct" → 0; edge "0 raders" → 40. Allemaal groen.
- ✓ **AC7** — "AC7: eindclamp op 0" passes. Niet-mol met -6 totaal →
  `s.totaal === 0`.
- ✓ **AC8** — "AC8: scoreConfig levert juiste defaults" passes.
  Alle 7 keys verifiëren met spec-defaults.
- ✓ **AC9** — `bouwScoreOpbouw` mol-tak in `reveal.js` 83-96 bevat nu
  `ronde_X_individueel`-rij ("Ronde X — individueel antwoord"),
  `mol_rolbonus`-rij ("Mol-rolbonus"), `ronde_X_sabotage`-rij
  ("Ronde X — sabotage geslaagd") en `niet_ontmaskerd`-rij ("Niet ontmaskerd").
  Niet via geautomatiseerde DOM-test geverifieerd — Reviewer doet
  browser-check.
- ✓ **AC10** — `npm test` (jest) eindigt met 526/526 groen voor de
  TICKET-022-relevante suites; enige falende suite (`api-health.test.js`)
  was al rood vóór TICKET-022 (zie hierboven).
- ✓ **AC11** — `git diff --stat` plus untracked files toont exact 5
  bestanden uit het ticket: `lib/scoreConfig.js` (nieuw), `server.js`,
  `netlify-deploy/mol-js/reveal.js`,
  `tests/mol-puntentelling-intern.test.js` (gewijzigd),
  `tests/mol-puntentelling-spec.test.js` (nieuw).

## Bijgewerkte testcases — `tests/mol-puntentelling-intern.test.js`

| Testcase | Oude waarde | Nieuwe waarde | Spec-formule (TICKET-022) |
|---|---|---|---|
| Test 1 (speler indiv 8pt) | `totaal === 8` | `totaal === 8` (ongewijzigd) | indiv 8 + groep 0 + mol_geraden 0 = 8 |
| Test 2 (speler onbekende optie) | `totaal === 0` | `totaal === 0` (ongewijzigd) | indiv 0 + groep 0 + mol_geraden 0 = 0 |
| Test 3 (2 raders correct) | `totaal === 25` (= 1/2 × 50) | `totaal === 10` | detectivePot/raders = (10 + 10×1)/2 = 10 |
| Test 4 (0 raders, speler) | `totaal === 0` | `totaal === 0` (ongewijzigd) | indiv 0 + groep 0 + mol_geraden 0 (speler raadt fout) = 0 |
| Test 5 (mol, 0 raders) | `totaal === 50` (= 1 × 50) | `totaal === 30` | indiv 0 + rolbonus 10 + sabotage 0 (cases leeg) + niet_ontmaskerd round((1−0/1) × 20) = 30 |
| Test 6 (mol, alle niet-mol raden) | `totaal === 0` (= (1−1/1) × 50) | `totaal === 10` | indiv 0 + rolbonus 10 + sabotage 0 + niet_ontmaskerd round((1−1/1) × 20) = 0 → totaal 10 |

Elke nieuwe waarde staat in de testfile als comment:
`// Oud: X (formule). Nieuw: Y (formule TICKET-022)` — zoals voorgeschreven.

## Out-of-scope observaties

- **`tests/api-health.test.js` faalt al pre-TICKET-022** (missing `.env`). Niet
  opgepakt — buiten scope. Aanbevolen vervolgticket: jest mock voor
  `@supabase/supabase-js` toevoegen aan `api-health.test.js` zodat suite zonder
  `.env` kan draaien.
- **Geen `.env` op deze sandbox** — de Reviewer moet via WORKFLOW.md
  `.env.test` gebruiken. Geen actie van Builder.
- **TICKET-021-review.md ontbreekt** — zie sectie "Verificatie vooraf".

## Commit-instructie voor Martijn (uit te voeren in de terminal)

1. Open een terminal in de projectmap (`/home/martijn/projects/toetsapp-backend`).
2. Voer uit (één regel per blok, in deze volgorde):

   ```
   git add lib/scoreConfig.js
   git add server.js
   git add netlify-deploy/mol-js/reveal.js
   git add tests/mol-puntentelling-intern.test.js
   git add tests/mol-puntentelling-spec.test.js
   git add tickets/TICKET-022.md tickets/TICKET-022-build.md
   ```

3. Verwacht: geen output; je kunt met `git status --short` controleren dat de
   5 code-bestanden plus de 2 ticket-files nu in de staging-area staan
   (regels beginnen met `A` of `M`).

4. Commit:

   ```
   git commit -m "TICKET-022: nieuwe puntenverdeling-spec + scoreConfig"
   ```

5. Verwacht: je ziet "7 files changed, ~XXX insertions(+), ~XX deletions(-)".
   Bij fout (bijv. pre-commit hook): stuur de exacte foutmelding naar de
   Architect.

6. **Niet pushen** vóór de Reviewer-sessie APPROVED heeft gegeven (zie
   WORKFLOW.md §"De loop per feature").
