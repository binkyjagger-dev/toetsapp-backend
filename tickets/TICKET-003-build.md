# Handoff: TICKET-003

Ticket: TICKET-003
Bestanden gewijzigd: WORKFLOW.md, CLAUDE.md
Tests: 0 toegevoegd (geen unit-tests van toepassing op markdown), alle 399 bestaande tests groen

## Self-check acceptatiecriteria

✓ 1. WORKFLOW.md §"Preamble Builder" harde regel 4: bevat nu "Schrijf een commit-instructie
      voor Martijn in je handoff-document. De Builder voert zelf GEEN git-commando's uit
      vanuit de sandbox."

✓ 2. WORKFLOW.md §"Preamble Builder" blok "Na oplevering lever je": "Commit-hash" is
      vervangen door "Commit-instructie voor Martijn (zie handoff-template hieronder)".

✓ 3. WORKFLOW.md §"Van Builder naar Reviewer" handoff-template: "Commit: <hash>" is
      verwijderd en vervangen door een "Commit-instructie voor Martijn (uitvoeren in
      PowerShell):"-blok met genummerde stappen en een PowerShell-codeblok.

✓ 4. WORKFLOW.md workflow-loop stap 5: "commit-hash" is vervangen door
      "commit-instructie voor Martijn".

✓ 5. CLAUDE.md §"Na elke sessie": git-regel is aangevuld met
      "**Handmatige stap voor Martijn (PowerShell, niet door de agent):**"

✓ 6. npm test: 399/399 tests groen (Jest-suite volledig geslaagd).

## Testresultaten

  Test Suites: 69 passed, 69 total
  Tests:       399 passed, 399 total
  Snapshots:   0 total
  Time:        ~29 s

  lint:html: FAALT — zie "Opgemerkt, niet opgepakt" hieronder.

## Commit-instructie voor Martijn (uitvoeren in PowerShell)

1. Open PowerShell en navigeer naar de projectmap:
   ```
   cd C:\Users\binky\projects\toetsapp-backend
   ```

2. Voer de volgende commando's uit:
   ```
   git add WORKFLOW.md CLAUDE.md tickets/TICKET-003-build.md
   git commit -m "TICKET-003: git-commits zijn handmatige stap van Martijn"
   ```

3. Verwacht: je ziet iets als "3 files changed, X insertions(+), Y deletions(-)"

4. Bij fout: stuur de exacte foutmelding naar de Architect.

## Opgemerkt, niet opgepakt

- `scripts/lint-html.js` geeft een `SyntaxError: Invalid or unexpected token` op regel 38
  bij uitvoering via `npm run lint:html`. Dit is een PRE-EXISTING probleem dat al aanwezig
  was vóór TICKET-003 (bevestigd via git stash-test). De 399 Jest-tests zijn ongewijzigd
  groen. Dit is buiten de scope van TICKET-003 en vereist een apart ticket.
