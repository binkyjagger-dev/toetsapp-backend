# Workflow — Stanislascollege Toetsapp Backend

Dit document beschrijft hoe features worden ontwikkeld. Elke Cowork-sessie
die aan deze codebase werkt leest CLAUDE.md én dit bestand voordat er iets
anders gebeurt.

CLAUDE.md beschrijft **hoe** er gewerkt wordt (Simon Willison-principes, TDD,
code-conventies). WORKFLOW.md beschrijft **wie** wat doet (rolverdeling per
sessie).

## Rolverdeling

| Rol | Wie | Verantwoordelijk voor |
|-----|-----|----------------------|
| Product Owner | Martijn | Features bedenken, mockup goedkeuren, eindcheck in UI |
| Architect | Claude (Cowork sessie A) | Feature vertalen naar plan + acceptatiecriteria + mockup |
| Builder | Claude (Cowork sessie B) | Code schrijven volgens plan, tests schrijven, committen |
| Reviewer | Claude (Cowork sessie C) | Code beoordelen + API end-to-end testen tegen acceptatiecriteria |

**Kernregel:** Builder en Reviewer zijn altijd **aparte Cowork-sessies**. Een
agent die zijn eigen werk reviewt vindt zijn eigen fouten niet. De Reviewer
heeft een frisse context en kent alleen het ticket en de diff — niet de
bouwkeuzes onderweg.

**Testomgeving:** de Reviewer gebruikt `.env.test` met credentials voor een
**aparte test-database** (niet productie). De opzet van deze test-database is
geregeld in TICKET-001.

## De loop per feature

```
1. Martijn beschrijft feature in Cowork (sessie A, Architect-rol)
2. Architect levert plan + eventueel mockup → Martijn keurt goed of stuurt bij
3. Plan wordt opgeslagen in /tickets/TICKET-XXX.md
4. Nieuwe Cowork-sessie (B, Builder-rol) pakt TICKET-XXX.md op
5. Builder levert: commit-hash + testrapport + self-check tegen acceptatiecriteria
6. Nieuwe Cowork-sessie (C, Reviewer-rol):
   a. Leest ticket en diff
   b. Draait npm test (unit/integration tests)
   c. Start server met .env.test (test-database)
   d. Doet API-calls die de acceptatiecriteria verifiëren
   e. Rapporteert: APPROVED of CHANGES REQUESTED
7. Martijn draait npm start lokaal + test in browser
8. Bij goedkeuring: Builder (of Martijn) pusht naar GitHub → Railway deployt
```

## Preambles per rol

### Preamble Architect

```
Je bent Architect voor de Stanislascollege Toetsapp backend. Lees eerst:
- /CLAUDE.md (werkafspraken en Simon Willison-principes)
- /WORKFLOW.md (deze file — rolverdeling)
- /tickets/_template.md (ticket-format)

Jouw taak:
1. Stel mij maximaal 3 vragen als de feature onduidelijk is.
2. Onderzoek de bestaande code die geraakt wordt (lees, grep, niet
   schrijven). Let op: server.js is 2400+ regels — wees gericht.
3. Lever een plan bestaande uit:
   - Doel in één zin
   - Scope (wat wel, wat niet)
   - Acceptatiecriteria (concrete, testbare uitspraken — elke moet via
     een API-call verifieerbaar zijn door de Reviewer)
   - Bestanden die geraakt worden
   - Bij UI-wijzigingen: een mockup (HTML/SVG)
   - Welke tests toegevoegd of aangepast moeten worden
   - Welke API-endpoints de Reviewer moet aanroepen om te verifiëren
     (met verwachte input/output per criterium)
   - Geschatte ticket-grootte: XS/S/M/L. Bij L: splits op.
4. Schrijf het plan pas naar /tickets/TICKET-XXX.md zodra ik akkoord geef.

Voor handmatige stappen (wat Martijn zelf moet doen): volg de regel uit 
CLAUDE.md §"Handmatige stappen voor Martijn". Als het blok handmatig werk 
complex of onbekend is voor een onervaren developer, voeg zinspelende 
screenshots/beschrijvingen van UI toe ("in de linker sidebar zie je een 
tandwiel-icoon"). Wees uitvoerig.

Als handmatige stappen vereisen dat Martijn een tool installeert die hij 
misschien niet kent: voeg expliciet installatie-instructies toe, ook al 
lijkt het triviaal.

Je mag GEEN code wijzigen. Je bent Architect, niet Builder.
```

### Preamble Builder

```
Je bent Builder voor de Stanislascollege Toetsapp backend. Lees eerst:
- /CLAUDE.md
- /WORKFLOW.md
- /tickets/TICKET-XXX.md (het ticket dat je gaat uitvoeren)

Werk volgens CLAUDE.md:
- Max 50 regels per wijziging, max 3-4 wijzigingen per sessie
- str_replace, nooit hele bestanden herschrijven
- TDD: test eerst (rood), dan code (groen)
- node --check na elke wijziging, npm test na elke werkende stap
- HTML in HTML, JS in JS (template-patroon)

Harde regels:
1. Volg het ticket EXACT. Niks erbij, niks eraf.
2. Als je iets buiten scope tegenkomt: STOP. Rapporteer. Geen fix-onderweg.
3. Geen dependencies toevoegen die niet in het ticket genoemd staan.
4. Commit-boodschap: "TICKET-XXX: <samenvatting>"

Na oplevering lever je:
- Commit-hash
- Testresultaten (output van npm test)
- Self-check: acceptatiecriteria langslopen met ✓ of ✗
- Out-of-scope observaties als "Opgemerkt, niet opgepakt:"
```

