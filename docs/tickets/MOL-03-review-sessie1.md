# MOL-03 — Review Sessie 1

**Ticket:** MOL-03-ronde-cyclus-completeren.md (Fix 1 + Fix 2) + MOL-02 review-herstel  
**Build-verslag:** MOL-03-build-sessie1.md  
**Reviewer:** Claude (Reviewer-sessie)  
**Datum:** 2026-04-25  

---

## Verdict: APPROVED

Alle gereviewde wijzigingen zijn correct. Beide MOL-02 ontbrekende tests zijn nu écht
gedragstests. Fix 1 en Fix 2 van MOL-03 zijn correct geïmplementeerd en getest.
407 passed, 0 failed.

---

## Deel 1 — Code Review

### SCOPE

**✓ Doet de code wat het ticket vraagt?**  
Ja voor de onderzochte scope: MOL-02 review-herstel (T-1 + T-2), MOL-03 Fix 1 en Fix 2.
Fix 3 en Fix 4 zijn bewust niet gebouwd (sessiegrens) — dit is correct gerapporteerd in het
build-verslag.

**✓ Doet de code NIETS wat het ticket niet vraagt?**  
Ja. Geen onnodige toevoegingen aangetroffen buiten de ticketscope.

**✓ Zijn alle acceptatiecriteria van de gereviewde scope afgedekt?**  
Ja — zie statische verificatie hieronder.

---

### KWALITEIT (Simon Willison + CLAUDE.md)

**✓ Code begrijpelijk voor een onervaren developer?**  
`renderGroepsantwoordBevestiging` en `naarVolgendeRondeOfTest` zijn lineair en goed
te volgen. Commentaar op regel 317–318 legt de bewuste keuze voor "gewone spelers via
poll" expliciet vast — dit was gevraagd in het ticket.

**✓ Functies klein (≤20–25 regels)?**  
`naarVolgendeRondeOfTest`: 10 regels ✓  
`renderGroepsantwoordBevestiging`: 9 regels ✓

**✓ Geen premature abstractie?**  
Nee. Beide functies doen precies één ding.

**✓ Wijzigingen < 50 regels per wijziging?**  
Fix 1: ~15 regels in speler.js ✓  
Fix 2: ~10 regels in speler.js (vervanging stub) ✓

**✓ HTML en JS strikt gescheiden (geen HTML-strings in JS)?**  
`renderGroepsantwoordBevestiging` gebruikt uitsluitend `textContent` — geen HTML-strings ✓

---

### TESTS

**✓ MOL-02 T-1 — Badge DOM-gedragstest**  
De nieuwe describe `MOL-02 Fix 2 — renderGroepshoofBekendmaking badge zichtbaarheid`
bouwt een echt jsdom-DOM op, roept `renderGroepshoofBekendmaking` aan met een speler
waarvan `is_groepshoofd` respectievelijk `true` en `false` is, en controleert
`badgeEl.style.display`. Dit is een echte DOM-gedragstest — niet een broncode-inspectie.

Reproductie-check: als de implementatie `badgeEl.style.display = 'block'` altijd
zou zetten (ongeacht `is_groepshoofd`), zou de test voor `false` falen. ✓

**✓ MOL-02 T-2 — Timer-integratietest (lege callback)**  
De test roept `renderGroepshoofBekendmaking` aan, wist de `startPoll`-mock vooraf
(`mockClear`), laat fake timers 10 seconden doorlopen en controleert dat
`global.startPoll` nul keer is aangeroepen. Dit bewijst afdoende dat de lege callback
`() => {}` de poll niet herstart — de poll loopt autonoom door via `initSpelerFlow`.

Reproductie-check: als `startCountdown('groepshoofd-countdown', 10, () => { startPoll(...) })`
in de implementatie zou staan, zou de test falen. ✓

**✓ MOL-03 Fix 1 — pollSpelerStatus spy na eval**  
`global.pollSpelerStatus = jest.fn()` wordt toegewezen nádat `indirectEval(src)` is
uitgevoerd. In de implementatie (regel 327) staat:
```javascript
startCountdown('groepsantwoord-countdown', 5, () => { pollSpelerStatus(); });
```
`pollSpelerStatus` wordt bij iedere aanroep opgezocht in de global scope — niet bij
definitie vastgelegd. De post-eval mock-toewijzing wordt dus wél opgepikt. Test slaagt
en is niet vals-groen: zonder de mock zou de call naar de echte (unmocked) functie
gaan en niet worden vastgelegd. ✓

