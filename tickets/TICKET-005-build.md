# TICKET-005 — Build handoff

**Ticket:** TICKET-005: Deel speler-link knop in docent-dashboard  
**Builder:** Claude (Cowork Builder-sessie)  
**Datum:** 2026-04-25

## Bestanden gewijzigd

- `netlify-deploy/mol-lesvorm.html` — knop toegevoegd in `dashboard-acties`
- `netlify-deploy/mol-js/docent-sessie.js` — `deelSpelerLink()` toegevoegd + addEventListener-binding
- `tests/mol-deel-spelerlink.test.js` — nieuw testbestand (2 tests)
- `scripts/lint-html.js` — hersteld uit git (was pre-existing corrupted met null-bytes)

## Tests

**2 nieuwe tests toegevoegd, alle 414 tests geslaagd** (baseline was 407, TICKET-004).
- `node --check netlify-deploy/mol-js/docent-sessie.js` → OK
- `npm test` → 74 suites, 414 tests, 0 failures

## Self-check acceptatiecriteria

✓ 1. `<button id="btn-deel-spelerlink">` bestaat in `dashboard-acties` (na btn-toon-spelcodes, voor btn-stop-sessie)  
✓ 2. Functie `deelSpelerLink()` bestaat in `docent-sessie.js` en roept `getSpelerUrl()` aan  
✓ 3. `deelSpelerLink()` roept `navigator.clipboard.writeText()` aan met de URL van `getSpelerUrl()`  
✓ 4. Na kopiëren wordt `toast('🔗 Link gekopieerd!')` aangeroepen  
✓ 5. `renderDocentSessie()` bindt de knop via `addEventListener` (patroon identiek aan `btn-toon-spelcodes`)  
✓ 6. Test bevestigt: `clipboard.writeText` aangeroepen met URL eindigend op `?rol=speler`  
✓ 7. Test bevestigt: `toast` aangeroepen met `'🔗 Link gekopieerd!'`  
✓ 8. `npm test` groen — 414 tests geslaagd (>407 baseline)  
✓ 9. `node --check netlify-deploy/mol-js/docent-sessie.js` geeft geen fout  

## Opgemerkt, niet opgepakt

- `scripts/lint-html.js` bevatte pre-existing null-bytes na regel 38 (al zichtbaar in `git diff` vóór start sessie). Hersteld uit git als onderdeel van het opschonen zodat `npm test` volledig groen kon draaien. De inhoud van het script is ongewijzigd — alleen de null-bytes zijn verwijderd.

---

## Commit-instructie voor Martijn

Voer de volgende stappen uit in PowerShell, vanuit de projectmap (`C:\Users\binky\projects\toetsapp-backend`).

**Stap 1 — Open PowerShell in de projectmap**

Klik in Verkenner met de rechtermuisknop op de map `toetsapp-backend` en kies "Open in Terminal" of "Open PowerShell-venster hier". Je ziet dan een prompt die eindigt op `toetsapp-backend>`.

**Stap 2 — Controleer welke bestanden gewijzigd zijn**

```powershell
git status
```

Je verwacht te zien (in rood of groen):
- `modified: netlify-deploy/mol-lesvorm.html`
- `modified: netlify-deploy/mol-js/docent-sessie.js`
- `modified: scripts/lint-html.js`
- `Untracked files: tests/mol-deel-spelerlink.test.js`

Als je iets anders ziet (bijv. meer bestanden rood), stuur dan de output naar de Architect voordat je doorgaat.

**Stap 3 — Stage de gewijzigde bestanden**

```powershell
git add netlify-deploy/mol-lesvorm.html netlify-deploy/mol-js/docent-sessie.js tests/mol-deel-spelerlink.test.js scripts/lint-html.js
```

Je ziet geen output als dit goed gaat.

**Stap 4 — Commit**

```powershell
git commit -m "TICKET-005: deel speler-link knop in docent-dashboard"
```

Je ziet zoiets als:
```
[main abc1234] TICKET-005: deel speler-link knop in docent-dashboard
 4 files changed, 30 insertions(+), 1 deletion(-)
```

**Stap 5 — Bij fout**

Als je een foutmelding krijgt, kopieer die dan letterlijk en stuur hem naar de Architect. Doe zelf geen git reset of git push.
