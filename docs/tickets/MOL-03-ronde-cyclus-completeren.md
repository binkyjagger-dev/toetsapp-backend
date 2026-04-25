# MOL-03 — Ronde-cyclus completeren

**Epic:** Wie is de Mol  
**Rol:** Builder  
**Afhankelijkheid:** MOL-02 moet volledig af zijn  
**Geschatte omvang:** 4 wijzigingen × (test + fix + commit) = ~12 commits  
**Referentie:** `docs/mol-architect-analyse.md` sectie 1.3 + sectie 1.5

---

## Context

De ronde-cyclus (schermen 5 t/m 9) is grotendeels gebouwd, maar drie schakels ontbreken:

1. **Scherm 8 (groepsantwoord bevestiging)** wordt nooit getoond. Na het indienen van het groepsantwoord door het groepshoofd navigeert de code niet naar `screen-speler-groepsantwoord`. Gewone spelers zien ook geen bevestiging.

2. **Scherm 9 navigatie-knop** is een stub. `naarVolgendeRondeOfTest()` is een no-op (`// Noop: server bepaalt fase`). De knop "Verder naar ronde X" of "Naar de Mol-test" doet niets.

3. **Scherm 10 (Mol-test UI)** bevat een tekst-argument veld en ronde-keuze knoppen die niet in de spec staan. Beslissing: alleen naam van de verdachte, geen tekst, geen ronde-keuze.

---

## Scope van dit ticket: 4 fixes

---

### Fix 1 — Scherm 8 tonen na groepsantwoord

**Bestanden:** `netlify-deploy/mol-js/speler.js`  
**Probleem:** Na `submitGroepsantwoord()` roept de code niets aan dat scherm 8 toont. Gewone spelers zien scherm 8 ook nooit — zij komen via de poll in de `resultaat`-fase maar scherm 8 (de 5-sec bevestiging) slaan ze over.

**Lees vóór je schrijft:**
1. De volledige functie `submitGroepsantwoord()` in `speler.js`
2. Het HTML-element `screen-speler-groepsantwoord` in `mol-lesvorm.html` — noteer welke element-IDs er in zitten

**Wat je aanpast in `submitGroepsantwoord()`:** voeg na de succesvolle API-aanroep toe:
```javascript
renderGroepsantwoordBevestiging(antwoord);
showScreen('screen-speler-groepsantwoord');
```

**Wat je toevoegt:** functie `renderGroepsantwoordBevestiging(antwoord)` die:
1. De antwoordtekst in het scherm zet
2. De naam van het groepshoofd toont
3. Een 5-seconden countdown start via `startCountdown()` (gebouwd in MOL-02)
4. Na 5 seconden: `pollSpelerStatus()` aanroepen (de poll detecteert dan `fase === 'resultaat'` en toont scherm 9)

**Gewone speler:** `pollSpelerStatus()` handelt `fase === 'resultaat'` al af via `renderFeedbackScherm()`. Scherm 8 toont gewone spelers niet — zij gaan direct naar scherm 9. Dit is het gewenste gedrag (scherm 8 is een bevestiging voor het groepshoofd, niet voor alle spelers). Noteer dit expliciet in een commentaar.

**TDD:**
```javascript
// tests/mol-ronde-scherm8.test.js
// Test: submitGroepsantwoord navigeert naar screen-speler-groepsantwoord
// Test: renderGroepsantwoordBevestiging vult antwoordtekst in
// Test: na 5 seconden wordt pollSpelerStatus aangeroepen
```

**Commit:** `MOL-03: scherm 8 tonen na submitGroepsantwoord — 5-sec bevestiging`

---

### Fix 2 — Scherm 9 navigatie-knop

**Bestand:** `netlify-deploy/mol-js/speler.js`  
**Probleem:** `naarVolgendeRondeOfTest()` is een stub (no-op). De knop op scherm 9 ("Verder naar ronde X →" of "Naar de Mol-test →") doet niets.

**Lees vóór je schrijft:**
1. De volledige functie `naarVolgendeRondeOfTest()` in `speler.js`
2. De functie `renderFeedbackScherm()` — kijk welke variabelen beschikbaar zijn (ronde_nr, n_rondes)

**Wat de knop moet doen:**
- Als de huidige ronde < `sessie.n_rondes`: `showScreen('screen-speler-ronde')` en `startPoll(pollSpelerStatus, 3500)` — de poll detecteert `fase === 'invoer'` voor de nieuwe ronde
- Als de huidige ronde === `sessie.n_rondes`: `showScreen('screen-speler-test')` en `renderSpelerTest()`

