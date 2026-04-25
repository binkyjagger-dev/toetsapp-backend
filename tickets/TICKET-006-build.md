# TICKET-006 Build Report

**Ticket:** TICKET-006 — Puntentelling  
**Builder:** Claude (Cowork sessie)  
**Datum:** 2026-04-25

---

## Bestanden gewijzigd

- `server.js` — 3 fixes (Fix 1, Fix 2, Fix 3)
- `tests/mol-puntentelling-groep.test.js` — nieuw (2 tests voor Fix 1)
- `tests/mol-puntentelling-intern.test.js` — nieuw (6 tests voor Fix 2 & 3)

---

## Tests

**8 nieuwe tests toegevoegd, alle 422 tests groen.**

```
Test Suites: 76 passed, 76 total
Tests:       422 passed, 422 total
lint:html — geen inline <script> blokken gevonden
```

---

## Self-check acceptatiecriteria

```
✓ 1. groepsantwoord-endpoint slaat punten + max_punten op
     mol_groep_stemmen.update({ punten, max_punten }) wordt aangeroepen
     na de upsert (test mol-puntentelling-groep.test.js test 1 & 2)

✓ 2. groepsantwoord_punten op scherm 9 is niet langer altijd 0
     De punten-lookup gebruikt mc_opties.id/tekst om de gekozen optie
     te vinden; max_punten = Math.max(0, ...opties.map(o => o.punten))

✓ 3. berekenScoresIntern leest mc_opties.punten voor individueel antwoord
     mol_cases wordt toegevoegd aan de Promise.all; per ronde wordt
     optie.punten || 0 gebruikt (test intern test 1)

✓ 4. berekenScoresIntern gebruikt geen hardcoded 15 meer
     Het if-else blok met indivPunten += 15 is vervangen door de
     mc_opties-lookup; grep op '15' in berekenScoresIntern geeft 0 hits

✓ 5. Mol-test bonus is proportioneel (niet flat 25)
     Spelers: Math.round((1 / aantalCorrectGeraden) * 50)
     Mol: Math.round((1 - aantalCorrectGeraden / nietMolCount) * 50)
     (test intern tests 3, 5, 6)

✓ 6. Deling door nul is afgevangen (aantalCorrectGeraden = 0 → bonus 0)
     if (aantalCorrectGeraden > 0) ? ... : 0
     (test intern test 4)

✓ 7. npm test volledig groen, geen regressie
     422 tests, 76 suites — alles groen

✓ 8. node --check server.js geeft geen fout
     Bevestigd na elke wijziging
```

---

## Opgemerkt, niet opgepakt

- **server.js was vooraf afgekapt** op byte 107301 (bestand eindigde met
  `console.error('[mig` midden in een string). Dit veroorzaakte dat alle
  tests die `require('../server')` gebruiken faalden. De ontbrekende regels
  (2410–2436: `runMigrations`-afronding + `module.exports = app`) zijn
  hersteld. Dit was een pre-existing probleem, niet veroorzaakt door dit
  ticket. Melding voor Architect: controleer of de oorzaak van de truncatie
  bekend is (bijv. een eerdere mislukte write-operatie).

- **Scherm 9 UI** toont `groepsantwoord_punten` — de datalaag is nu correct,
  maar de weergave zelf is buiten scope (MOL-05).

- **Mol-sabotage scoring** (groepStemmen `is_correct`) gebruikt nog altijd
  hardcoded +20 per ronde. Niet aangepakt — staat niet in dit ticket.

---

## Commit-instructie voor Martijn

Voer dit uit in PowerShell vanuit de projectmap:

```
cd C:\Users\binky\projects\toetsapp-backend
```

**Stap 1 — Stage de gewijzigde bestanden:**
```
git add server.js tests/mol-puntentelling-groep.test.js tests/mol-puntentelling-intern.test.js tickets/TICKET-006-build.md
```

**Stap 2 — Maak de commit:**
```
git commit -m "TICKET-006: puntentelling — mc_opties.punten + proportionele Mol-bonus"
```

**Stap 3 — Verwacht resultaat:**
Je ziet zoiets als:
```
[main abc1234] TICKET-006: puntentelling — mc_opties.punten + proportionele Mol-bonus
 4 files changed, ...
```

**Bij een fout:** stuur de exacte foutmelding naar de Architect.
