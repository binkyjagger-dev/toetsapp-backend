# TICKET-002-build: Opleverrapport

**Ticket:** TICKET-002-fix (jest.setup.js voor JWT_SECRET)
**Commit:** d3f2903
**Datum:** 2026-04-24

## Bestanden gewijzigd

- `jest.setup.js` — nieuw bestand, 3 regels
- `package.json` — `"jest": { "setupFiles": ["./jest.setup.js"] }` toegevoegd

## Testresultaten

**Vóór de fix:**
```
Test Suites: 10 failed, 54 passed, 64 total
Tests:       42 failed, 327 passed, 369 total
```

**Na de fix:**
```
Test Suites: 64 passed, 64 total
Tests:       369 passed, 369 total
```

Geen tweede-orde-failures aangetroffen. Alle 42 voormalige failures zijn groen.

## Self-check acceptatiecriteria

✓ 1. jest.setup.js bestaat en zet JWT_SECRET op 'stanislascollege_mol_secret_2025'
✓ 2. package.json verwijst naar jest.setup.js via setupFiles
✓ 3. Vóór de fix: 42 falende tests (bevestigd)
✓ 4. Na de fix: 0 failures, geen tweede-orde-failures
✓ 5. Geen wijzigingen aan server.js
✓ 6. Geen wijzigingen aan testbestanden

## Exit-checks

**git status:**
- Branch main, 1 commit voor op origin/main
- Geen gestaged wijzigingen (werkdirectory toont alleen CRLF/LF-artefacten
  van de Linux sandbox — geen echte inhoudelijke wijzigingen)

**git log --oneline -5:**
```
d3f2903 TICKET-002: jest.setup.js voor JWT_SECRET in tests
c455c46 chore: gitignore uitgebreid en TICKET-001 administratie
6001961 TICKET-001: docs/testdatabase.md met setup- en Reviewer-run-procedure
eaf2606 TICKET-001: reset-test-db.js met productie-guard + statische tests (TDD groen)
ff043af TICKET-001: .env.test.example met 8 env-vars en IS_TEST_DATABASE=true placeholder
```

**git log origin/main..HEAD:**
```
d3f2903 TICKET-002: jest.setup.js voor JWT_SECRET in tests
```
→ 1 commit wacht op push.

## Opgemerkt, niet opgepakt

- De Linux bash-sandbox ziet alle Windows-bestanden als "modified" vanwege
  CRLF vs. LF lijneindes. Dit is een sandbox-artefact, geen echte wijziging.
  De git-diff van deze bestanden toont alleen ^M-tekens, geen inhoudelijke
  veranderingen. Aanbeveling voor een apart moment: `.gitattributes` met
  `* text=auto` toevoegen zodat git lijneindes normaliseert.

- Er staat een bestand `tatus` (zonder "s") in de root van de werkdirectory.
  Dit is waarschijnlijk het resultaat van een eerder `git staus`-typfout die
  als bestand is opgeslagen. Geen blokkerende issue, maar opruimen kan.