**Implementatie:** vervang de stub door:
```javascript
function naarVolgendeRondeOfTest() {
  const ronde = sessieState?.sessie?.huidige_ronde || 1;
  const nRondes = sessieState?.sessie?.n_rondes || 1;
  if (ronde < nRondes) {
    startPoll(pollSpelerStatus, 3500);
  } else {
    renderSpelerTest(sessieState.leerlingen, sessieState);
    showScreen('screen-speler-test');
    clearInterval(pollTimer);
  }
}
```

**TDD:**
```javascript
// tests/mol-ronde-navigatie.test.js
// Test: naarVolgendeRondeOfTest start poll als ronde < n_rondes
// Test: naarVolgendeRondeOfTest toont scherm 10 als ronde === n_rondes
```

**Commit:** `MOL-03: fix naarVolgendeRondeOfTest — vervang stub door navigatie-logica`

---

### Fix 3 — Scherm 10: tekst-argument en ronde-keuze verwijderen

**Bestanden:** `netlify-deploy/mol-lesvorm.html` + `netlify-deploy/mol-js/speler.js`  
**Beslissing:** Mol-test = alleen naam van de verdachte. Geen tekst-argument, geen ronde-keuze. (Zie `docs/mol-architect-analyse.md` vraag 5.)

**Lees vóór je schrijft:**
1. Het HTML-element `screen-speler-test` in `mol-lesvorm.html` — noteer wat er staat
2. De volledige functie `submitTest()` in `speler.js`

**Wijziging 1 — mol-lesvorm.html:** verwijder uit `screen-speler-test`:
- Het tekstveld `test-argument-tekst` (textarea)
- De ronde-keuze sectie (`test-ronde-keuze` + omliggende label)
- De bijbehorende labels

Gebruik `str_replace` — verwijder alleen de betreffende elementen, raak de rest van het scherm niet aan.

**Wijziging 2 — speler.js, `submitTest()`:** verwijder de validatie op het argument:
```javascript
// Verwijder deze regels:
if (arg.length < 20) { err.textContent = 'Beschrijf het argument...'; ... return; }
```
Verwijder ook de `const arg = ...` regel als het argument nergens meer wordt gebruikt.

Pas ook `renderSpelerTest()` aan: verwijder de ronde-keuze rendering (de sectie die `test-ronde-keuze` vult).

**TDD:**
```javascript
// tests/mol-test-scherm.test.js
// Test: submitTest werkt zonder argument-tekst
// Test: submitTest faalt als testVerdachteId niet gezet is
// Test: renderSpelerTest toont alleen verdachte-keuze, geen ronde-keuze
```

**Commit:** `MOL-03: scherm 10 vereenvoudigen — verwijder tekst-argument en ronde-keuze`

---

### Fix 4 — Scherm 6: groepsgenoot-status tonen tijdens wachten

**Bestand:** `netlify-deploy/mol-js/speler.js`  
**Probleem:** Scherm 6 (wacht na indienen) toont al de wacht-chips, maar de status per groepsgenoot (✓ Ingediend / Bezig...) werkt alleen als `alleAntwoorden` beschikbaar is. Controleer of dit correct werkt na de MOL-01 fix (groep-status endpoint nu zonder auth).

**Lees vóór je schrijft:** de sectie in `renderSpelerRonde()` die `faseSrv === 'invoer'` en `mijnAntwoord` reeds ingediend afhandelt (FASE B: "Eigen antwoord ingediend — wachten op anderen").

**Wat je controleert:** de wacht-chips tonen `klaar` class als het antwoord aanwezig is in `alleAntwoorden`. Dit werkt alleen als `alleAntwoorden` de antwoorden van de **eigen groep** bevat. Controleer de filtering in `pollSpelerStatus()`:

```javascript
const alleAntwoorden = antwoorden.filter(
  a => a.ronde_nr === ronde && mijnGroep.some(l => l.id === a.leerling_id)
);
```

Als deze filtering correct aanwezig is: schrijf een test die dit bevestigt en commit.  
Als de filtering ontbreekt of onjuist is: voeg deze toe.

**TDD:**
```javascript
// tests/mol-wacht-scherm6.test.js
// Test: wacht-chips tonen klaar-status voor leerlingen die al hebben ingediend
// Test: wacht-chips tonen bezig-status voor leerlingen die nog niet hebben ingediend
```

**Commit:** `MOL-03: scherm 6 wacht-status — verifieer en test groepsfiltering alleAntwoorden`

---

## Afronden

```
node --check netlify-deploy/mol-js/speler.js
node --check netlify-deploy/mol-lesvorm.html  (via npm run lint:html)
npm test  → alle tests groen
git log --oneline -8
```

**Volgende ticket:** MOL-04 — Puntentelling implementeren

---

## Buiten scope

- Puntentelling (scherm 9 toont "0 punten" totdat MOL-04 klaar is — dat is acceptabel) → MOL-04
- Scherm 11 (wacht-test na Mol-test) → MOL-05
- Reveal eindstand → MOL-05
- Docent-dashboard → MOL-06
