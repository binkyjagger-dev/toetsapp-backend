# MOL-02 — Briefing-fase completeren

**Epic:** Wie is de Mol  
**Rol:** Builder  
**Afhankelijkheid:** MOL-01 moet volledig af zijn (npm test groen)  
**Geschatte omvang:** 3 wijzigingen × (test + fix + commit) = ~9 commits  
**Referentie:** `docs/mol-architect-analyse.md` sectie 1.3 (ontbrekende functies) + sectie 1.5 (fase-machine)

---

## Context

Na de briefing-fase worden twee dingen verwacht die nu niet werken:

1. **Scherm 4 (groepshoofd bekendmaking)** wordt nooit getoond. Het HTML-element bestaat (`screen-speler-groepshoofd-bekendmaking`) maar `pollSpelerStatus()` navigeert er nooit naartoe.

2. **Fase-overgang na briefing hangt.** Als alle leerlingen `briefing-start` hebben ingediend, retourneert `bepaalGroepStatus()` de waarde `'ronde_1'`. Maar `pollSpelerStatus()` heeft geen branch voor `fase === 'ronde_1'` — de speler blijft hangen op het wacht-scherm.

3. **Scherm 3 wacht-grid** (status per groepsgenoot klaar/bezig) werkt deels, maar de update-functie `updateBriefingWachtGrid` heeft een bug: hij probeert `#gh-wacht-grid` te updaten, maar dat element bestaat niet in de HTML.

---

## Scope van dit ticket: 3 fixes

---

### Fix 1 — Fase `ronde_1` wordt niet afgehandeld in pollSpelerStatus

**Bestand:** `netlify-deploy/mol-js/speler.js`  
**Probleem:** `bepaalGroepStatus()` retourneert `fase: 'ronde_1'` zodra iedereen de briefing heeft afgerond. `pollSpelerStatus()` heeft geen `if (fase === 'ronde_1')` branch. De speler hangt.

**Lees vóór je schrijft:** de volledige functie `pollSpelerStatus()` in `speler.js` (zoek op functienaam, lees tot het einde).

**Wat je toevoegt:** een branch die scherm 4 toont en na 10 seconden automatisch poll herneemt richting `invoer`.

```javascript
if (fase === 'ronde_1') {
  // Scherm 4 tonen — groepshoofd bekendmaking
  renderGroepshoofBekendmaking(leerlingen, sessieState);
  showScreen('screen-speler-groepshoofd-bekendmaking');
  return;
}
```

Voeg deze branch toe **vóór** de `if (fase === 'invoer')` branch.

**TDD:**
```javascript
// tests/mol-briefing-fase.test.js
// Test: pollSpelerStatus toont scherm 4 als fase === 'ronde_1'
// Test: na 10 seconden navigeert scherm 4 automatisch verder (timer mock)
```

**Commit:** `MOL-02: pollSpelerStatus handelt fase ronde_1 af — toont scherm 4`

---

### Fix 2 — Render-functie voor scherm 4 (groepshoofd bekendmaking)

**Bestand:** `netlify-deploy/mol-js/speler.js`  
**Probleem:** Er bestaat geen `renderGroepshoofBekendmaking()` functie. Het HTML-scherm `screen-speler-groepshoofd-bekendmaking` heeft de volgende elementen (zie `mol-lesvorm.html`):

Lees vóór je schrijft: zoek `screen-speler-groepshoofd-bekendmaking` in `mol-lesvorm.html` en noteer welke element-IDs aanwezig zijn.

**Wat je schrijft:** een functie die:
1. De naam van het groepshoofd in het scherm zet
2. De badge "Jij bent het groepshoofd!" toont als `speler.is_groepshoofd === true`
3. Een countdown van 10 seconden start via `setInterval`
4. Na 10 seconden de poll hervat (geen `showScreen` aanroep — de poll detecteert de nieuwe fase)

Maximaal 20 regels. Splits de countdown af in een aparte hulpfunctie `startCountdown(elementId, seconden, callback)` als dat de hoofdfunctie boven de 20 regels brengt.

**Patroon voor countdown** (volg dit exact):
```javascript
function startCountdown(elementId, seconden, callback) {
  let resterend = seconden;
  const el = document.getElementById(elementId);
  if (el) el.textContent = resterend;
  const timer = setInterval(() => {
    resterend--;
    if (el) el.textContent = resterend;
    if (resterend <= 0) { clearInterval(timer); callback(); }
  }, 1000);
}
```

**TDD:**
```javascript
// Test: renderGroepshoofBekendmaking vult groepshoofd-naam in het DOM
// Test: badge is zichtbaar als speler.is_groepshoofd === true
// Test: badge is verborgen als speler.is_groepshoofd === false
// Test: startCountdown roept callback aan na N tikken
```

**Commit:** `MOL-02: voeg renderGroepshoofBekendmaking toe met countdown`

---

### Fix 3 — Scherm 3: gh-wacht-grid element bestaat niet

**Bestand:** `netlify-deploy/mol-js/speler.js` + `netlify-deploy/mol-lesvorm.html`  
**Probleem:** `updateBriefingWachtGrid()` probeert `document.getElementById('gh-wacht-grid')` te updaten. Dit element bestaat niet in `mol-lesvorm.html`. De functie faalt stil.

**Lees vóór je schrijft:**
1. De volledige functie `updateBriefingWachtGrid()` in `speler.js`
2. Het HTML-element `screen-speler-wacht-briefing` in `mol-lesvorm.html`

**Optie A** (aanbevolen): verwijder de `gh-wacht-grid` sectie uit `updateBriefingWachtGrid()` als dat element nergens nodig is.  
**Optie B**: voeg `id="gh-wacht-grid"` toe aan het juiste element in `mol-lesvorm.html`.

Kies de optie die de minste wijzigingen vereist. Als je twijfelt: kies optie A en stop.

**TDD:**
```javascript
// Test: updateBriefingWachtGrid gooit geen fout als gh-wacht-grid niet bestaat
// Test: briefing-wacht-grid wordt correct gevuld met klaar/bezig status
```

**Commit:** `MOL-02: fix updateBriefingWachtGrid — verwijder referentie naar niet-bestaand gh-wacht-grid`

---

## Afronden

```
node --check netlify-deploy/mol-js/speler.js
npm test  → alle tests groen
git log --oneline -5
```

Rapporteer: git log output + npm test samenvatting + eventuele escalaties.

**Volgende ticket:** MOL-03 — Ronde-cyclus completeren

---

## Buiten scope

- Scherm 8 (groepsantwoord bevestiging) → MOL-03
- Puntentelling → MOL-04
- Docent-dashboard fase-weergave → MOL-06