**✓ MOL-03 Fix 2 — renderSpelerTest signatuur**  
Echte functie op regel 883: `function renderSpelerTest(leerlingen, state)`.  
Aanroep in `naarVolgendeRondeOfTest` (regel 295):
`renderSpelerTest(sessieState.leerlingen, sessieState)` — signatuur klopt ✓

In de test is `renderSpelerTest` gemockt ná eval (`global.renderSpelerTest = jest.fn()`
op regel 42 van mol-ronde-navigatie.test.js). Dezelfde reden als Fix 1: call-time
opzoeken in global scope → mock wordt opgepikt ✓

**✓ npm test groen?**  
407 passed, 0 failed ✓  
De `lint:html` SyntaxError is het pre-existing sandbox null-byte probleem, geen regressie.

---

### STACK-SPECIFIEK

**✓ Vanilla JS (geen frameworks ingeslopen)?**  Ja.  
**✓ Geen hardcoded secrets?**  Ja.  
**✓ Geen breaking API-contracten?**  Geen API-endpoints aangeraakt.

---

### VEILIGHEID

**✓ Geen geheimen in code?**  Correct.  
**✓ Geen nieuwe XSS-vectoren?**  `renderGroepsantwoordBevestiging` gebruikt
uitsluitend `textContent` ✓

---

## Deel 2 — Statische Verificatie

De wijzigingen zijn pure frontend JS en tests. Geen API-endpoints geraakt.
API end-to-end verificatie is niet van toepassing voor deze commits.

**1. `renderGroepsantwoordBevestiging` — definitie én aanroep aanwezig:**
```
301: async function submitGroepsantwoord()
313:   renderGroepsantwoordBevestiging(antwoord);
314:   showScreen('screen-speler-groepsantwoord');
319: function renderGroepsantwoordBevestiging(antwoord)
```
✓ Functiedefinitie op 319, aanroep in submitGroepsantwoord op 313–314.

**2. `naarVolgendeRondeOfTest` bevat geen "Noop":**  
`grep -n "naarVolgendeRondeOfTest\|Noop"` → alleen regel 289 (functiedefinitie),
geen noop-commentaar aanwezig ✓

**3. `npx jest mol-briefing-fase.test.js --verbose` → 15 passed:**  
Uitkomst: 15 passed, 0 failed ✓ (was 12 vóór deze sessie: +3 nieuwe tests)

**4. `npx jest mol-ronde-scherm8.test.js mol-ronde-navigatie.test.js --verbose` → 5 passed:**  
Uitkomst: 5 passed, 0 failed ✓

**5. `npm test` → 407 passed, 0 failed:**  
Bevestigd ✓

---

## Observaties (niet-blokkerend)

### O-1 — `renderSpelerTest` niet expliciet geverifieerd in Fix 2 test

De test `toont screen-speler-test als huidige_ronde === n_rondes` controleert
`showScreen('screen-speler-test')` en `startPoll` niet aangeroepen. Het controleert
**niet** dat `renderSpelerTest` daadwerkelijk is aangeroepen. Als de `renderSpelerTest`-
aanroep uit de implementatie zou verdwijnen, zou de test nog steeds slagen.

De kernbehavior (navigatie naar het juiste scherm) is wél getest. Dit is een kleine
blinde vlek in de testdekking. Aanbeveling voor de volgende sessie: voeg toe aan de
bestaande test:
```javascript
expect(global.renderSpelerTest).toHaveBeenCalledWith([], global.sessieState.sessie ? ... );
```
of een aparte it-block. **Niet blokkerend** — de ticket-eis ("toont scherm 10 als
ronde === n_rondes") is functioneel geverifieerd.

### O-2 — Fix 3 en Fix 4 nog open

Builder heeft dit correct gerapporteerd. Sessie 2 van MOL-03 pakt Fix 3
(scherm 10 vereenvoudigen) en Fix 4 (scherm 6 wacht-status) op.

---

## Samenvatting

| # | Item | Status |
|---|------|--------|
| MOL-02 T-1 | Badge DOM-gedragstest (true/false) | ✓ Correct, écht DOM-gedrag |
| MOL-02 T-2 | Timer-integratietest lege callback | ✓ Correct, bewijst autonome poll |
| MOL-03 Fix 1 | Scherm 8 na submitGroepsantwoord | ✓ Code + 3 tests correct |
| MOL-03 Fix 2 | naarVolgendeRondeOfTest navigatie | ✓ Code + 2 tests correct |
| npm test | 407 passed, 0 failed | ✓ |
| O-1 | renderSpelerTest niet geverifieerd in Fix 2 test | Observatie, niet blokkerend |
| O-2 | Fix 3 + Fix 4 open | Verwacht, sessiegrens |
