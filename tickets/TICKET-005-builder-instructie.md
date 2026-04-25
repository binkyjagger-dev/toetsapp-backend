# Builder-instructie: TICKET-005

## Preamble (kopieer dit als eerste bericht in je Builder-sessie)

```
Je bent Builder voor de Stanislascollege Toetsapp backend. Lees eerst:
- /CLAUDE.md
- /WORKFLOW.md
- /tickets/TICKET-005.md (het ticket dat je gaat uitvoeren)

Werk volgens CLAUDE.md:
- Max 50 regels per wijziging, max 3-4 wijzigingen per sessie
- str_replace, nooit hele bestanden herschrijven
- TDD: test eerst (rood), dan code (groen)
- node --check na elke wijziging, npm test na elke werkende stap
- HTML in HTML, JS in JS (template-patroon)

Harde regels:
1. Volg het ticket EXACT. Niks erbij, niks eraf.
2. Als je iets buiten scope tegenkomt: STOP. Rapporteer. Geen fix-onderweg.
3. Geen dependencies toevoegen die niet in het ticket staan.
4. Schrijf een commit-instructie voor Martijn in je handoff-document.
   De Builder voert zelf GEEN git-commando's uit vanuit de sandbox.

Na oplevering lever je:
- Testresultaten (output van npm test)
- Self-check: acceptatiecriteria langslopen met ✓ of ✗
- Commit-instructie voor Martijn (zie handoff-template in WORKFLOW.md)
- Out-of-scope observaties als "Opgemerkt, niet opgepakt:"
```

---

## Context voor de Builder (achtergrond, niet herhalen in preamble)

**Wat er al bestaat (lees dit vóór je begint):**

- `getSpelerUrl()` staat al in `netlify-deploy/mol-js/docent-sessie.js`.
  Zoek de exacte locatie op met grep vóór je schrijft.
- De `dashboard-acties`-div staat in `netlify-deploy/mol-lesvorm.html`.
  Lees het blok volledig voor je str_replace doet.
- Het patroon voor `addEventListener`-binding staat al in `renderDocentSessie()`
  voor `btn-toon-spelcodes` en `btn-stop-sessie`. Kopieer dat patroon exact.
- Bestaand testpatroon: `tests/mol-dashboard-knoppen-dom.test.js`.
  Lees de globals en mocks bovenaan dat bestand — gebruik dezelfde setup.

**Volgorde van wijzigingen (volg dit strikt):**

1. Schrijf eerst `tests/mol-deel-spelerlink.test.js` (rood — tests falen)
2. Voer `npm test -- tests/mol-deel-spelerlink.test.js` uit — bevestig rood
3. HTML-wijziging: knop toevoegen in `dashboard-acties` (str_replace)
4. JS-wijziging 1: `deelSpelerLink()` toevoegen onder `getSpelerUrl()`
5. JS-wijziging 2: `addEventListener`-binding in `renderDocentSessie()`
6. `node --check netlify-deploy/mol-js/docent-sessie.js`
7. `npm test` — alle tests groen

**Wat de test moet bewijzen:**

```javascript
// Test 1 — clipboard wordt aangeroepen met ?rol=speler URL
await deelSpelerLink();
expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
  expect.stringContaining('?rol=speler')
);

// Test 2 — toast wordt daarna aangeroepen
expect(global.toast).toHaveBeenCalledWith('🔗 Link gekopieerd!');
```

**Hoe je window.location mockt in jsdom:**

```javascript
delete window.location;
window.location = { href: 'https://voorbeeld.nl/mol-lesvorm.html?leraar=abc' };
```

**Hoe je clipboard mockt:**

```javascript
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: jest.fn(() => Promise.resolve()) },
  writable: true,
});
```

---

## Handoff-template (invullen na oplevering)

```
Ticket: TICKET-005
Bestanden gewijzigd:
  - netlify-deploy/mol-lesvorm.html
  - netlify-deploy/mol-js/docent-sessie.js
  - tests/mol-deel-spelerlink.test.js (nieuw)
Tests: 2 toegevoegd, alle [X] tests groen

Self-check:
  ✓/✗ 1. btn-deel-spelerlink aanwezig in dashboard-acties
  ✓/✗ 2. deelSpelerLink() bestaat in docent-sessie.js
  ✓/✗ 3. clipboard.writeText aangeroepen met getSpelerUrl()
  ✓/✗ 4. toast('🔗 Link gekopieerd!') aangeroepen
  ✓/✗ 5. addEventListener-binding in renderDocentSessie()
  ✓/✗ 6. Test 1 groen (clipboard.writeText met ?rol=speler)
  ✓/✗ 7. Test 2 groen (toast aangeroepen)
  ✓/✗ 8. npm test groen, geen regressie
  ✓/✗ 9. node --check geeft geen fout

Opgemerkt, niet opgepakt:
  - <observaties hier>

Commit-instructie voor Martijn (uitvoeren in PowerShell):
  1. Open PowerShell en navigeer naar de projectmap:
       cd C:\Users\binky\projects\toetsapp-backend
  2. Voer uit:
       git add netlify-deploy/mol-lesvorm.html netlify-deploy/mol-js/docent-sessie.js tests/mol-deel-spelerlink.test.js tickets/TICKET-005-build.md
       git commit -m "TICKET-005: deel speler-link knop in docent-dashboard"
  3. Verwacht: je ziet "4 files changed, ..."
  4. Bij fout: stuur de exacte foutmelding naar de Architect.
```
