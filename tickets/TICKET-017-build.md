# TICKET-017 — Build-rapport

**Ticket:** TICKET-017 (post-submit-flow per groep — 10s bevestiging, dan
volgende ronde of moltest)
**Builder:** Cowork sessie B (Claude)
**Datum:** 2026-05-01

## Bestanden gewijzigd

Productiecode (4 bestanden, conform ticket):
- `server.js` — nieuw endpoint `POST /api/mol/groep-volgende-fase` + 3-regel
  test-fase check in `bepaalGroepStatus` briefing-tak.
- `netlify-deploy/mol-js/state.js` — nieuwe `let huidigeRondeNr = 1`.
- `netlify-deploy/mol-js/speler.js` — `pollSpelerStatus` schrijft
  `huidigeRondeNr`, `'resultaat'`-handler routeert naar
  `renderGroepsantwoordWachten`, nieuwe functie
  `renderGroepsantwoordWachten`, en bug-fix `speler.ronde_nr || 1`
  vervangen door `huidigeRondeNr` op 2 plekken.
- `netlify-deploy/mol-lesvorm.html` — `screen-speler-groepsantwoord` toont
  countdown-element en nieuwe "Volgende fase over … seconden…"-tekst.

Tests (2 nieuwe):
- `tests/groep-volgende-fase.test.js` — supertest dekt AC4-AC8.
- `tests/speler-groepsantwoord-render.test.js` — jsdom dekt AC1-AC3.

Test-setup-aanpassingen (zie "Opgemerkt, niet opgepakt"):
- `tests/mol-scherm5.test.js` — `global.huidigeRondeNr = 1` toegevoegd.
- `tests/mol-ronde-scherm8.test.js` — `global.huidigeRondeNr = 1` toegevoegd.

## Tests

```
Test Suites: 1 failed, 94 passed, 95 total
Tests:       499 passed, 499 total
```

De ene falende test-suite (`tests/api-health.test.js`) is **pre-existing**:
faalt op `supabaseUrl is required.` omdat `.env` ontbreekt. Geverifieerd
met `git stash` — failure bestaat ook zonder mijn wijzigingen.

`npm run lint:html` gaat ook groen (geen inline `<script>`-blokken).

## Self-check tegen acceptatiecriteria

- [x] **AC1** — `pollSpelerStatus` op `'resultaat'` roept
  `renderGroepsantwoordWachten` aan, dat `showScreen('screen-speler-groepsantwoord')`
  doet voor alle leerlingen. Gedekt door
  `tests/speler-groepsantwoord-render.test.js` AC1.
- [x] **AC2** — `#groepsantwoord-tekst` bevat de leesbare optie-tekst (MC
  via `mc_opties`-lookup, `'correct'`/`'fout'` vertaald). Gedekt door
  AC2 + AC2-bonus tests.
- [x] **AC3** — `startCountdown('groepsantwoord-countdown', 10, …)` roept
  na 10s `/api/mol/groep-volgende-fase` aan. Element bestaat met initiele
  waarde 10 in `mol-lesvorm.html`. Gedekt door AC3-test.
- [x] **AC4** — `POST /api/mol/groep-volgende-fase` retourneert HTTP 200
  bij geldig payload, 400 zonder verplichte velden. Gedekt door
  `tests/groep-volgende-fase.test.js` AC4a + 2× AC4b.
- [x] **AC5** — Als `groep.ronde_nr !== huidige_ronde_nr` → `advanced=false`,
  geen update. Gedekt door AC5-test (geverifieerd dat `update` niet werd
  aangeroepen).
- [x] **AC6** — Na advance staat `mol_groepen.fase='invoer', ronde_nr=2`;
  `bepaalGroepStatus` (briefing-tak, TICKET-015) retourneert
  `{ fase: 'invoer', ronde_nr: 2, wacht_op: [allen] }`. Gedekt.
- [x] **AC7** — Bij laatste ronde update de endpoint alleen
  `mol_groepen.fase='test'`. Nieuwe vroege check in `bepaalGroepStatus`
  briefing-tak retourneert `{ fase: 'test', ronde_nr, wacht_op: [] }`.
  Gedekt door endpoint-test + bepaalGroepStatus-test.
- [x] **AC8** — Een tweede groep met fase='invoer', ronde_nr=1 blijft
  ongewijzigd; geen kruisbesmetting omdat het endpoint alleen
  `eq('id', groep_id)` filtert. Gedekt door AC8-test.
