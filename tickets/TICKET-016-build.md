# TICKET-016 — Build-rapport

**Ticket:** TICKET-016 — Discussiescherm toont vraag en MC-opties
**Datum:** 2026-05-01

## Bestanden gewijzigd

- `server.js` — handler `GET /api/mol/sessies/:id/discussie-data` (regel 1989-2027) uitgebreid met `mol_groepen`- en `mol_cases`-queries; response bevat nu `vraag_tekst`, `vraagtype`, `ronde_nr`, `opties`; `eigen_antwoord` wordt nu gefilterd op de huidige `ronde_nr`. Netto delta: +18 / -2 = 16 regels.
- `tests/discussie-data-vraag-opties.test.js` — **nieuw**, 5 tests (AC1+AC3, AC2, AC4, AC5, AC6).

## Tests

- 5 nieuwe tests toegevoegd, allemaal groen.
- Volledige suite: `Test Suites: 1 failed, 92 passed, 93 total` — `Tests: 486 passed, 486 total`.
- De ene falende test-suite is `tests/api-health.test.js` met `supabaseUrl is required`. **Pre-existing failure**, ook op main (commit 8c43130) zonder mijn wijziging. Niet door TICKET-016 geïntroduceerd.
- Bestaande discussie-data tests in `tests/mol-flow.test.js` (25 tests, incl. de drie op regel 343-394): groen.

Laatste regels `npm test`:
```
Test Suites: 1 failed, 92 passed, 93 total
Tests:       486 passed, 486 total
Snapshots:   0 total
Time:        38.652 s
```

## Self-check

- ✓ AC1 — `vraag_tekst` in response, gevuld uit `mol_cases.vraag` voor de huidige ronde.
- ✓ AC2 — `opties` is array van `{ id, tekst }`, `correct`-veld is gestript via `.map`.
- ✓ AC3 — `ronde_nr` in response uit `mol_groepen.ronde_nr`.
- ✓ AC4 — `eigen_antwoord` gefilterd op `ronde_nr === ronde_nr`; ronde-2-test verifieert dat `nieuwR2` (ronde 2) wordt gepakt, niet `oudR1` (ronde 1).
- ✓ AC5 — Voor `vraagtype: 'open'` retourneert het endpoint `opties: []` en `vraagtype: 'open'`, status 200.
- ✓ AC6 — `eigen_antwoord`, `andere_antwoorden`, `groepshoofd_id`, `groepshoofd_naam`, `is_groepshoofd` ongewijzigd in shape en betekenis (test AC6 verifieert).
- ✓ AC7 — `npm test` groen op alle relevante suites; enige falende suite is pre-existing op main.
- ✓ AC8 — `git diff --stat` toont alleen `server.js`; testbestand is untracked maar wordt na `git add` onderdeel van de diff. server.js-delta = 16 regels netto, ruim onder 30.

## Opgemerkt, niet opgepakt

- `tests/api-health.test.js` is kapot op main: server.js wordt geladen zonder gemockte Supabase-client, en zonder `SUPABASE_URL` in env crasht `createClient`. Pre-existing, buiten scope van TICKET-016. Vermoedelijk oplosbaar door (a) jest.mock toe te voegen aan dat testbestand, of (b) een dummy `SUPABASE_URL` in jest setup. Aparte ticket waard.
- Edge case "`mol_cases` mist een rij voor de gevraagde ronde" wordt impliciet afgedekt door `caseR?.vraag || ''` en `(caseR?.mc_opties || [])` — defensief code maar niet expliciet getest, conform het ticket.

## Commit-instructie voor Martijn

Open een terminal in de projectmap en voer uit:

```bash
git add server.js tests/discussie-data-vraag-opties.test.js tickets/TICKET-016-build.md
git commit -m "TICKET-016: /discussie-data retourneert vraag en opties"
```

Verwacht: `3 files changed, ...`.

Bij fout: stuur de exacte foutmelding terug naar de Architect. Ik (Builder) heb GEEN git-commando's uitgevoerd.
