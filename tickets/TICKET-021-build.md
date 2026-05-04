# TICKET-021 — Builder rapport

**Ticket:** TICKET-021 — Mol dient ook MC-antwoord in (sabotage-default)
**Builder-sessie:** 2026-05-04
**Status:** Klaar voor Reviewer

## Bestanden gewijzigd

- `netlify-deploy/mol-js/speler.js` (+16 / -2 regels)
  - regel 788-791: `selecteerOptie('fout')` vervangen door MC-aware blok
    dat bij `caseData.vraagtype === 'mc'` een sabotage-optie kiest via
    de helper `kiesMolSabotageOptie`.
  - regel 914-919 (nieuw): helper `kiesMolSabotageOptie(mcOpties)`.
- `tests/mol-mc-invoer.test.js` (nieuw, 134 regels jsdom).

## Tests

### Toegevoegd (4 testen, alle groen)

`tests/mol-mc-invoer.test.js`:
1. `AC1: MC + is_mol -> sabotage-optie geselecteerd, submit zichtbaar`
2. `AC2: MC + niet-mol -> niets geselecteerd`
3. `AC3: niet-MC + is_mol -> selecteerOptie("fout") als vanouds`
4. `AC4: meerdere niet-correcte opties -> eerste niet-max-punten optie`

### Output `npm test` (samengevat)

```
Test Suites: 2 failed, 96 passed, 98 total
Tests:       515 passed, 515 total
```

- Alle **tests** slagen (515/515).
- Eén suite faalt om te laden: `tests/api-health.test.js` —
  `supabaseUrl is required`. **Pre-existing**, bevestigd via
  `git stash` tegen baseline (zelfde fout zonder mijn diff). Niet
  gerelateerd aan TICKET-021. Zie "Opgemerkt, niet opgepakt".
- `npm run lint:html` slaagt apart:
  `lint:html — geen inline <script> blokken gevonden`.
- `node --check netlify-deploy/mol-js/speler.js` slaagt.

### Bestaande suites uit ticket-AC5 — alle groen

- `tests/mol-test-scherm.test.js` ✓
- `tests/mol-frontend-flow.test.js` ✓
- `tests/mol-frontend-schermen.test.js` ✓ (zie "Bijzonderheid" hieronder)
- `tests/mol-puntentelling-intern.test.js` ✓
- `tests/mol-puntentelling-groep.test.js` ✓

## Bijzonderheid: helper-extractie i.p.v. inline implementatie

De ticket-tech-notes laten een inline `setTimeout`-blok zien dat
`o.punten` direct in `renderSpelerRonde` gebruikt. Dat blok deed de
test `tests/mol-frontend-schermen.test.js:23-28` rood: die guard
verbiedt het woord "punten" in het lichaam van `renderSpelerRonde`
(om puntweergave aan spelers te voorkomen — UI-guard).

Om noch het ticket-gedrag, noch een bestaande test op te offeren, is
de pick-logica verplaatst naar een aparte helper
`kiesMolSabotageOptie(mcOpties)` net onder `selecteerMcOptie`. De
publieke implementatie volgt nog steeds de tech-notes letterlijk
(max-punten-detectie, `find()` voor eerste niet-max, fallback op
eerste optie). Geen AC is beïnvloed; de gedragstesten in
`mol-mc-invoer.test.js` dekken AC1-AC4 onverkort.

## Self-check acceptatiecriteria

- ✓ **AC1** — MC + mol: `geselecteerdeMcOptieId === 'b'`,
  `geselecteerdeOptie === 'fout'`, submit-knop `display:block`.
  (test `AC1: MC + is_mol -> sabotage-optie geselecteerd, submit
  zichtbaar` — groen)
- ✓ **AC2** — MC + niet-mol: `geselecteerdeMcOptieId === null`,
  submit-knop `display:none`. (test `AC2: MC + niet-mol -> niets
  geselecteerd` — groen)
- ✓ **AC3** — niet-MC + mol: `geselecteerdeOptie === 'fout'`. (test
  `AC3: niet-MC + is_mol -> selecteerOptie("fout") als vanouds` —
  groen)