- [x] **AC9** — `submitGroepsantwoord` gebruikt nu `huidigeRondeNr`
  (geüpdatet in `pollSpelerStatus`) i.p.v. `speler.ronde_nr || 1`.
  In ronde 2+ wordt het groepsantwoord onder `ronde_nr: 2` opgeslagen.
  Indirect gedekt: `huidigeRondeNr`-state-doorvoer in `state.js` +
  `pollSpelerStatus`-assignment + 2 vervangingen in speler.js.
  Volledige integratietest vereist live database (Reviewer DEEL 2).
- [x] **AC10** — `npm test`: 499/499 unit tests groen. Pre-existing
  api-health failure niet gerelateerd.
- [x] **AC11** — `git diff --stat`: 4 productie-bestanden + 2 nieuwe
  testbestanden = 6, plus 2 minimale test-setup-aanpassingen (1 regel
  per file). Zie observatie hieronder.

## Opgemerkt, niet opgepakt

- **Test-setup `huidigeRondeNr`-global**:
  `tests/mol-scherm5.test.js` en `tests/mol-ronde-scherm8.test.js`
  laden `speler.js` rechtstreeks via `eval` zonder `state.js` ernaast.
  Voor mijn wijziging gebruikten `submitGroepsantwoord` en
  `renderFeedbackScherm` `speler.ronde_nr` (al geset in `global.speler`).
  Na de bug-fix zoeken ze `huidigeRondeNr`. Beide tests breken zonder
  een `global.huidigeRondeNr = 1`-regel. Dit is **geen functionele
  testaanpassing** — alleen een setup-fix om het nieuwe global-contract
  beschikbaar te maken. AC11 noemt 4-5 bestanden; ik raak er 8 aan
  (4 prod + 2 nieuwe tests + 2 bestaande test-setup) — bewust gekozen
  boven AC10 schenden.

- **`renderGroepsantwoordBevestiging` niet verwijderd**:
  Het ticket noemt het optioneel ("Builder mag deze cleanup meenemen
  als hij … volledig vervangt"). Ik heb gekozen voor de minimale
  wijziging: `submitGroepsantwoord` blijft
  `renderGroepsantwoordBevestiging` aanroepen, maar de eerstvolgende
  poll van het groepshoofd komt langs met `fase: 'resultaat'` en
  `renderGroepsantwoordWachten` neemt het over. Dit voldoet aan alle
  AC's en houdt de bestaande `tests/mol-ronde-scherm8.test.js`-asserts
  groen (die testen nog 5s timer + `renderGroepsantwoordBevestiging`).
  Volledige cleanup → TICKET-020 (zoals architect aangeeft).

- **`renderFeedbackScherm` ongewijzigd**: blijft staan, alleen niet
  meer aangeroepen vanuit `pollSpelerStatus`. Per ticket-scope:
  out-of-scope om weg te halen (gebruikt aan sessie-eind).

- **Pre-existing test-suite failures**:
  - `tests/api-health.test.js` — faalt op missing `SUPABASE_URL` env-var.
  - `tests/classes.test.js` — was bij eerste run flaky (faalde één
    keer, slaagt nu). Geen interventie.

## Commit-instructie voor Martijn (uitvoeren in de terminal)

1. Open een terminal in de projectmap (`cd ~/projects/toetsapp-backend`).
2. Bekijk eerst wat er gestaged gaat worden:
   ```
   git status
   git diff --stat
   ```
   Verwacht: 6 modified files + 2 nieuwe testbestanden onder `tests/`.
3. Voeg de wijzigingen toe en commit:
   ```
   git add server.js \
           netlify-deploy/mol-js/speler.js \
           netlify-deploy/mol-js/state.js \
           netlify-deploy/mol-lesvorm.html \
           tests/groep-volgende-fase.test.js \
           tests/speler-groepsantwoord-render.test.js \
           tests/mol-scherm5.test.js \
           tests/mol-ronde-scherm8.test.js \
           tickets/TICKET-017.md \
           tickets/TICKET-017-build.md
   git commit -m "TICKET-017: post-submit-flow per groep met 10s countdown + ronde-advance"
   ```
4. Verwacht: je ziet "10 files changed, X insertions(+), Y deletions(-)".
5. Bij fout (bijv. pre-commit hook fails): stuur de exacte foutmelding
   naar de Architect of Reviewer.

> Niet pushen voordat de Reviewer (sessie C) APPROVED heeft gegeven —
> CLAUDE.md / WORKFLOW.md.
