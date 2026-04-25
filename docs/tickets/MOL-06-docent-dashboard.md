# MOL-06 — Docent-dashboard completeren

**Epic:** Wie is de Mol  
**Rol:** Builder  
**Afhankelijkheid:** MOL-01 moet af zijn. Mag parallel aan MOL-02 t/m MOL-05 worden gebouwd.  
**Geschatte omvang:** 3 wijzigingen × (test + fix + commit) = ~9 commits  
**Referentie:** `docs/mol-architect-analyse.md` sectie 1.1 (dashboard) + bug 6 (twee fase-systemen)

---

## Context

Het docent-dashboard bestaat (`screen-docent-dashboard`) en heeft een werkend polling-mechanisme (`refreshDashboardData()` elke 4 seconden). Twee problemen:

1. **Groepskaarten tonen altijd "Briefing"** als fase. Het dashboard-endpoint leest `mol_groepen.fase`, maar die kolom wordt nooit bijgewerkt. De werkelijke fase zit in `mol_sessies.status` + `mol_sessies.ronde_fase`.

2. **"Groep opnieuw starten"-knop ontbreekt.** Als een leerling offline gaat (>90 seconden), hangt de groep. De docent heeft een knop nodig om de groep terug te zetten naar het begin van de huidige ronde.

---

## Scope van dit ticket: 3 fixes

---

### Fix 1 — Dashboard toont actuele fase en ronde per groep

**Bestand:** `server.js`  
**Locatie:** `GET /api/mol/sessies/:id/dashboard` (regel ~1870)

**Lees vóór je schrijft:**
1. De volledige handler van `GET /api/mol/sessies/:id/dashboard`
2. De helper-functie `bepaalGroepStatus(sessie_id, groep_id)` — begrijp wat die retourneert

**Probleem:** het endpoint leest `mol_groepen.fase` (altijd 'briefing') in plaats van de werkelijke fase te berekenen.

**Wat je wijzigt:** roep `bepaalGroepStatus()` aan per groep en gebruik de uitkomst in de response.

```javascript
// Vervang de huidige groepen-mapping door:
const groepenMetFase = await Promise.all(
  (groepen || []).map(async g => {
    const status = await bepaalGroepStatus(sid, g.id);
    return {
      id: g.id,
      naam: g.naam,
      fase: status.fase,
      ronde_nr: status.ronde_nr,
      spelers: spelersByGroep[g.id] || [],
    };
  })
);
```

**Let op:** dit doet N parallelle Supabase-aanroepen (één per groep). Bij 6 groepen is dat acceptabel. Gebruik `Promise.all()` zoals hierboven, niet een `for`-loop met `await`.

**TDD:**
```javascript
// tests/mol-dashboard-fase.test.js
// Test: dashboard retourneert werkelijke fase per groep (niet altijd 'briefing')
// Test: dashboard retourneert ronde_nr per groep
// Test: online-status per speler klopt (90-sec timeout)
```

**Commit:** `MOL-06: dashboard toont werkelijke fase via bepaalGroepStatus per groep`

---

### Fix 2 — "Groep opnieuw starten" endpoint

**Bestand:** `server.js`  
**Wat je toevoegt:** nieuw endpoint `POST /api/mol/sessies/:id/groep-herstart`

**Wat het doet:**
1. Verifieert dat de aanvrager de docent is (gebruik `docentCode` in de request body — volg hetzelfde patroon als andere docent-endpoints)
2. Verwijdert alle `mol_antwoorden` van de huidige ronde voor deze groep
3. Verwijdert het eventuele `mol_groep_stemmen` record voor de huidige ronde voor deze groep
4. Retourneert `{ ok: true }`

De huidige ronde lees je via `mol_sessies.huidige_ronde`.

**Request body:**
```json
{ "groep_id": "...", "docentCode": "..." }
```

**Maximale omvang:** 25 regels. Niet meer.

**TDD:**
```javascript
// tests/mol-groep-herstart.test.js
// Test: endpoint verwijdert antwoorden van huidige ronde voor de groep
// Test: endpoint verwijdert groep_stemmen van huidige ronde voor de groep
// Test: endpoint geeft 403 bij foute docentCode
// Test: andere groepen worden niet geraakt
```

**Commit:** `MOL-06: nieuw endpoint POST groep-herstart — wist antwoorden huidige ronde`

---

### Fix 3 — "Groep opnieuw starten" knop in dashboard-frontend

**Bestand:** `netlify-deploy/mol-js/docent-sessie.js`  
**Locatie:** functie `renderGroepskaarten()` — kijk hoe de groepskaarten worden gebouwd

**Lees vóór je schrijft:** de volledige functie `renderGroepskaarten()`.

**Wat je toevoegt:** per groepskaart een knop "↺ Herstart ronde" die:
1. Een `confirm()` dialoog toont: `Groep [naam] terugzetten naar begin van deze ronde?`
2. Bij bevestiging: `POST /api/mol/sessies/:id/groep-herstart` aanroept met `groep_id` en `docentCode`
3. Na succes: `refreshDashboardData()` aanroept

Voeg de knop toe als HTML in de groepskaart-template (gebruik een `<template>` element als die al bestaat, anders voeg je de knop toe via `str_replace` op de bestaande kaart-HTML).

**TDD:**
```javascript
// tests/mol-dashboard-herstart-dom.test.js
// Test: elke groepskaart bevat een herstart-knop
// Test: herstart-knop roept het juiste endpoint aan
```

**Commit:** `MOL-06: dashboard groepskaart — voeg herstart-ronde knop toe`

---

## Afronden

```
node --check server.js
node --check netlify-deploy/mol-js/docent-sessie.js
npm test  → alle tests groen
git log --oneline -8
```

**Volgende ticket:** MOL-07 — Technische schuld opruimen

---

## Buiten scope

- "Sessie stoppen" werkt al (`PATCH /api/mol/sessies/:id/status`) — niet aanpassen
- Spelcodes-scherm werkt al na MOL-01 — niet aanpassen
- Fase-systeem opruimen (mol_groepen.fase kolom) → MOL-07