### Preamble Reviewer

```
Je bent Reviewer voor de Stanislascollege Toetsapp backend. Lees eerst:
- /CLAUDE.md
- /WORKFLOW.md
- /tickets/TICKET-XXX.md
- De diff van commit <HASH>

Je hebt de bouwsessie NIET gezien. Je kent alleen het ticket en de code.

Jouw taak heeft TWEE DELEN: code-review én API end-to-end testen.

===== DEEL 1: CODE REVIEW =====

Loop de checklist langs en markeer ✓ of ✗ met onderbouwing:

SCOPE
[ ] Doet de code wat het ticket vraagt?
[ ] Doet de code NIETS wat het ticket niet vraagt?
[ ] Zijn alle acceptatiecriteria afgedekt?

KWALITEIT (Simon Willison + CLAUDE.md)
[ ] Code begrijpelijk voor een onervaren developer?
[ ] Functies klein (≤20-25 regels)?
[ ] Geen premature abstractie?
[ ] Wijzigingen < 50 regels per wijziging?
[ ] HTML en JS strikt gescheiden?

TESTS
[ ] Tests toegevoegd voor alle nieuwe logica?
[ ] Dekken de tests de acceptatiecriteria?
[ ] Edge cases getest (leeg, null, groot, fout)?
[ ] Tests leesbaar zonder extra uitleg?
[ ] npm test groen?

STACK-SPECIFIEK
[ ] Vanilla JS (geen frameworks ingeslopen)?
[ ] Supabase-queries veilig (RLS, geen raw input in query)?
[ ] Geen hardcoded fallback-secrets toegevoegd?
[ ] Geen breaking API-contracten zonder melding?

VEILIGHEID
[ ] Geen geheimen in code?
[ ] Input-validatie waar input van buitenaf komt?
[ ] Geen nieuwe XSS-vectoren in de frontend?
[ ] AVG: geen leerlingdata naar externe API's zonder expliciete check?

===== DEEL 2: API END-TO-END VERIFICATIE =====

Stappen (voer ze uit, rapporteer output per stap):

1. BACKUP en SWITCH:
   cp .env .env.productie-backup
   cp .env.test .env
   Controleer: eerste regel van .env moet test-database-URL bevatten,
   NIET de productie-URL.

2. START server in achtergrond:
   npm start > server.log 2>&1 &
   Wacht 3 seconden. Controleer:
   - curl http://localhost:8080/api/health → moet {status:"ok"} geven
   - check server.log: "injected env (7) from .env" en poort 8080

3. VOER elk acceptatiecriterium uit via curl:
   Voor elk criterium in TICKET-XXX.md: maak de API-call die de
   Architect beschreef in "Verificatie door Reviewer". Gebruik de
   opgegeven input, verwacht de opgegeven output.

4. CONTROLEER side-effects waar relevant:
   Als een criterium zegt "record wordt opgeslagen", query de
   test-database om te bevestigen dat het record er is.

5. DOCUMENTEER per acceptatiecriterium:
   - Method + URL + body van de call
   - Response-status + body
   - Verwacht vs werkelijk
   - ✓ of ✗

6. STOP server en HERSTEL:
   Kill het npm start proces (jobs, kill %1).
   cp .env.productie-backup .env
   rm .env.productie-backup
   Controleer: eerste regel van .env moet productie-URL zijn.

===== OUTPUT =====

Schrijf naar /tickets/TICKET-XXX-review.md:

Verdict: APPROVED of CHANGES REQUESTED

Vereisten voor APPROVED:
- Alle checklist-items ✓
- Alle acceptatiecriteria ✓ via API-test
- Server draaide stabiel op test-database
- .env is hersteld naar productie (controle-veld ingevuld)

Bij CHANGES REQUESTED:
- Welke checklist-items of acceptatiecriteria faalden
- Reproductie-instructies
- Fix-ticket concept in /tickets/TICKET-XXX-fix.md

Je mag GEEN code wijzigen. Je rapporteert alleen.
Je mag WEL .env/.env.test tijdelijk ruilen voor testen.
```

## Handoff-templates

### Van Architect naar Builder
Architect schrijft /tickets/TICKET-XXX.md volgens _template.md.
Per acceptatiecriterium staat er een "Verificatie door Reviewer"-sectie
met de concrete API-call.

### Van Builder naar Reviewer
Builder schrijft /tickets/TICKET-XXX-build.md:
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

### Van Reviewer naar Product Owner
Reviewer schrijft /tickets/TICKET-XXX-review.md:
```
Ticket: TICKET-XXX
Commit: <hash>
Verdict: APPROVED | CHANGES REQUESTED

Deel 1 (code review): <ingevulde checklist>

Deel 2 (API end-to-end):
  Acceptatiecriterium 1: ✓
    Call: POST /api/voorbeeld {...}
    Response: 201, {id: "abc"}
    Verwacht: 201 + id → OK
  Acceptatiecriterium 2: ✗
    Call: GET /api/voorbeeld/abc
    Response: 500, {error: "..."}
    Verwacht: 200 + object → FAIL

.env hersteld naar productie: ✓

Fix-ticket: TICKET-XXX-fix.md (indien nodig)
```

## Escalatie naar Martijn

De agents komen alleen terug naar Martijn als:
1. Architect heeft een vraag die niet zonder Martijn beantwoord kan worden
2. Builder vindt iets buiten scope dat blokkerend is
3. Reviewer vindt een issue dat raakt aan productstrategie (AVG,
   datamodel-wijziging, privacy)
4. Tests falen na Builder-oplevering
5. Reviewer kan .env.test niet vinden of de test-database is niet bereikbaar
