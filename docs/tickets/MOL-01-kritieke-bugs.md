# MOL-01 — Kritieke bugs fixen (Bouwblok 0)

**Epic:** Wie is de Mol — leerlingflow end-to-end  
**Rol:** Builder  
**Prioriteit:** Blokkerend — begin hier, niets anders bouwen voordat dit af is  
**Geschatte omvang:** 4 wijzigingen × (1 test + 1 fix + 1 commit) = ~12 commits  
**Referentie:** `docs/mol-architect-analyse.md` — lees dit document eerst volledig

---

## Context voor de builder

De "Wie is de Mol"-epic is een game-based lesvorm. Leerlingen spelen in groepen, beantwoorden economische meerkeuzevragen, en proberen de Mol in hun groep te ontmaskeren. Er zijn al veel schermen en endpoints gebouwd, maar er zitten zeven actieve bugs in de code die de app voor leerlingen onbruikbaar maken.

Dit ticket pakt de vier meest kritieke bugs aan. Dit zijn geen nieuwe features — alleen defecten in bestaande code.

Lees vóór je begint:
1. `docs/mol-architect-analyse.md` — de volledige technische analyse
2. `CLAUDE.md` — werkafspraken en coding-principes
3. De vier bug-secties hieronder, elk met exacte locatie en fix-richting

---

## Epic-brede bouwinstructies

Deze gelden voor dit ticket én alle toekomstige MOL-tickets.

### HTML blijft in HTML, JS blijft in JS
- Schrijf nooit HTML-strings in JavaScript-functies (gebruik `<template>` elementen)
- Uitzonderingen die al bestaan in de codebase: laat staan, maar breidt ze niet uit

### Functies blijven klein
- Maximaal 20-25 regels per functie
- Bij twijfel: splits op in twee functies met elk één verantwoordelijkheid

### TDD — altijd
- Schrijf eerst de test (rood)
- Bevestig dat de test faalt
- Schrijf dan de fix (groen)
- Bevestig dat de test slaagt
- Alle 278 bestaande tests moeten groen blijven

### Commits
- Één commit per bug-fix, niet alles in één keer
- Commit-boodschap: `MOL-01: <wat je hebt gedaan>`
- Vóór elke commit: `node --check` op gewijzigde bestanden

### Escaleer bij twijfel
Stop en rapporteer als:
- Je meer dan één bestand tegelijk wilt aanpassen voor één fix
- Een test faalt die je niet had verwacht
- Je iets tegenkomt dat niet in dit ticket staat

---

## Scope van dit ticket: 4 bug-fixes

---

### Fix 1 — Speler-endpoints vereisen onterecht een JWT

**Bestand:** `server.js`  
**Locatie:** regels ~1860 en ~1969  
**Probleem:** `GET /api/mol/sessies/:id/groep-status` en `GET /api/mol/sessies/:id/discussie-data` zijn beveiligd met `verifyToken`. Spelers hebben geen JWT-token, dus elke poll-aanroep retourneert 401. Spelers hangen daardoor eeuwig op het wacht-scherm.

**Wat je gaat wijzigen:** Verwijder `verifyToken` als middleware van beide routes. Beide endpoints ontvangen al `leerling_id` en `groep_id` via query-params — dat is voldoende als impliciete identificatie voor speler-endpoints.

**Stap 1 — Test schrijven** (in een nieuw testbestand `tests/mol-speler-auth.test.js`):
```javascript
// Test: groep-status endpoint geeft 200 zonder Authorization-header
// Test: discussie-data endpoint geeft 200 zonder Authorization-header
```

**Stap 2 — Fix:**
```
Huidige regel (groep-status):
  app.get('/api/mol/sessies/:id/groep-status', verifyToken, async (req, res) => {

Nieuwe regel:
  app.get('/api/mol/sessies/:id/groep-status', async (req, res) => {
```
Zelfde voor `discussie-data`.

**Stap 3 — Verifieer:** `node --check server.js` → `npm test`  
**Stap 4 — Commit:** `MOL-01: verwijder verifyToken van speler-endpoints groep-status en discussie-data`

---

### Fix 2 — Spelcodes verschijnen niet op het scherm

**Bestand:** `server.js`  
**Locatie:** regel ~2184  
**Probleem:** `POST /api/mol/sessies/:id/genereer-spelcodes` vereist `verifyToken`. Maar `apiFetch` in `mol-js/api.js` stuurt de Authorization-header alleen mee als `docentToken && docentToken !== 'leraar123'`. Als de docent-token de hardcoded fallback is, geeft het endpoint 401 terug en worden de codes nooit getoond.

**Wat je gaat wijzigen:** Vervang `verifyToken` door een controle op `docentCode` in de request body. De `docentCode` is een 4-tekens code die alleen de docent kent (opgeslagen in `mol_sessies.docent_code`). Dit is hoe andere docent-endpoints in de codebase ook werken.

Lees vóór je schrijft: zoek in `server.js` naar een bestaand endpoint dat `docentCode` gebruikt als autorisatie (bijv. `PATCH /api/mol/ronde-fase` rond regel 1225) — volg dat patroon exact.

**Stap 1 — Test schrijven** (in `tests/mol-spelcodes.test.js`):
```javascript
// Test: endpoint geeft 200 met geldige docentCode in body
// Test: endpoint geeft 403 zonder docentCode
// Test: endpoint geeft 403 met foute docentCode
```

**Stap 2 — Fix:** Verwijder `verifyToken` van de route. Voeg binnenin de handler een check toe:
```javascript
const { docentCode } = req.body;
const { data: sessie } = await supabase.from('mol_sessies')
  .select('docent_code').eq('id', req.params.id).single();
if (!sessie || sessie.docent_code !== docentCode) {
  return res.status(403).json({ error: 'Geen toegang' });
}
```

