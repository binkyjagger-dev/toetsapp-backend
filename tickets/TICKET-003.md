# TICKET-003: Git-commits zijn altijd een handmatige stap van Martijn

**Status:** Ready for Build
**Grootte:** XS
**Aangemaakt door:** Architect
**Datum:** 2026-04-25

## Doel
Verwijder de verwachting dat de Builder-agent `git add` en `git commit` uitvoert,
omdat git-schrijfoperaties vanuit de bash-sandbox naar een Windows-map structureel
falen (NTFS/Linux-mount incompatibiliteit).

## Achtergrond
De bash-sandbox draait op Linux en kijkt via een mount naar de Windows-map van het
project. Git schrijft een `index.lock`-bestand als onderdeel van elke commit —
maar dat lockfile-mechanisme werkt niet betrouwbaar over deze filesystem-grens.
Het resultaat: `git add` en `git commit` falen altijd met "index.lock exists",
ook als er geen ander proces actief is. Dit is een infrastructurele beperking
die niet met een workaround opgelost kan worden.

De oplossing: git-operaties worden expliciet de verantwoordelijkheid van Martijn,
die ze uitvoert in PowerShell op Windows. De Builder levert een kant-en-klare
commit-instructie aan als onderdeel van zijn handoff-document.

## Scope

### Wel
- `WORKFLOW.md` aanpassen op vier plekken (zie Technische notities)
- `CLAUDE.md` aanpassen op één plek (§"Na elke sessie")

### Niet
- Geen codewijzigingen (server.js, routes, tests)
- Geen nieuwe dependencies
- Geen wijzigingen aan `tickets/_template.md`
- Geen wijziging aan de Reviewer-preamble (die doet geen commits)

## Acceptatiecriteria

1. [ ] `WORKFLOW.md` §"Preamble Builder", harde regel 4: de instructie over
       commit-boodschappen is vervangen zodat de Builder nooit zelf `git`
       aanroept, maar een commit-instructie schrijft voor Martijn.

2. [ ] `WORKFLOW.md` §"Preamble Builder", blok "Na oplevering lever je":
       `Commit-hash` is vervangen door `Commit-instructie voor Martijn`.

3. [ ] `WORKFLOW.md` §"Van Builder naar Reviewer" (handoff-template):
       het veld `Commit: <hash>` is vervangen door een blok
       `Commit-instructie voor Martijn:` met een PowerShell-codeblok
       dat de exacte `git add` en `git commit` bevat.

4. [ ] `WORKFLOW.md` workflow-loop stap 5: de verwijzing naar "commit-hash"
       is vervangen door "commit-instructie voor Martijn".

5. [ ] `CLAUDE.md` §"Na elke sessie": de git-regel is aangevuld met de
       notitie dat dit een handmatige stap van Martijn is in PowerShell,
       niet van de agent.

6. [ ] `npm test` is nog steeds groen na de wijzigingen (geen regressie).

## Bestanden die geraakt worden
- `WORKFLOW.md` — vier plekken (zie Technische notities voor exacte strings)
- `CLAUDE.md` — één plek (§"Na elke sessie", laatste bullet)

## Tests
Er zijn geen unit-tests van toepassing op markdown-bestanden.
Acceptatiecriterium 6 (`npm test` groen) is de enige verificatie.

## Mockup
N/A — pure documentatiewijziging.

## Technische notities

Voer de wijzigingen in de onderstaande volgorde uit zodat str_replace-targets
uniek blijven. Gebruik altijd str_replace — nooit een heel bestand herschrijven.

---

### Wijziging 1 — WORKFLOW.md: workflow-loop stap 5

Zoek naar:
```
5. Builder levert: commit-hash + testrapport + self-check tegen acceptatiecriteria
```
Vervang door:
```
5. Builder levert: commit-instructie voor Martijn + testrapport + self-check
   tegen acceptatiecriteria
```

---

### Wijziging 2 — WORKFLOW.md: Preamble Builder, harde regel 4

Zoek naar:
```
4. Commit-boodschap: "TICKET-XXX: <samenvatting>"
```
Vervang door:
```
4. Schrijf een commit-instructie voor Martijn in je handoff-document.
   De Builder voert zelf GEEN git-commando's uit vanuit de sandbox.
```

---

### Wijziging 3 — WORKFLOW.md: Preamble Builder, blok "Na oplevering lever je"

Zoek naar:
```
Na oplevering lever je:
- Commit-hash
- Testresultaten (output van npm test)
- Self-check: acceptatiecriteria langslopen met ✓ of ✗
- Out-of-scope observaties als "Opgemerkt, niet opgepakt:"
```
Vervang door:
```
Na oplevering lever je:
- Testresultaten (output van npm test)
- Self-check: acceptatiecriteria langslopen met ✓ of ✗
- Commit-instructie voor Martijn (zie handoff-template hieronder)
- Out-of-scope observaties als "Opgemerkt, niet opgepakt:"
```

---

### Wijziging 4 — WORKFLOW.md: handoff-template "Van Builder naar Reviewer"

Zoek naar:
```
Ticket: TICKET-XXX
Commit: <hash>
Bestanden gewijzigd: <lijst>
Tests: <aantal> toegevoegd, alle groen
Self-check:
  ✓ Acceptatiecriterium 1
  ✓ Acceptatiecriterium 2
Opgemerkt, niet opgepakt:
  - <observatie>
```
Vervang door:
```
Ticket: TICKET-XXX
Bestanden gewijzigd: <lijst>
Tests: <aantal> toegevoegd, alle groen
Self-check:
  ✓ Acceptatiecriterium 1
  ✓ Acceptatiecriterium 2
Opgemerkt, niet opgepakt:
  - <observatie>

Commit-instructie voor Martijn (uitvoeren in PowerShell):
  1. Open PowerShell in de projectmap
  2. Voer uit:
       git add <bestand1> <bestand2>
       git commit -m "TICKET-XXX: <samenvatting>"
  3. Verwacht: je ziet "X file(s) changed"
  4. Bij fout: stuur de exacte foutmelding naar de Architect
```

---

### Wijziging 5 — CLAUDE.md: §"Na elke sessie"

Zoek naar:
```
- git add . && git commit -m "beschrijving"
```
Vervang door:
```
- **Handmatige stap voor Martijn (PowerShell, niet door de agent):**
  `git add . && git commit -m "beschrijving"`
```

---

## Architect self-check
- [x] Klein genoeg? Ja — 5 str_replace-operaties op 2 markdown-bestanden
- [x] Één probleem, niet twee? Ja — één infrastructurele oorzaak, één fix
- [x] Acceptatiecriteria testbaar zonder menselijke oordelen? Ja — lezen + npm test
- [x] Raakt dit server.js? Nee
