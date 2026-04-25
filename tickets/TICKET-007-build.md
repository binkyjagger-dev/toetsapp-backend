# TICKET-007 — Build-rapport

**Ticket:** TICKET-007 (Finale completeren — scherm 11 + scherm 12)  
**Datum:** 2026-04-25  
**Builder:** Claude (Cowork sessie)

---

## Bestanden gewijzigd

- `netlify-deploy/mol-js/speler.js` — 2 wijzigingen (Wijziging A + B)
- `netlify-deploy/mol-js/reveal.js` — 2 wijzigingen (functie + aanroep)
- `tests/mol-wacht-test-scherm.test.js` — nieuw testbestand (Fix 1)
- `tests/mol-reveal-eindstand.test.js` — nieuw testbestand (Fix 2)

---

## Testresultaten

```
Test Suites: 78 passed, 78 total
Tests:       428 passed, 428 total
Snapshots:   0 total
Time:        ~33 s
lint:html — geen inline <script> blokken gevonden
```

Alle bestaande tests groen. Geen regressie.

---

## Self-check acceptatiecriteria

✓ 1. renderWachtTest() bestaat in speler.js (regel 907)
✓ 2. submitTest() navigeert naar screen-speler-wacht-test (niet wacht-briefing)
✓ 3. wacht-test-grid wordt gevuld met chips voor eigen groep
✓ 4. renderEindstand() bestaat in reveal.js (regel 109)
✓ 5. renderEindstand() wordt aangeroepen vanuit renderSpelerReveal() (regel 102)
✓ 6. reveal-scores-lijst toont spelers gesorteerd op punten
✓ 7. 🥇 badge bij hoogste score
✓ 8. MOL-tag bij de mol
✓ 9. Leerlingen buiten eigen groep worden niet getoond
✓ 10. npm test volledig groen, geen regressie (428/428)
✓ 11. node --check beide bestanden geeft geen fout

---

## Opgemerkt, niet opgepakt

- **reveal-content vs reveal-mol-naam discrepantie:** renderSpelerReveal schrijft
  naar `document.getElementById('reveal-content')`, maar er bestaat ook een element
  met class `reveal-mol-naam` in de HTML (via de template). Dit lijkt een niet-kritieke
  naamsverschil; er is geen breekgedrag waargenomen tijdens de tests, maar de Reviewer
  kan dit verifiëren.
- Live updates van wacht-test-grid tijdens poll (wie heeft al ingediend) — buiten scope
  per ticket.

---

## Commit-instructie voor Martijn

**Wat je gaat doen:** de 4 gewijzigde bestanden toevoegen en committen.  
Dit doe je in PowerShell in de projectmap.

**Stap 1 — Open PowerShell in de projectmap**

Klik op de Windows Start-knop, typ `PowerShell` en druk Enter.  
Navigeer naar de projectmap:

```powershell
cd C:\Users\binky\projects\toetsapp-backend
```

Je ziet nu iets als `PS C:\Users\binky\projects\toetsapp-backend>` in het venster.

**Stap 2 — Voer de commit uit**

```powershell
git add netlify-deploy/mol-js/speler.js netlify-deploy/mol-js/reveal.js tests/mol-wacht-test-scherm.test.js tests/mol-reveal-eindstand.test.js tickets/TICKET-007-build.md
git commit -m "TICKET-007: scherm 11 wacht-test + scherm 12 eindstand"
```

**Stap 3 — Verwacht resultaat**

Je ziet zoiets als:

```
[main abc1234] TICKET-007: scherm 11 wacht-test + scherm 12 eindstand
 5 files changed, 80 insertions(+), 18 deletions(-)
```

**Stap 4 — Als er een fout verschijnt**

Stuur de exacte foutmelding naar de Architect.  
Veelvoorkomende oorzaak: je staat niet in de juiste map — controleer de prompt
(`PS C:\Users\binky\projects\toetsapp-backend>`).
