# MOL-07 — Technische schuld opruimen

**Epic:** Wie is de Mol  
**Rol:** Builder  
**Afhankelijkheid:** MOL-01 t/m MOL-06 moeten allemaal af zijn  
**Geschatte omvang:** 3 wijzigingen × (test + commit) = ~6 commits  
**Referentie:** `docs/mol-architect-analyse.md` sectie 1.6 (twee API versies), bug 6 (fase-systemen)

---

## Context

Na de vorige tickets is de functionaliteit compleet. Dit ticket ruimt technische schuld op die tijdens de analyse is geïdentificeerd. Geen nieuwe features, geen gedragswijzigingen — alleen code verwijderen, documenteren en vereenvoudigen.

---

## Scope van dit ticket: 3 taken

---

### Taak 1 — mol_groepen.fase kolom: kies één systeem

**Bestand:** `server.js` + nieuwe migratie  
**Probleem:** er bestaan twee parallelle fase-systemen (zie bug 6 in de architect-analyse). Systeem A (`mol_sessies.status` + `ronde_fase`) is de werkelijke bron. Systeem B (`mol_groepen.fase`) is nooit bijgewerkt en levert altijd 'briefing' op.

Na MOL-06 gebruikt het dashboard systeem A (via `bepaalGroepStatus`). Systeem B is volledig dood.

**Wat je doet:**
1. Zoek in de hele codebase naar `mol_groepen` + `.fase` of `.ronde_nr` — noteer elke vindplaats
2. Verwijder alle code die `mol_groepen.fase` of `mol_groepen.ronde_nr` leest of schrijft
3. Schrijf migratie `008_mol_groepen_fase_verwijderen.sql`:
   ```sql
   ALTER TABLE mol_groepen DROP COLUMN IF EXISTS fase;
   ALTER TABLE mol_groepen DROP COLUMN IF EXISTS ronde_nr;
   ```
   Noteer bovenaan: `-- Status: nog niet uitgevoerd in productie`
4. Verwijder of intrek migraties 004 en 005 (die deze kolommen toevoegden/constrainden): voeg aan het begin van beide bestanden toe: `-- INGETROKKEN door MOL-07: kolommen verwijderd via migratie 008`

**Let op:** verwijder `mol_groepen.fase` NIET uit de `INSERT`-statements bij sessie aanmaken — die kunnen een `fase`-waarde meesturen. Die hoeft dan alleen niet meer in het schema te bestaan.

**TDD:**
```javascript
// tests/mol-fase-systeem.test.js
// Test: bepaalGroepStatus gebruikt mol_sessies.status, niet mol_groepen.fase
// Test: dashboard-endpoint retourneert fase zonder mol_groepen.fase te lezen
```

**Commit:** `MOL-07: verwijder systeem B (mol_groepen.fase) — migratie 008 + dode code`

---

### Taak 2 — Deprecated API routes documenteren

**Bestand:** `server.js`  
**Probleem:** er bestaan twee families endpoints. De oude routes (zonder `/sessies/` in het pad) zijn deprecated maar nog actief. Ze worden deels nog aangeroepen.

**Wat je doet:**
1. Zoek alle routes in server.js die beginnen met `/api/mol/` maar NIET met `/api/mol/sessies/` of `/api/mol/sessie/` — dit zijn de potentieel deprecated routes
2. Controleer per route: wordt deze nog aangeroepen vanuit `netlify-deploy/`?
   - Ja: laat staan, voeg een `// TODO MOL-07: migreer naar /api/mol/sessies/` commentaar toe
   - Nee: voeg een `// DEPRECATED — niet meer in gebruik` commentaar toe en verwijder de route
3. Schrijf geen nieuwe code — alleen commentaar toevoegen of dode routes verwijderen

**Scope-beperking:** verwijder maximaal 3 routes in dit ticket. Als er meer zijn: stop en rapporteer.

**TDD:**
```javascript
// tests/mol-deprecated-routes.test.js
// Test: verwijderde routes retourneren 404
```

**Commit:** `MOL-07: deprecated API routes — commentaar toegevoegd, dode routes verwijderd`

---

### Taak 3 — localStorage documenteren als uitzondering

**Bestand:** `CLAUDE.md`  
**Probleem:** `speler.js` gebruikt `localStorage` (in `spelerAanmelden()`). Dit is in strijd met de no-localStorage constraint. Het is een bewuste uitzondering die gedocumenteerd moet worden zodat toekomstige builders het niet per ongeluk "fixen".

**Wat je toevoegt** aan `CLAUDE.md`, onder een nieuwe sectie `## Bewuste uitzonderingen op de constraints`:

```markdown
## Bewuste uitzonderingen op de constraints

### localStorage in mol-js/speler.js
`spelerAanmelden()` slaat `mol_speler_id` en `mol_sessie_id` op in localStorage.
Dit is een bewuste uitzondering: spelers kunnen hiermee de app herladen
binnen dezelfde browsersessie zonder opnieuw in te loggen.
Niet verwijderen zonder overleg.
```

**Geen test nodig.** Eén commit:

**Commit:** `MOL-07: documenteer localStorage uitzondering in CLAUDE.md`

---

## Afronden

```
node --check server.js
npm test  → alle tests groen
git log --oneline -10
```

Rapporteer:
- Welke deprecated routes zijn verwijderd (namen)
- Welke TODO-commentaren zijn toegevoegd
- git log + npm test samenvatting

**Dit is het laatste ticket van de epic.**  
Na MOL-07: de architect-analyse bijwerken met `Status: volledig gebouwd` en een end-to-end testprocedure uitvoeren.

---

## Buiten scope

- Nieuwe features — de epic is na dit ticket klaar
- JWT-via-URL-param beveiligen (staat als risico 4 in de analyse — aparte beslissing nodig)
- `bereken-scores` oud endpoint (`POST /api/mol/bereken-scores`) — valt onder deprecated routes taak 2
