# TICKET-004: MOL-03 sessie 2 — Fix 3 (scherm 10) + Fix 4 (scherm 6)

**Status:** Ready for Build
**Grootte:** S
**Aangemaakt door:** Architect
**Datum:** 2026-04-25
**Vervolg op:** MOL-03 sessie 1 (Fix 1 + Fix 2 zijn al gedaan)

## Doel
Scherm 10 (Mol-test) terugbrengen naar de spec (alleen naam van de verdachte,
geen tekst-argument, geen ronde-keuze) en scherm 6 (wachtstatus na indienen)
voorzien van een geteste groepsfiltering.

## Achtergrond
MOL-03 sessie 1 heeft Fix 1 (scherm 8 tonen) en Fix 2 (scherm 9 navigatieknop)
afgerond. Fix 3 en Fix 4 zijn buiten scope gebleven vanwege de sessiegrens.
De lopende teststand is 407 tests groen.

## Scope

### Wel
- Fix 3: uit `mol-lesvorm.html` en `speler.js` het tekst-argument veld en de
  ronde-keuze sectie verwijderen uit scherm 10
- Fix 4: de groepsfiltering in `pollSpelerStatus()` controleren/toevoegen en
  tests schrijven die het gedrag van de wacht-chips op scherm 6 bevestigen

### Niet
- Fix 1 en Fix 2 — al gedaan in sessie 1
- Puntentelling (→ MOL-04)
- Scherm 11, reveal eindstand (→ MOL-05)
- Docent-dashboard (→ MOL-06)
- De `lint:html` SyntaxError die pre-existing is — apart ticket

## Acceptatiecriteria

### Fix 3

1. [ ] `mol-lesvorm.html`: de textarea `test-argument-tekst` is verwijderd
       uit `screen-speler-test`.
2. [ ] `mol-lesvorm.html`: de ronde-keuze sectie (`test-ronde-keuze` + labels)
       is verwijderd uit `screen-speler-test`.
3. [ ] `speler.js`, `submitTest()`: de validatie op het argument-tekstveld
       (min-lengte check + `const arg = ...`) is verwijderd.
4. [ ] `speler.js`, `renderSpelerTest()`: de ronde-keuze rendering is
       verwijderd.
5. [ ] Tests in `tests/mol-test-scherm.test.js` bevestigen:
       - `submitTest()` werkt zonder argument-tekst
       - `submitTest()` faalt als `testVerdachteId` niet gezet is
       - `renderSpelerTest()` toont geen ronde-keuze elementen

### Fix 4

6. [ ] `speler.js`, `pollSpelerStatus()`: de `alleAntwoorden`-filtering
       filtert op zowel `ronde_nr` als `mijnGroep` (eigen groep én ronde).
7. [ ] Tests in `tests/mol-wacht-scherm6.test.js` bevestigen:
       - Wacht-chips tonen `klaar` class voor leerlingen die al hebben ingediend
       - Wacht-chips tonen "bezig..." voor leerlingen die nog niet ingediend hebben

### Algemeen

8. [ ] `npm test` is groen — minimaal 407 tests geslaagd, geen regressie.
9. [ ] `node --check netlify-deploy/mol-js/speler.js` geeft geen fout.

## Bestanden die geraakt worden

- `netlify-deploy/mol-lesvorm.html` — verwijderen uit `screen-speler-test`
- `netlify-deploy/mol-js/speler.js` — `submitTest()`, `renderSpelerTest()`,
  `pollSpelerStatus()` (elk één str_replace per aanpassing)
- `tests/mol-test-scherm.test.js` — nieuw
- `tests/mol-wacht-scherm6.test.js` — nieuw

## Tests

Bestaande tests die groen moeten blijven:
- `tests/mol-ronde-scherm8.test.js` (Fix 1, sessie 1)
- `tests/mol-ronde-navigatie.test.js` (Fix 2, sessie 1)
- Alle overige 407 bestaande tests

Nieuwe tests:
- `tests/mol-test-scherm.test.js` — 3 tests (zie acceptatiecriteria Fix 3)
- `tests/mol-wacht-scherm6.test.js` — 2 tests (zie acceptatiecriteria Fix 4)

## Technische notities

### Fix 3 — lees vóór je schrijft

1. Lees het HTML-blok `screen-speler-test` in `mol-lesvorm.html` volledig.
   Noteer de element-IDs die je gaat verwijderen.
2. Lees `submitTest()` volledig in `speler.js`. Noteer eerste en laatste regel.
3. Lees `renderSpelerTest()` volledig in `speler.js`. Noteer eerste en laatste regel.

Volgorde van wijzigingen:
1. `mol-lesvorm.html`: verwijder textarea `test-argument-tekst` (str_replace)
2. `mol-lesvorm.html`: verwijder sectie `test-ronde-keuze` (str_replace)
3. `speler.js` `submitTest()`: verwijder argument-validatie (str_replace)
4. `speler.js` `renderSpelerTest()`: verwijder ronde-keuze rendering (str_replace)

### Fix 4 — lees vóór je schrijft

1. Lees de sectie in `pollSpelerStatus()` die `alleAntwoorden` opbouwt.
2. Controleer of de filtering al aanwezig is:
   ```javascript
   const alleAntwoorden = antwoorden.filter(
     a => a.ronde_nr === ronde && mijnGroep.some(l => l.id === a.leerling_id)
   );
   ```
   - Aanwezig en correct → schrijf alleen de tests, geen code-wijziging.
   - Ontbreekt of onvolledig → voeg toe via str_replace.

### Commit-instructies voor Martijn

De Builder schrijft na elke werkende stap een commit-instructie in het
handoff-document. Martijn voert deze uit in PowerShell — de Builder doet
geen git-operaties vanuit de sandbox (zie CLAUDE.md §"Na elke sessie").

## Architect self-check
- [x] Klein genoeg? Ja — max 4 str_replace + 2 testbestanden, past in één sessie
- [x] Één probleem, niet twee? Nee — twee fixes, maar ze passen in één sessie (S)
- [x] Acceptatiecriteria testbaar? Ja — via lezen + npm test + node --check
- [x] Raakt dit server.js? Nee — alleen frontend (speler.js + mol-lesvorm.html)