**Stap 3 — Frontend aanpassen** (`netlify-deploy/mol-js/docent-sessie.js`):  
Zoek `genereerSpelcodesEnToon()`. Voeg `docentCode` toe aan de request body:
```javascript
const res = await apiFetch(
  '/api/mol/sessies/' + sessieId + '/genereer-spelcodes',
  { method: 'POST', body: JSON.stringify({ docentCode }) }
);
```
Lees de functie volledig (eerste én laatste regel citeren) vóór je `str_replace` toepast.

**Stap 4 — Verifieer:** `node --check server.js` + `node --check netlify-deploy/mol-js/docent-sessie.js` → `npm test`  
**Stap 5 — Commit:** `MOL-01: fix spelcodes endpoint — verifyToken vervangen door docentCode verificatie`

---

### Fix 3 — Reveal toont altijd "niet geraden"

**Bestand:** `netlify-deploy/mol-js/reveal.js`  
**Locatie:** regel 3  
**Probleem:** `renderSpelerReveal()` zoekt `a.mol_verdachte_id` in de test-antwoorden. Maar `POST /api/mol/sessies/:id/test` slaat het veld op als `verdachte_id` (zonder `mol_`-prefix). Hierdoor is `heeftGeraden` altijd `undefined` — elke speler ziet "Jij had de Mol niet geraden", ongeacht de werkelijkheid.

**Wat je gaat wijzigen:** In `reveal.js` de veldnaam aanpassen zodat beide varianten werken.

Lees vóór je schrijft: de volledige functie `renderSpelerReveal` (regel 1 t/m het einde).

**Stap 1 — Test schrijven** (in `tests/mol-reveal-veld.test.js`):
```javascript
// Test: heeftGeraden is truthy als testAntwoorden[].verdachte_id === mol.id
// Test: heeftGeraden is truthy als testAntwoorden[].mol_verdachte_id === mol.id
// Test: heeftGeraden is falsy als beide velden niet overeenkomen
```

**Stap 2 — Fix:** Pas de zoekconditie aan in `renderSpelerReveal`:
```javascript
// Huidige regel:
const heeftGeraden = testAntwoorden.find(a => a.leerling_id === speler.id && a.mol_verdachte_id === mol?.id);

// Nieuwe regel:
const heeftGeraden = testAntwoorden.find(a =>
  a.leerling_id === speler.id &&
  (a.verdachte_id === mol?.id || a.mol_verdachte_id === mol?.id)
);
```

**Stap 3 — Verifieer:** `node --check netlify-deploy/mol-js/reveal.js` → `npm test`  
**Stap 4 — Commit:** `MOL-01: fix reveal veldnaam — verdachte_id en mol_verdachte_id beide ondersteunen`

---

### Fix 4 — CHECK-constraint in migratie 005 blokkeert toekomstige code

**Bestand:** `migrations/005_mol_groepen_fase_check.sql`  
**Probleem:** De constraint staat fase-waarden toe die de code nooit schrijft (`individueel`, `groep`, `moltest`). De code gebruikt `invoer`, `discussie`, `resultaat`, `test`. Als toekomstige code ooit `mol_groepen.fase` gaat bijwerken, falen alle inserts.

**Wat je gaat wijzigen:** De constraint aanpassen zodat de toegestane waarden overeenkomen met de fase-waarden die `bepaalGroepStatus()` retourneert, plus `briefing` als default.

Lees vóór je schrijft: de volledige `bepaalGroepStatus()` functie in `server.js` (zoek op functienaam) om exact te zien welke fase-strings worden gebruikt.

**Stap 1 — Test schrijven** (in `tests/mol-migratie-005.test.js`):
```javascript
// Test: de SQL van migratie 005 bevat de juiste fase-waarden
// (lees het bestand en check de CHECK-constraint string)
```

**Stap 2 — Fix:** Pas `migrations/005_mol_groepen_fase_check.sql` aan:
```sql
ALTER TABLE mol_groepen
  DROP CONSTRAINT IF EXISTS mol_groepen_fase_check;

ALTER TABLE mol_groepen
  ADD CONSTRAINT mol_groepen_fase_check
  CHECK (fase IN ('briefing', 'invoer', 'discussie', 'resultaat', 'test', 'reveal'));
```

**Let op:** deze migratie is nog niet in productie gedraaid (zie de opmerking bovenaan het bestand). Je past alleen het SQL-bestand aan — je draait de migratie niet zelf. Dat doet Martijn handmatig via het Supabase SQL Editor na jouw commit.

**Stap 3 — Verifieer:** `npm test`  
**Stap 4 — Commit:** `MOL-01: fix migratie 005 — CHECK constraint fase-waarden afstemmen op code`

---

## Afronden

Na alle vier commits:

```
git status   → moet leeg zijn (niets uncommitted)
git log --oneline -5
npm test     → alle tests groen
```

Rapporteer aan Martijn:
- De output van `git log --oneline -5`
- De output van `npm test` (samenvatting: X passing, Y suites)
- Of je iets bent tegengekomen dat niet in dit ticket stond

**Volgende ticket na dit:** MOL-02 — Briefing-fase completeren (scherm 4 + groepshoofd-bekendmaking)

---

## Wat valt buiten scope van dit ticket

- Scherm 4 (groepshoofd bekendmaking) → MOL-02
- Scherm 8 (groepsantwoord bevestiging) → MOL-02
- Puntentelling implementeren → MOL-04
- Mol-test tekstveld verwijderen → MOL-03
- Docent-dashboard fase-weergave → MOL-04
- Docent "groep opnieuw starten"-knop → MOL-04

Stop als je iets tegenkomt dat niet hierboven staat. Rapporteer wat je zag en wacht op instructie.
