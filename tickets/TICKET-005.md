# TICKET-005: Deel speler-link knop in docent-dashboard

**Status:** Ready for Build
**Grootte:** XS
**Aangemaakt door:** Architect
**Datum:** 2026-04-25

## Doel

Geef de leraar een knop in het live docent-dashboard waarmee hij de speler-URL
met één klik naar zijn klembord kopieert, zodat hij die aan leerlingen kan
doorgeven of zelf de leerlingflow kan testen.

## Achtergrond

De URL `mol-lesvorm.html?rol=speler` bestaat al en stuurt leerlingen direct naar
het aanmeldscherm (`screen-speler-login`). De functie `getSpelerUrl()` in
`docent-sessie.js` genereert die URL al correct. Wat ontbreekt is een zichtbaar
instappunt vanuit het dashboard: de leraar weet nu niet hoe hij die URL vindt.

## Scope

### Wel
- Knop "Deel speler-link" toevoegen aan `dashboard-acties` in `mol-lesvorm.html`
- Functie `deelSpelerLink()` toevoegen aan `docent-sessie.js` die:
  - `getSpelerUrl()` aanroept
  - de URL naar het klembord kopieert via `navigator.clipboard.writeText()`
  - daarna `toast('🔗 Link gekopieerd!')` aanroept
- Knop koppelen via `addEventListener` in `renderDocentSessie()`, patroon als
  de bestaande knoppen (`btn-toon-spelcodes`, `btn-stop-sessie`)
- Test in `tests/mol-deel-spelerlink.test.js`

### Niet
- QR-code genereren (vervolgticket indien gewenst)
- Projectiescherm wijzigen of activeren
- Spelcodes tonen of wijzigen
- Wijzigingen aan `server.js` of routes

## Acceptatiecriteria

1. [ ] `mol-lesvorm.html`: het element `<button id="btn-deel-spelerlink">` bestaat
       in de `dashboard-acties`-div, naast de bestaande knoppen.
2. [ ] `docent-sessie.js`: de functie `deelSpelerLink()` bestaat en roept
       `getSpelerUrl()` aan.
3. [ ] `deelSpelerLink()` roept `navigator.clipboard.writeText()` aan met de
       waarde die `getSpelerUrl()` retourneert.
4. [ ] Na kopiëren wordt `toast('🔗 Link gekopieerd!')` aangeroepen.
5. [ ] `renderDocentSessie()` bindt de knop via `addEventListener` (patroon
       identiek aan `btn-toon-spelcodes`).
6. [ ] Test bevestigt: `deelSpelerLink()` roept `clipboard.writeText` aan met
       een URL die eindigt op `?rol=speler`.
7. [ ] Test bevestigt: `deelSpelerLink()` roept daarna `toast` aan.
8. [ ] `npm test` is groen — minimaal 407 tests geslaagd (TICKET-004 baseline),
       geen regressie.
9. [ ] `node --check netlify-deploy/mol-js/docent-sessie.js` geeft geen fout.

## Bestanden die geraakt worden

- `netlify-deploy/mol-lesvorm.html` — één `str_replace` in `dashboard-acties`
- `netlify-deploy/mol-js/docent-sessie.js` — twee `str_replace`:
  1. functie `deelSpelerLink()` toevoegen (direct na `getSpelerUrl()`)
  2. `addEventListener`-binding toevoegen in `renderDocentSessie()`
- `tests/mol-deel-spelerlink.test.js` — nieuw testbestand

## Tests

Bestaande tests die groen moeten blijven:
- `tests/mol-dashboard-knoppen-dom.test.js`
- `tests/mol-dashboard-polling-dom.test.js`
- `tests/mol-dashboard-render-dom.test.js`
- Alle overige 407+ tests

Nieuw testbestand `tests/mol-deel-spelerlink.test.js`:
- Gebruik `@jest-environment jsdom`
- Zet globals zoals in `mol-dashboard-knoppen-dom.test.js`
  (`showScreen`, `toast`, `apiFetch`, `sessieCode`, `docentToken`)
- Mock `navigator.clipboard.writeText` als `jest.fn(() => Promise.resolve())`
- Mock `window.location` zodat `getSpelerUrl()` een testbare URL teruggeeft
- Test 1: `deelSpelerLink()` roept `clipboard.writeText` aan met URL
  die eindigt op `?rol=speler`
- Test 2: `deelSpelerLink()` roept `toast` aan met `'🔗 Link gekopieerd!'`

## Mockup

De knop komt als vierde knop in `dashboard-acties`, na "Spelcodes tonen":

```
[ ← Sessielijst ]  [ Spelcodes tonen ]  [ 🔗 Deel speler-link ]  [ Sessie stoppen ]
```

HTML (één regel, str_replace na `btn-toon-spelcodes`):
```html
<button class="btn btn-ghost" id="btn-deel-spelerlink">🔗 Deel speler-link</button>
```

## Technische notities

### Lees vóór je schrijft

1. Lees de `dashboard-acties`-div volledig in `mol-lesvorm.html`.
   Noteer de eerste en laatste regel van het blok.
2. Lees `getSpelerUrl()` volledig in `docent-sessie.js` — eerste en laatste regel.
3. Lees het `btn-toon-spelcodes`-blok in `renderDocentSessie()` volledig.
   Dit is het exacte patroon dat je kopieert voor de nieuwe knop.

### Volgorde van wijzigingen

1. `mol-lesvorm.html`: voeg knop toe in `dashboard-acties` (str_replace)
2. `docent-sessie.js`: voeg `deelSpelerLink()` toe direct onder `getSpelerUrl()`
   (str_replace)
3. `docent-sessie.js`: voeg `addEventListener`-binding toe in
   `renderDocentSessie()` (str_replace)
4. Schrijf `tests/mol-deel-spelerlink.test.js`
5. Draai `node --check` → `npm test`

### clipboard.writeText — async

`navigator.clipboard.writeText()` retourneert een Promise. Gebruik:
```javascript
async function deelSpelerLink() {
  const url = getSpelerUrl();
  await navigator.clipboard.writeText(url);
  toast('🔗 Link gekopieerd!');
}
```

In de test: mock als `jest.fn(() => Promise.resolve())` en gebruik `await`.

### window.location mocken in test

`getSpelerUrl()` gebruikt `window.location.href`. In jsdom stel je dit in via:
```javascript
delete window.location;
window.location = { href: 'https://voorbeeld.nl/mol-lesvorm.html?leraar=abc' };
```
Verwacht resultaat van `getSpelerUrl()`:
`'https://voorbeeld.nl/mol-lesvorm.html?rol=speler'`

## Verificatie door Reviewer

### Criterium 1–5 (code-review)
Lees `mol-lesvorm.html` (dashboard-acties) en `docent-sessie.js`
(`deelSpelerLink`, `renderDocentSessie`). Bevestig aanwezigheid en patroon.

### Criterium 6–7 (API-test)
Geen API-endpoint nodig — puur frontend. Reviewer draait `npm test` en
controleert dat `mol-deel-spelerlink.test.js` groen is.

### Criterium 8–9
```
npm test
node --check netlify-deploy/mol-js/docent-sessie.js
```

## Architect self-check
- [x] Klein genoeg? Ja — 2 str_replace in HTML/JS + 1 nieuw testbestand, ruim
      binnen de 50-regelgrens
- [x] Één probleem? Ja — uitsluitend de "deel link"-knop, niets anders
- [x] Acceptatiecriteria testbaar zonder menselijke oordelen? Ja — alles via
      `npm test` en `node --check`
- [x] Raakt dit server.js? Nee
