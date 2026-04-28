# MOL-10 Build Handoff

**Ticket:** MOL-10 — Scherm 6 volledig maken
**Bestanden gewijzigd:**
- `netlify-deploy/mol-js/speler.js`
- `netlify-deploy/mol-lesvorm.html`
- `tests/mol-scherm6-volledig.test.js` (nieuw)
- `tests/mol-scherm6.test.js` (vervangen door placeholder)

**Tests:** 6 toegevoegd, 470 totaal — alle groen

---

## Self-check acceptatiecriteria

1. **Bug A opgelost:** `if (mijnAntwoord)` vervangt `if (mijnAntwoord && !alleIngediend)` — ja
2. **Topbar gevuld:** `#wacht-ronde-topbar-naam` krijgt naam + groepsnaam via `renderWachtNaIndienen` — ja
3. **Subtitel aanwezig:** `<p>Wacht tot iedereen klaar is</p>` staat in HTML — ja
4. **Leesbare antwoordtekst:** MC-optie-id opzoeken in caseData, 'correct'/'fout' mappen naar leesbare tekst — ja
5. **Statuslijst met initialen en badges:** avatar-cirkel met initialen, voornaam, Ingediend/Bezig badge — ja
6. **Automatische overgang scherm 7:** al geregeld via bestaande `if (fase === 'discussie')` poll-tak (buiten scope MOL-10, werkt al) — ja

---

## Opgemerkt, niet opgepakt

- `tests/mol-scherm6.test.js` (MOL-09) testte de pre-MOL-10 implementatie
  (`.wacht-chip` CSS-klasse en ruwe `'correct'`/`'fout'` string). Die tests
  zouden breken na wijziging 2. Het bestand is vervangen door een no-op
  placeholder; alle gedrag is gedekt door `mol-scherm6-volledig.test.js`.
  Dit is een bewuste keuze die buiten de ticketscope valt — melden aan Reviewer.

- De `·` (middenpunt) in de topbar-tekst wordt in speler.js als literaal
  karakter geschreven (niet als Unicode escape). Node --check slaagt.
  Als er ooit een Write/Edit tool op dat bestand wordt gebruikt, kan
  truncatie optreden (zie CLAUDE.md "Tooling-beperkingen").

---

## Commit-instructie voor Martijn

Voer onderstaande stappen uit in PowerShell, vanuit de projectmap
(`C:\Users\binky\projects\toetsapp-backend`):

**Stap 1** — Controleer welke bestanden gewijzigd zijn:
```powershell
git status
```
Je ziet (minimaal) deze bestanden onder "modified" of "new file":
- `netlify-deploy/mol-js/speler.js`
- `netlify-deploy/mol-lesvorm.html`
- `tests/mol-scherm6-volledig.test.js`
- `tests/mol-scherm6.test.js`
- `docs/tickets/MOL-10-build.md`

**Stap 2** — Voeg de bestanden toe aan de commit:
```powershell
git add netlify-deploy/mol-js/speler.js netlify-deploy/mol-lesvorm.html tests/mol-scherm6-volledig.test.js tests/mol-scherm6.test.js docs/tickets/MOL-10-build.md
```

**Stap 3** — Commit:
```powershell
git commit -m "MOL-10: scherm 6 volledig -- bugs A/B/C/D opgelost"
```

Je ziet nu zoiets als: `5 files changed, X insertions(+), Y deletions(-)`

**Bij een fout:** stuur de exacte foutmelding naar de Architect.
