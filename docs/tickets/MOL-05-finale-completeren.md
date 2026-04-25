# MOL-05 — Finale completeren

**Epic:** Wie is de Mol  
**Rol:** Builder  
**Afhankelijkheid:** MOL-04 moet volledig af zijn  
**Geschatte omvang:** 3 wijzigingen × (test + fix + commit) = ~9 commits  
**Referentie:** `docs/mol-architect-analyse.md` sectie 1.3 + bug 3

---

## Context

De finale (schermen 10, 11, 12) heeft drie openstaande issues:

1. **Scherm 11 (wacht op Mol-test)** wordt nooit getoond. Na `submitTest()` navigeert de code naar een hergebruikt wacht-scherm (`screen-speler-wacht-briefing`) via een tijdelijk innerHTML-hack. Het echte scherm `screen-speler-wacht-test` bestaat in de HTML maar wordt nooit gebruikt.

2. **Reveal eindstand (scherm 12)** toont geen positie/naam/punten per speler zoals de spec vereist. `renderSpelerReveal()` toont een groepspercentage-balk maar geen gesorteerde eindstand.

3. **Totaalscore per speler** voor de eindstand moet worden berekend als de som van alle `mol_scores` rijen per leerling (inclusief test-bonus).

---

## Scope van dit ticket: 3 fixes

---

### Fix 1 — Scherm 11 correct tonen na Mol-test

**Bestand:** `netlify-deploy/mol-js/speler.js`  
**Locatie:** functie `submitTest()`, het gedeelte na de succesvolle API-aanroep

**Lees vóór je schrijft:** de volledige functie `submitTest()` + het HTML-element `screen-speler-wacht-test` in `mol-lesvorm.html` (noteer welke element-IDs aanwezig zijn).

**Probleem:** na succesvolle test-submit doet de huidige code een innerHTML-hack op `screen-speler-wacht-briefing`. Dit is de verkeerde aanpak.

**Wat je wijzigt:** vervang de innerHTML-hack door:
```javascript
renderWachtTest(sessieState.leerlingen);
showScreen('screen-speler-wacht-test');
startPoll(pollSpelerStatus, 3500);
```

**Wat je toevoegt:** functie `renderWachtTest(leerlingen)` die:
1. De statuslijst per groepsgenoot vult (✓ klaar / bezig...)
2. Gebruikt dezelfde wacht-chip structuur als `updateBriefingWachtGrid()`

`pollSpelerStatus()` handelt al `fase === 'reveal'` af — die branch navigeert naar scherm 12. Dat werkt automatisch zodra alle groepsleden klaar zijn.

**TDD:**
```javascript
// tests/mol-wacht-test.test.js
// Test: submitTest navigeert naar screen-speler-wacht-test (niet screen-speler-wacht-briefing)
// Test: renderWachtTest vult statuslijst met groepsleden
```

**Commit:** `MOL-05: scherm 11 correct tonen via screen-speler-wacht-test`

---

### Fix 2 — Eindstand op scherm 12 (positie / naam / punten)

**Bestand:** `netlify-deploy/mol-js/reveal.js`  
**Locatie:** `renderSpelerReveal()`  
**Spec:** scherm 12 toont per speler: positie, naam, punten. Winnaar krijgt 🥇 badge. Mol krijgt "MOL" tag.

**Lees vóór je schrijft:** de volledige functie `renderSpelerReveal()`.

**Probleem:** de functie toont een groepspercentage-balk maar geen gesorteerde lijst per speler. De eindstand-sectie ontbreekt.

**Data beschikbaar:** de `scoresArr` parameter die wordt meegegeven aan `renderSpelerReveal()` bevat de `mol_scores` rijen. Je moet het totaal per leerling berekenen door de rijen op te tellen.

**Wat je toevoegt** aan het einde van `renderSpelerReveal()`, na de bestaande HTML:

```javascript
// Bereken totaal per leerling
const totaalPerLeerling = {};
scoresArr.forEach(s => {
  totaalPerLeerling[s.leerling_id] = (totaalPerLeerling[s.leerling_id] || 0) + (s.totaal_ronde || 0);
});

// Bouw eindstand: alleen spelers van eigen groep, gesorteerd op punten
const eindstand = mijnGroep
  .map(l => ({ ...l, punten: totaalPerLeerling[l.id] || 0 }))
  .sort((a, b) => b.punten - a.punten);
```

Render de eindstand via een `<template>` element in de HTML (zie CLAUDE.md — HTML in HTML, niet in JS). Gebruik `document.getElementById('reveal-eindstand-template')`.

**HTML-wijziging:** voeg een template toe aan `screen-speler-reveal` in `mol-lesvorm.html`:
```html
<template id="reveal-eindstand-rij-template">
  <div class="eindstand-rij">
    <span class="eindstand-positie"></span>
    <span class="eindstand-naam"></span>
    <span class="eindstand-punten"></span>
    <span class="eindstand-tag" style="display:none;"></span>
  </div>
</template>
<div id="reveal-eindstand-container"></div>
```

**TDD:**
```javascript
// tests/mol-reveal-eindstand.test.js
// Test: eindstand toont spelers gesorteerd op punten (hoogste eerst)
// Test: winnaar (hoogste punten + correct geraden) krijgt 🥇 badge
// Test: mol krijgt "MOL" tag in de eindstand
// Test: eigen groep wordt correct gefilterd
```

**Commit:** `MOL-05: scherm 12 eindstand — gesorteerde lijst positie/naam/punten`

---

### Fix 3 — Totaalscore berekenen voor de reveal

**Bestand:** `server.js`  
**Locatie:** `GET /api/mol/sessies/:id/resultaten` (regel ~2052)  
**Probleem:** het resultaten-endpoint retourneert `scores` uit `mol_scores`, maar er is geen `totaal`-kolom per leerling — alleen `totaal_ronde` per rij. De reveal-frontend heeft een gecumuleerd totaal nodig.

**Lees vóór je schrijft:** de volledige handler van `GET /api/mol/sessies/:id/resultaten`.

**Wijziging:** bereken het totaal per leerling in de response:
```javascript
// Groepeer scores per leerling en tel op
const totaalMap = {};
(scoresData || []).forEach(s => {
  totaalMap[s.leerling_id] = (totaalMap[s.leerling_id] || 0) + (s.totaal_ronde || 0);
});

// Voeg totaal toe aan de scores array
const scoresMetTotaal = Object.entries(totaalMap).map(([leerling_id, totaal]) => ({
  leerling_id, totaal
}));
```

Retourneer `scores: scoresMetTotaal` in de response (vervangt de huidige `scores`).

**TDD:**
```javascript
// tests/mol-resultaten-totaal.test.js
// Test: resultaten-endpoint retourneert totaal per leerling als som van alle rondes
// Test: mol_test punten (ronde_nr: 99) worden meegeteld in het totaal
```

**Commit:** `MOL-05: resultaten-endpoint berekent totaal per leerling over alle rondes`

---

## Afronden

```
node --check server.js
node --check netlify-deploy/mol-js/reveal.js
npm test  → alle tests groen
git log --oneline -8
```

Rapporteer: git log + npm test samenvatting.

**Volgende ticket:** MOL-06 — Docent-dashboard completeren

---

## Buiten scope

- Docent-dashboard → MOL-06
- Technische schuld opruimen → MOL-07
- `winnaar_id` logica (wie wint bij gelijkspel in punten) — huidige implementatie (hoogste score onder correct-geraders) is acceptabel
