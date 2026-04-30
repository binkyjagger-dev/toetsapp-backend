# TICKET-008: GitHub Actions tests groen krijgen
**Status:** Draft
**Grootte:** M
**Aangemaakt door:** Architect (Claude Chat sessie 30-04-2026)
**Datum:** 2026-04-30

## Doel
Zorgen dat `npm test` op GitHub Actions zonder fouten draait, zodat elke 
push automatisch geverifieerd wordt en falende code nooit ongemerkt naar 
main komt.

## Scope

### Wel
- `tests/api-health.test.js` analyseren: waarom faalt het op `require()`?
- Beslissen tussen twee aanpakken (zie Technische notities)
- De gekozen aanpak implementeren met tests
- GitHub Actions run laten zien: 90/90 test suites slagen, 0 falers

### Niet
- Nieuwe tests schrijven voor functionaliteit die nu nog niet getest is
- `server.js` refactoren buiten de Supabase-client-initialisatie
- Andere CI-stappen toevoegen (Playwright, deploy-checks, etc.)
- Productie-env vars wijzigen

## Acceptatiecriteria
1. [ ] GitHub Actions run op main toont groen vinkje
2. [ ] Output toont: `Test Suites: 90 passed, 90 total` (of meer)
3. [ ] `tests/api-health.test.js` slaagt zonder dat productie-Supabase 
       credentials nodig zijn (alleen test-DB)
4. [ ] `npm test` werkt nog steeds lokaal (niet kapotmaken)
5. [ ] Geen secrets in code of git history terechtgekomen
6. [ ] Bestaande 472 passerende tests blijven slagen

## Bestanden die geraakt worden
Afhankelijk van gekozen aanpak (zie Technische notities):

**Aanpak A (alleen secrets):**
- GitHub Settings → Secrets (geen code-wijziging)
- Eventueel `.github/workflows/test.yml` (extra env-vars)

**Aanpak B (refactor + secrets):**
- `server.js` (regel 21 — Supabase-client lazy maken)
- `tests/api-health.test.js` (mogelijk aanpassen aan nieuwe structuur)
- GitHub Settings → Secrets

## Tests
**Bestaande tests die groen moeten blijven:**
- Alle 89 huidige passerende suites
- Alle 472 huidige passerende tests
- Frontend jsdom-tests (mol-projectie, mol-scherm6, etc.)

**Nieuwe tests:**
- Bij Aanpak B: test dat `require('server.js')` lukt zonder env-vars
- Test dat Supabase-client pas aangemaakt wordt bij eerste DB-call

**Edge cases:**
- Wat als één van de zes secrets wel maar de rest niet gezet is?
- Wat als TEST_DATABASE_URL en SUPABASE_URL beide gezet zijn maar 
  IS_TEST_DATABASE op false staat? (veiligheidsslot)
- Wat als de test-DB tijdelijk onbereikbaar is — falen tests netjes 
  of crasht het hele suite?

## Mockup
N/A (pure infrastructuur)

## Technische notities

### Root cause
`server.js` regel 21 maakt direct bij module-load een Supabase-client:

```js
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_ANON_KEY
);
```

Tests doen `require('../server.js')` → module laadt → Supabase weigert
omdat URL leeg is → suite faalt voor één test gedraaid heeft.

Dit is een "side effect on import" anti-pattern. Het maakt dat **elke** 
test die `server.js` aanraakt, valide DB-credentials nodig heeft, ook 
tests die niets met de DB doen.

### Aanpak A — Snelle fix (alleen secrets)
- 6 GitHub Secrets toevoegen via Settings → Secrets and variables → Actions
- Workflow file pakt ze al op via `${{ secrets.XXX }}`
- Werkt direct, maar onderliggend probleem blijft
- **Risico:** als test-DB ooit kapot/onbereikbaar is, falen ALLE tests, 
  ook de pure unit tests die niets met DB doen

### Aanpak B — Structurele fix (lazy init + secrets)
Supabase-client niet bij module-load, maar achter een functie:

```js
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL, 
      process.env.SUPABASE_ANON_KEY
    );
  }
  return _supabase;
}
```

Alle gebruik van `supabase.from(...)` wordt `getSupabase().from(...)`.

- Tests die DB niet nodig hebben kunnen `require('server.js')` zonder 
  env-vars
- Alleen tests die echt DB raken hebben secrets nodig
- **Risico:** raakt veel regels in `server.js` — moet zorgvuldig in 
  meerdere kleine commits

### Aanbeveling Architect
**Aanpak A nu, Aanpak B als TICKET-009.**

Reden: Aanpak A is een snelle win (10 min werk), brengt CI groen, en 
geeft je vertrouwen dat de pipeline werkt. Aanpak B is groter (raakt 
veel regels in `server.js`) en verdient een eigen ticket met eigen 
review-cyclus.

## Architect self-check
- [x] Is dit klein genoeg? — Aanpak A is XS, Aanpak B is M. Splitsen 
      in TICKET-008 (A) + TICKET-009 (B) houdt het beheersbaar.
- [x] Is dit één probleem, niet twee? — Eén probleem (CI faalt), maar 
      twee mogelijke oplossingen. Architect kiest A voor nu.
- [x] Zijn acceptatiecriteria testbaar? — Ja, "GitHub Actions toont 
      groen vinkje" is binair en zichtbaar.
- [x] Raakt dit server.js? — Aanpak A: nee. Aanpak B: ja, regel 21 + 
      alle gebruik van `supabase`.

## Vervolgticket suggestie
**TICKET-009:** server.js Supabase-client lazy initialiseren (Aanpak B 
hierboven). Te plannen na TICKET-008.