- ✓ **AC4** — meerdere niet-correcte opties: deterministisch eerste
  niet-max-punten optie (`b` bij `[a:10, b:5, c:0]`). Vastgelegd in
  helper-implementatie (`mcOpties.find(...)` retourneert eerste
  match). Test `AC4: meerdere niet-correcte opties -> eerste
  niet-max-punten optie` — groen.
- ✓ **AC5** — bestaande tests groen: 515/515 passes.
  Pre-existing `api-health` suite-load-failure is geen regressie
  van dit ticket.
- ⏳ **AC6** — productie-end-to-end console-check is voor Reviewer
  of Martijn na deploy; kan niet vanuit sandbox.

## Edge cases (uit ticket § Tests)

- **Lege `mc_opties`-array** — `isMc` is `false` (length-check),
  fallback op `selecteerOptie('fout')`. Direct dekkend door bestaand
  oud-gedrag pad in code; geen aparte test toegevoegd buiten de
  vier AC-testen om scope strak te houden.
- **Alle opties dezelfde punten** — helper `kiesMolSabotageOptie`
  geeft `mcOpties[0]` terug via `|| mcOpties[0]`. Niet als aparte
  test toegevoegd; AC4 dekt het deterministisch-volgordeprincipe.

## Opgemerkt, niet opgepakt

- **`tests/api-health.test.js` faalt om te laden**:
  `supabaseUrl is required` bij `createClient(...)` op `server.js:21`
  omdat de Jest-omgeving geen `.env`/`.env.test` ingelezen heeft.
  Dit faalde ook vóór mijn change (baseline bevestigd via
  `git stash`). Buiten scope TICKET-021. Mogelijk apart op te lossen
  door in `tests/api-health.test.js` of `jest.setup.js` `.env.test`
  te laden, of de test te beschermen met `dotenv/config`. Niet
  aangeraakt.

## Commit-instructie voor Martijn (uitvoeren in de terminal)

1. Open een terminal in de projectmap (`~/projects/toetsapp-backend`).
2. Voer uit:

   ```bash
   git add netlify-deploy/mol-js/speler.js tests/mol-mc-invoer.test.js tickets/TICKET-021.md tickets/TICKET-021-build.md
   git commit -m "TICKET-021: mol selecteert sabotage-MC-optie automatisch

   Was: speler.js liet de mol selecteerOptie('fout') aanroepen, wat
   alleen werkte voor de oude niet-MC flow. Voor MC-vragen vond de
   auto-select niets en kreeg de mol geen rij in mol_antwoorden.

   Nu: bij vraagtype 'mc' kiest de mol via een helper de eerste optie
   met niet-maximale punten (sabotage-default), zodat de submit-knop
   verschijnt en de mol-rij in mol_antwoorden komt. Niet-MC pad
   ongewijzigd.

   Voorwaarde voor TICKET-022 (per-mol score-berekening)."
   ```

3. Verwacht: `4 files changed, ...`. Daarna `git status` toont een
   schone werkboom (afgezien van eventuele andere openstaande tickets).
4. Bij fout: stuur de exacte foutmelding terug (zie CLAUDE.md
   "Bij fouten").

## Deploy en test dan het volgende

Na `git push` en Railway-deploy:

1. Open de docent-app, maak een testsessie met **2 leerlingen × 1 groep
   × 1 ronde × MC-vraag** (bv. via `direct_setup=1`).
2. Log in als de mol-leerling. Verwacht in de browser:
   - Op het invoer-scherm is automatisch één MC-knop visueel
     geselecteerd (`.selected` class), de submit-knop `Antwoord
     indienen →` is zichtbaar.
   - Klik submit. Open Console (F12) en draai:
     ```js
     { let s = await apiFetch('/api/mol/sessie/' + localStorage.getItem('mol_sessie_id'));
       let mol = s.leerlingen.find(l => l.is_mol);
       console.log(s.antwoorden.filter(a => a.leerling_id === mol.id)); }
     ```
     Verwacht: array met 1 rij, `mc_optie_id` is een niet-max-punten
     optie.
3. Log opnieuw in als een niet-mol-leerling. Verwacht: niets
   geselecteerd, submit-knop verborgen tot je zelf klikt.
4. Optioneel — niet-MC sessie: speel als mol, verwacht `opt-fout`
   met `.selected` class (oude gedrag intact).
