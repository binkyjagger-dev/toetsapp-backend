# MOL-01 — Review-instructie

**Epic:** Wie is de Mol — leerlingflow end-to-end  
**Rol:** Reviewer — rapporteer alleen, wijzig geen code  
**Ticket:** `docs/tickets/MOL-01-kritieke-bugs.md`  
**Commits:** 4 (zie `git log --oneline -5`)

---

## Context voor de reviewer

Bouwblok 0 van de "Wie is de Mol"-epic is afgerond. Dit ticket paste vier kritieke bugs aan die de app voor leerlingen onbruikbaar maakten. Geen nieuwe features — alleen defecten in bestaande code.

Lees vóór je begint:
1. `docs/tickets/MOL-01-kritieke-bugs.md` — de volledige scope en acceptatiecriteria
2. `docs/mol-architect-analyse.md` sectie 1.2 (bugs 1, 2, 3 en 6) — de technische achtergrond

---

## Wat er is gewijzigd

### Fix 1 — `server.js` (regels ~1860 en ~1969)
`verifyToken` verwijderd als middleware van twee speler-endpoints:
- `GET /api/mol/sessies/:id/groep-status`
- `GET /api/mol/sessies/:id/discussie-data`

**Testbestand:** `tests/mol-speler-auth.test.js` (2 tests)

### Fix 2 — `server.js` (regel ~2184) + `netlify-deploy/mol-js/docent-sessie.js`
`genereer-spelcodes` endpoint: `verifyToken` vervangen door `docentCode`-verificatie in de request body. Frontend stuurt `docentCode` nu mee in de POST-body.

**Testbestand:** `tests/mol-spelcodes.test.js` (3 tests)

### Fix 3 — `netlify-deploy/mol-js/reveal.js` (regel 6)
`heeftGeraden`-conditie uitgebreid: controleert nu `a.verdachte_id || a.mol_verdachte_id` in plaats van alleen `a.mol_verdachte_id`.

**Testbestand:** `tests/mol-reveal-veld.test.js` (3 tests)

### Fix 4 — `migrations/005_mol_groepen_fase_check.sql`
CHECK constraint aangepast: `individueel`, `groep`, `moltest` vervangen door `invoer`, `discussie`, `resultaat`, `test` — de waarden die `bepaalGroepStatus()` daadwerkelijk retourneert.

**Testbestand:** `tests/mol-migratie-005.test.js` (6 tests)

---

## Wat de reviewer moet controleren

### 1. Scope-naleving
- Zijn er wijzigingen buiten de vier beschreven fixes? Controleer de diff van elke commit:
  ```
  git show 7b4eb97 --stat
  git show 7f3c2f3 --stat
  git show a61e642 --stat
  git show 7009976 --stat
  ```
- Zijn er bestanden gewijzigd die niet in het ticket staan?

### 2. Correctheid Fix 1
- Beide routes hebben geen `verifyToken` meer — maar zijn ze nog adequaat beveiligd? De architect-analyse zegt dat `leerling_id` + `groep_id` als impliciete identificatie voldoende is voor speler-endpoints. Is dat hier het geval?
- Zijn er andere speler-endpoints in `server.js` met hetzelfde probleem die over het hoofd zijn gezien?

### 3. Correctheid Fix 2
- Volgt de `docentCode`-verificatie exact hetzelfde patroon als andere docent-endpoints (bijv. `PATCH /api/mol/ronde-fase` rond regel 1225)?
- Wat gebeurt er als `docentCode` ontbreekt in de body — geeft het endpoint dan 403? Controleer de logica.
- Stuurt `genereerSpelcodesEnToon()` in `docent-sessie.js` de `docentCode` correct mee? Is `docentCode` op dat moment in scope als variabele?

### 4. Correctheid Fix 3
- Zijn er andere plekken in `reveal.js` of andere bestanden waar `mol_verdachte_id` wordt opgezocht in `testAntwoorden`, maar de nieuwe `verdachte_id` niet? (Zoek op `mol_verdachte_id` in de codebase.)
- Is de fix backward-compatible: werkt het nog als een oud sessie-record alleen `mol_verdachte_id` bevat?

### 5. Correctheid Fix 4
- Bevat de aangepaste constraint alle fase-waarden die `bepaalGroepStatus()` kan retourneren? Lees de functie (server.js, zoek op `bepaalGroepStatus`) en tel de terugkeerwaarden.
- Is `reveal` toegevoegd als geldige fase? (De functie retourneert ook `reveal`.)
- Let op: deze migratie is nog **niet** in productie gedraaid. Rapporteer of het SQL correct is voor productie-uitvoering.

### 6. Testkwaliteit
- Testen de tests het gedrag (zwart-doos), of alleen de aanwezigheid van tekst in de broncode?
- Zouden de tests ook slagen als de fix per ongeluk ongedaan zou worden gemaakt? (Zouden ze dan falen?)
- Zijn er scenario's die de tests missen — bijv. wat als `docentCode` leeg is, of wat als beide velden `null` zijn in de reveal-test?

### 7. Niet-gewijzigde bugs
Het ticket laat vier bugs buiten scope (MOL-02 t/m MOL-04). Controleer of de builder daar niet toch iets aan heeft geraakt:
- Scherm 4 groepshoofd-bekendmaking (`speler.js`) — ongewijzigd?
- `naarVolgendeRondeOfTest()` stub — ongewijzigd?
- `submitTest()` argument-validatie — ongewijzigd?

---

## Acceptatiecriteria uit het ticket

Controleer of deze bereikt zijn (op basis van code, niet door de app te draaien):

- [ ] `genereer-spelcodes` endpoint is bereikbaar zonder JWT, met `docentCode` als toegangscontrole
- [ ] `groep-status` en `discussie-data` endpoints geven geen 401 meer voor aanroepen zonder Authorization-header
- [ ] `heeftGeraden` in `reveal.js` is `truthy` als `testAntwoorden[].verdachte_id === mol.id`
- [ ] `migrations/005` constraint staat `invoer`, `discussie`, `resultaat`, `test` toe

---

## Wat de reviewer **niet** doet

- Geen code wijzigen
- Geen `git commit` of `git push`
- Geen npm-commando's draaien
- Geen oordeel vellen over MOL-02 t/m MOL-06 scope

Rapporteer bevindingen als een genummerde lijst: bevinding, ernst (blokkend / aandachtspunt / opmerking), en betrokken bestand + regelnummer.
