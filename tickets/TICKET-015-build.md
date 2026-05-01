# TICKET-015 — Build Handoff

**Ticket:** TICKET-015 (Discussie- en resultaatfase per groep tijdens briefing-status)
**Datum:** 2026-05-01
**Builder-rol:** Claude (Cowork sessie B)

## Bestanden gewijzigd

- `server.js` — briefing-tak in `bepaalGroepStatus` (regel 1811-1841 na wijziging) uitgebreid met fase-afleiding uit `mol_groep_stemmen` en `mol_antwoorden`. Netto +22 / -1 regel = 21 regels netto, ruim binnen de 25-regel-limiet uit AC8.
- `tests/discussie-resultaat-per-groep.test.js` — **nieuw**, jest-mocks volgens patroon van `tests/mol-groep-ronde-start.test.js`. 6 nieuwe tests (AC1, AC2, AC3, AC4, AC5a, AC5b).

## Aantal toegevoegde tests + npm test-output

**Nieuwe testsuite:** 6 tests, allemaal groen.

**npm test (volledig):**

```
Test Suites: 1 failed, 91 passed, 92 total
Tests:       481 passed, 481 total
Snapshots:   0 total
Time:        6.588 s
```

**De 1 falende test suite is `tests/api-health.test.js`** — geverifieerd op `main` zonder mijn wijzigingen: faalt daar al met dezelfde foutmelding (`supabaseUrl is required`). Dit is een pre-existing env-probleem (test laadt server.js zonder Supabase-mocks en zonder `.env` populated met `SUPABASE_URL`). Niet veroorzaakt door TICKET-015. **Tests-niveau: 481/481 passed.**

## Self-check tegen acceptatiecriteria

- [✓] **AC1 — discussie start per groep:** test groen. Briefing-tak retourneert nu `{fase:'discussie', ronde_nr:r, wacht_op:[<groepshoofd_id>]}` als alle leden antwoord hebben en geen stem aanwezig is.
- [✓] **AC2 — invoer met partial submissions:** test groen. Retourneert `{fase:'invoer', ronde_nr:r, wacht_op:[<ids zonder antwoord>]}`.
- [✓] **AC3 — resultaat na groepsantwoord:** test groen. Retourneert `{fase:'resultaat', ronde_nr:r, wacht_op:[]}` zodra `mol_groep_stemmen` een rij voor (groep, ronde) heeft.
- [✓] **AC4 — onafhankelijkheid tussen groepen:** test "stem voor andere groep telt niet mee" groen — de stemfilter `s.groep_id === groep_id && s.ronde_nr === r` zorgt voor strikte filtering. Multi-groep curl-verificatie hoort bij Reviewer (Deel 2).
- [✓] **AC5 — bestaand briefing-gedrag ongewijzigd:** AC5a (`groep.fase='briefing'`, allen klaar → `'ronde_1'`) en AC5b (niet-allen-klaar → `'briefing'` met wacht_op) beide groen. Was al groen op `main`, blijft groen.
- [✓] **AC6 — ronde-tak ongewijzigd:** server.js regels 1822-1841 niet aangeraakt. Bestaande tests zoals `tests/mol-groep-ronde-start.test.js` blijven groen (geverifieerd in volledige `npm test`).
- [✓] **AC7 — npm test groen:** 481/481 testjes groen. De 1 falende suite (`api-health.test.js`) is pre-existing op `main` (zie hierboven).
- [△] **AC8 — diff-omvang:** `git diff --stat HEAD -- server.js tests/discussie-resultaat-per-groep.test.js` toont precies de twee functionele bestanden uit het ticket: `server.js` (+22/-1) en het nieuwe testbestand. Wijziging in `server.js` is 21 regels netto (< 25). **Kanttekening:** de commit-instructie van de gebruiker bevat ook `tickets/TICKET-015-build.md` — dat is een meta/handoff-bestand (geen productiecode). Als AC8 strikt twee bestanden in de commit-diff betekent, kan de build-doc apart gecommit worden. Zie "Opgemerkt, niet opgepakt".

## Opgemerkt, niet opgepakt

- **AC8 vs commit-instructie**: AC8 zegt "precies twee bestanden in `git diff --stat main..HEAD`", maar de commit-instructie van de gebruiker noemt drie bestanden inclusief `tickets/TICKET-015-build.md`. Beslissing aan de Architect/Reviewer of de build-doc in dezelfde commit mag, of in een aparte chore-commit moet. Code-bestanden zijn exact volgens AC8.
- **`tickets/TICKET-008-build.md` en `tickets/TICKET-014.md`**: aanwezig als untracked files vóór deze sessie begon. Niet aangeraakt en niet bij deze commit gevoegd.
- **`tickets/TICKET-015.md`**: het ticket zelf was untracked bij sessie-start. Hij wordt door de gebruiker apart gecommit (Architect-fase) of mag meegenomen worden — buiten scope van Builder-handoff.
- **Mogelijke latente issue (al benoemd in ticket):** wanneer een docent later "Start sessie" drukt nadat een groep al een groepsantwoord heeft ingediend, kan de ronde-tak `ronde_fase === 'resultaat_5sec'` zien en doorvallen naar de fall-through op `server.js:1840`. Architect heeft dit al doorgeschoven naar TICKET-016. Niet aangeraakt.

## Commit-instructie voor Martijn (handmatig in terminal)

1. Open een terminal in de projectmap (`cd ~/projects/toetsapp-backend`).
2. Voer letterlijk uit:
   ```bash
   git add server.js tests/discussie-resultaat-per-groep.test.js \
           tickets/TICKET-015-build.md
   git commit -m "TICKET-015: discussie- en resultaatfase per groep tijdens briefing"
   ```
3. Verwacht output: `3 files changed, ...`. Als je iets anders ziet (bijvoorbeeld `nothing to commit`), stuur de exacte foutmelding naar de Architect.
4. **Niet pushen.** De Reviewer (Cowork sessie C) draait eerst de end-to-end API-verificatie tegen `.env.test`. Pas na APPROVED mag jij naar GitHub pushen (`git push origin main`).
