Ticket: TICKET-013
Datum: 2026-04-27
Bestanden gewijzigd:
  - server.js (wijziging A: nieuw endpoint, wijziging B1+B2+B3: bepaalGroepStatus)
  - netlify-deploy/mol-js/speler.js (wijziging C: countdown callback)
  - tests/mol-groep-ronde-start.test.js (nieuw testbestand)

Tests: 4 toegevoegd, alle 453 groen (84 suites)

Self-check:
  ✓ AC1 — POST /api/mol/groep-ronde-start met geldig sessie_id + groep_id geeft { ok: true }
  ✓ AC2 — POST /api/mol/groep-ronde-start zonder groep_id geeft HTTP 400
  ✓ AC3 — bepaalGroepStatus retourneert fase: 'invoer' bij sessie-status 'briefing',
           alle groepsleden klaar én mol_groepen.fase = 'invoer'
  ✓ AC4 — bepaalGroepStatus retourneert nog steeds fase: 'ronde_1' bij sessie-status
           'briefing', alle groepsleden klaar én mol_groepen.fase = 'briefing'
  ✓ AC5 — na 10-seconden countdown roept callback het nieuwe endpoint aan en daarna
           pollSpelerStatus() (lege callback vervangen)
  ✓ AC6 — alle bestaande tests blijven groen (npm test: 453 passed)

Opgemerkt, niet opgepakt:
  - server.js bevat multi-byte UTF-8 tekens (é, —) waardoor de Cowork Edit/Write tools
    het bestand afkappen. ALLE toekomstige wijzigingen aan server.js moeten via Python
    str.replace() of bash gedaan worden, niet via Edit of Write. Dit is nu gedocumenteerd
    in de commit-instructie hieronder.
  - De ticket-spec schrijft .catch(() => {}) voor in de callback, maar apiFetch
    retourneert undefined in de test-omgeving. Vervangen door try/catch — identiek
    gedrag in productie, robuust in tests.

---

Commit-instructie voor Martijn (uitvoeren in PowerShell in de projectmap):

1. Open PowerShell en navigeer naar de projectmap:
      cd C:\Users\binky\projects\toetsapp-backend

2. Controleer welke bestanden gewijzigd zijn:
      git status
   Je ziet als het goed is: server.js (modified) en speler.js (modified),
   plus tests/mol-groep-ronde-start.test.js (untracked).

3. Voeg de bestanden toe aan de commit:
      git add server.js
      git add netlify-deploy/mol-js/speler.js
      git add tests/mol-groep-ronde-start.test.js
      git add tickets/TICKET-013-build.md

4. Maak de commit:
      git commit -m "TICKET-013: groep start ronde 1 automatisch na bekendmaking-countdown"

5. Verwacht: je ziet zoiets als "4 files changed, X insertions(+)"

6. Bij fout: stuur de exacte foutmelding terug.

LET OP voor toekomstige sessies: server.js bevat UTF-8 tekens (é, —).
Gebruik NOOIT Edit of Write op server.js — altijd Python str.replace() via bash.
