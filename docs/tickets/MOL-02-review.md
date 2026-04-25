# MOL-02 — Review

**Ticket:** MOL-02-briefing-completeren.md  
**Commit:** dcbe8cd  
**Reviewer:** Claude (Reviewer-sessie)  
**Datum:** 2026-04-25  

---

## Verdict: CHANGES REQUESTED

Twee ticket-vereiste tests ontbreken. De code zelf is correct; het is een testdekking-probleem.

---

## Deel 1 — Code Review

### SCOPE

**✓ Doet de code wat het ticket vraagt?**  
Ja. Alle drie fixes zijn aanwezig: `ronde_1`-branch in `pollSpelerStatus`, nieuwe `renderGroepshoofBekendmaking`-functie, en verwijdering van de `gh-wacht-grid`-sectie uit `updateBriefingWachtGrid`.

**✓ Doet de code NIETS wat het ticket niet vraagt?**  
Bijna. Er is één toevoeging buiten de tickettekst: de variabele `bekendmakingGetoond` (geïnitialiseerd in `initSpelerFlow`, gecontroleerd in `renderGroepshoofBekendmaking`). Dit is een juiste guard die dubbele rendering voorkomt — functioneel noodzakelijk, verklaarbaar vanuit de architectuur. Geen bezwaar.

**✓ Zijn alle drie fixes aanwezig?**  
Ja. Diff bevestigt: +6 regels voor Fix 1, −11/+0 voor Fix 3, +22 regels voor Fix 2.

---

### KWALITEIT (Simon Willison + CLAUDE.md)

**✓ Code begrijpelijk voor een onervaren developer?**  
Ja. Functies hebben beschrijvende namen, logica is lineair en goed te volgen.

**✓ Functies klein (≤20-25 regels)?**  
`startCountdown`: 8 regels ✓  
`renderGroepshoofBekendmaking`: 12 regels ✓

**✓ Geen premature abstractie?**  
Nee. `startCountdown` afsplitsen was expliciet gevraagd in het ticket.

**✓ Wijzigingen < 50 regels per wijziging?**  
Commit bevat 41 toegevoegde regels in speler.js ✓

**✓ HTML en JS strikt gescheiden (geen HTML-strings in JS)?**  
`renderGroepshoofBekendmaking` gebruikt uitsluitend `textContent` en `style.display` — geen HTML-strings gebouwd in JS ✓  
*(Opmerking: `updateBriefingWachtGrid` gebruikt pre-existing `insertAdjacentHTML` — dit is buiten scope van MOL-02 en niet geïntroduceerd door deze commit.)*

---

### TESTS

**✗ Tests toegevoegd voor alle nieuwe logica?**  
Niet volledig. Zie uitwerking hieronder.

**✗ Dekken de tests de drie fixes?**  
Fix 1: code-inspectie-tests aanwezig ✓  
Fix 2: gedeeltelijk — zie bevindingen T-1 en T-2  
Fix 3: code-inspectie-test aanwezig ✓

**✗ Edge cases getest (element bestaat niet, is_groepshoofd false, countdown 0)?**  
- `startCountdown` met niet-bestaand element: ✓ getest  
- `is_groepshoofd === false` (badge verborgen): ✗ niet als DOM-gedragstest aanwezig  
- `is_groepshoofd === true` (badge zichtbaar): ✗ niet als DOM-gedragstest aanwezig

**✓ Tests leesbaar zonder extra uitleg?**  
Ja. Beschrijvingen zijn helder, opbouw per fix is logisch.

**✓ npm test groen?**  
399 passed, 0 failed ✓  
*(De `lint:html`-fout is een pre-existing sandbox-omgevingsprobleem: `scripts/lint-html.js` bevat na mounting null-bytes aan het einde. De commit zelf bevat de correcte 1086-byte versie zonder null-bytes. Dit is geen regressie van MOL-02.)*

---

### STACK-SPECIFIEK

**✓ Vanilla JS (geen frameworks ingeslopen)?**  
Ja.

**✓ Geen nieuwe globale variabelen buiten bestaand patroon?**  
`bekendmakingGetoond` volgt hetzelfde patroon als `briefingGedrukt`, `briefingGerenderd` etc. ✓

**✓ startCountdown volgt het patroon uit het ticket exact?**  
Ja, byte-voor-byte identiek aan het ticketpatroon.

---

### VEILIGHEID

**✓ Geen geheimen in code?**  
Correct.

**✓ Geen nieuwe XSS-vectoren (textContent i.p.v. innerHTML)?**  
`renderGroepshoofBekendmaking` gebruikt uitsluitend `textContent` en `style.display` ✓

---

## Deel 2 — Statische Verificatie

**1. `fase === 'ronde_1'` staat vóór `fase === 'invoer'`?**  
✓ Bevestigd. Regel 137: `if (fase === 'ronde_1')`, regel 143: `if (fase === 'invoer')`.

