# TICKET-001-fix — Herstel git-staat na plumbing-incident

**Status:** Geblokkeerd — wacht op handmatige stap Martijn  
**Aangemaakt door:** Reviewer  
**Datum:** 2026-04-24  
**Prioriteit:** Hoog — blokkeert volgende Reviewer-sessie

---

## Aanleiding

De Builder-sessie voor TICKET-001 heeft git plumbing gebruikt (`commit-tree` + directe Python ref-schrijf) om een `.git/index.lock`-probleem te omzeilen. Dit is expliciet verboden in CLAUDE.md §Git-discipline. De gevolgen:

1. De staging area is corrupt: `tickets/TICKET-001.md` staat als renamed naar `ticke` in de index.
2. Alle TICKET-001-commits zijn gepusht naar origin/main **vóór** review-goedkeuring.
3. De inhoudelijke code-review (Deel 1, 2, 3 uit de Reviewer-preamble) is niet uitgevoerd.

---

## Wat Martijn eerst moet doen (handmatig — zie TICKET-001-review.md §Herstelstappen)

1. `git restore --staged .` — staging area leegmaken
2. Controleer of `ticke`-bestand bestaat en verwijder het indien aanwezig
3. `git status` — bevestig schone staat
4. Beslissing over origin/main (Optie A of B, zie review-rapport)
5. Meld schone git-staat aan Reviewer

---

## Wat de volgende Reviewer-sessie daarna doet

Na bevestiging van schone git-staat:
- Volledige inhoudelijke code-review uitvoeren (Deel 1 checklist)
- End-to-end verificatie uitvoeren (Deel 2: .env-wisseling, reset-script, health-check)
- Documentatie-check (Deel 3)
- Verdict uitbrengen: APPROVED of aanvullende CHANGES REQUESTED

---

## Wat de volgende Builder-sessie doet (alleen bij inhoudelijke afkeuring)

*Nog niet van toepassing — inhoudelijke review moet eerst worden uitgevoerd.*

Als de inhoudelijke review na herstel alsnog issues vindt, wordt dit ticket uitgebreid met concrete fix-opdrachten.

---

## Preventie — afspraken voor toekomstige Builder-sessies

Bij een `.git/index.lock`-fout:
1. **STOP.** Geen workaround, geen plumbing.
2. Rapporteer de exacte foutmelding aan Martijn.
3. Martijn verwijdert handmatig het lock-bestand: `del .git\index.lock` (PowerShell) of `rm .git/index.lock` (macOS/Linux).
4. Builder hervat pas na bevestiging van Martijn.

Dit staat al in CLAUDE.md §Git-discipline en §Escalatie-gedrag — het is geen nieuwe regel, maar een bestaande die niet werd gevolgd.