**2. `renderGroepshoofBekendmaking` bevat de vereiste elementen?**  
✓ Bevestigd:
- `groepshoofd-naam` → regel 535: `document.getElementById('groepshoofd-naam')`
- `groepshoofd-eigen-badge` → regel 536: `document.getElementById('groepshoofd-eigen-badge')`
- `groepshoofd-countdown` → via `startCountdown('groepshoofd-countdown', 10, ...)`

**3. `startCountdown` volgt het ticket-patroon (setInterval, resterend--, clearInterval)?**  
✓ Bevestigd. Implementatie is identiek aan het voorgeschreven patroon.

**4. `updateBriefingWachtGrid` bevat geen referentie naar `gh-wacht-grid`?**  
✓ Bevestigd. `grep -n "gh-wacht-grid" speler.js` geeft geen output.

**5. `screen-speler-groepshoofd-bekendmaking` bestaat in mol-lesvorm.html met child-elementen?**  
✓ Bevestigd (regels 1212–1220):
- `id="screen-speler-groepshoofd-bekendmaking"` aanwezig
- `id="groepshoofd-naam"` aanwezig (r1216)
- `id="groepshoofd-eigen-badge"` aanwezig (r1217)
- `id="groepshoofd-countdown"` aanwezig (r1220)

**6. npm test: 399 passed, 0 failed?**  
✓ Bevestigd.

---

## Bevindingen die CHANGES REQUESTED rechtvaardigen

### T-1 — Badge-gedrag niet als DOM-test geverifieerd

**Gefaald checklist-item:** Tests → Edge cases getest (is_groepshoofd false, is_groepshoofd true)

**Ticket-eis:**
```javascript
// Test: badge is zichtbaar als speler.is_groepshoofd === true
// Test: badge is verborgen als speler.is_groepshoofd === false
```

**Wat er staat:** Alleen een code-inspectie-test:
```javascript
it('renderGroepshoofBekendmaking behandelt is_groepshoofd badge', () => {
  expect(src).toContain('groepshoofd-eigen-badge');
});
```

Dit verifieert dat de element-ID in de broncode staat, maar **niet** dat `style.display` correct wordt gezet op basis van `speler.is_groepshoofd`. De daadwerkelijke DOM-gedragstest ontbreekt.

**Reproductie:** Zet in de implementatie `badgeEl.style.display = 'block'` (altijd zichtbaar, ongeacht `is_groepshoofd`) — de bestaande test slaagt nog steeds. De bug wordt niet ontdekt.

**Wat toegevoegd moet worden:** Een DOM-test in de `startCountdown`-describe of een aparte describe, die het DOM opzet, `renderGroepshoofBekendmaking` aanroept met `speler.is_groepshoofd = true` resp. `false`, en controleert of `badgeEl.style.display` de juiste waarde heeft.

---

### T-2 — Timer-integratietest ontbreekt

**Gefaald checklist-item:** Tests → Dekken de tests de drie fixes (Fix 1 na-10-seconden-gedrag)

**Ticket-eis:**
```javascript
// Test: na 10 seconden navigeert scherm 4 automatisch verder (timer mock)
```

**Wat er staat:** De `startCountdown`-utility wordt getest in isolatie (callback wordt aangeroepen na N tikken). Maar de integratie — dat `renderGroepshoofBekendmaking` na 10 seconden de poll herneemt — is niet getest.

**Context:** De implementatie gebruikt een lege callback `() => {}`. De poll draait autonoom door via `startPoll(pollSpelerStatus, 3500)` en detecteert vanzelf de fase-overgang. Dit is functioneel correct, maar impliciet — de test "na 10 seconden navigeert scherm 4 automatisch verder" bevestigt dit gedrag niet.

**Reproductie:** Er is geen test die valideert dat `pollSpelerStatus` (of een stub ervan) inderdaad wordt aangeroepen nadat de countdown afloopt.

**Wat toegevoegd moet worden:** Een test die:
1. `renderGroepshoofBekendmaking` aanroept
2. De fake timer 10 seconden laat doorlopen (`jest.advanceTimersByTime(10000)`)
3. Verifieert dat de poll herneemt — ofwel via een spy op `startPoll`, ofwel door te controleren dat de callback van `startCountdown` een poll-aanroep triggert

*(Opmerking voor de Builder: als de beslissing is dat de lege callback-aanpak de juiste architecturale keuze is — omdat de poll nooit stopt — dan moet dat gedrag expliciet getest worden: de poll loopt door terwijl scherm 4 getoond wordt.)*

---

## Samenvatting

| # | Item | Status |
|---|------|--------|
| T-1 | Badge DOM-gedragstest (is_groepshoofd true/false) | ✗ Ontbreekt |
| T-2 | Timer-integratietest na 10 seconden | ✗ Ontbreekt |
| Overig | Alle code-checks, statische verificatie, npm test | ✓ |

De drie fixes zijn correct geïmplementeerd. De kwaliteit van de code is goed. De twee ontbrekende tests zijn klein en te schrijven zonder de implementatie te wijzigen.
