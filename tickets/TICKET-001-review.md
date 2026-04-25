# TICKET-001 — Review rapport

**Ticket:** TICKET-001  
**Commits gereviewd:** ff043af, eaf2606, 6001961, c455c46  
**Datum:** 2026-04-24  
**Reviewer:** Claude (Cowork sessie C)

---

## EERSTE CHECK — Git-staat

### Initiële staat (vóór herstel door Martijn)

Bij aanvang van de review was de git-staat NIET schoon:

```
Changes to be committed:
    renamed:    tickets/TICKET-001.md -> ticke   ← corrupte rename
    deleted:    tickets/_template.md

Changes not staged for commit:
    modified:   [~100 bestanden — pre-existent]

Untracked files:
    supabase/
    tickets/TICKET-001.md
    tickets/_template.md
```

`git log origin/main..HEAD` → geen output (commits al gepusht vóór review).

Oorzaak: Builder gebruikte git plumbing-commando's (`commit-tree` + directe Python ref-schrijf) als workaround voor een `.git/index.lock`-fout. Dit is expliciet verboden in CLAUDE.md §Git-discipline en heeft de index in een corrupte staat achtergelaten.

**Eerste verdict was automatisch CHANGES REQUESTED (git-staat niet schoon).**

### Staat na herstel door Martijn

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
    modified:   CLAUDE.md
    modified:   WORKFLOW.md

Untracked files:
    tickets/TICKET-001-fix.md
    tickets/TICKET-001-review.md
```

`git log --oneline -5`:
```
c455c46 (HEAD -> main, origin/main) chore: gitignore uitgebreid en TICKET-001 administratie
6001961 TICKET-001: docs/testdatabase.md met setup- en Reviewer-run-procedure
eaf2606 TICKET-001: reset-test-db.js met productie-guard + statische tests (TDD groen)
ff043af TICKET-001: .env.test.example met 8 env-vars en IS_TEST_DATABASE=true placeholder
812da6a docs: explicit instructions for detailed manual steps
```

`git log origin/main..HEAD` → geen output (commits staan al op origin/main — gevolg van plumbing-incident; commits zelf zijn correct).

**Status na herstel: ✓ schoon genoeg om review voort te zetten.**

Kanttekeningen:
- `CLAUDE.md` en `WORKFLOW.md` zijn unstaged gewijzigd — pre-existent, buiten scope TICKET-001.
- `.env.productie-backup` blijft achter in de repo-root (sandbox kon het bestand niet verwijderen door rechtenbeperking). **Martijn verwijdert dit handmatig:** `del .env.productie-backup` in PowerShell.
- Git plumbing-schending is historisch feit. Vastgelegd in TICKET-001-fix.md als preventieve maatregel.

---

## DEEL 1 — CODE REVIEW

### SCOPE

**✓ Doet de code wat het ticket vraagt?**  
Alle drie wijzigingen zijn aanwezig: `.env.test.example` (Wijziging 1), `scripts/reset-test-db.js` + `tests/reset-test-db.test.js` (Wijziging 2), `docs/testdatabase.md` (Wijziging 3). `server.js` is niet aangeraakt.

**✓ Doet de code NIETS wat het ticket niet vraagt?**  
Geen extra bestanden, geen extra dependencies, geen wijzigingen buiten de drie opgegeven bestanden.

**✓ Zijn alle acceptatiecriteria AC1-AC10 afgedekt in de code?**  
Zie Deel 2 voor AC-coverage per item.

### KWALITEIT

**✓ Code begrijpelijk voor een onervaren developer?**  
Variabelenamen zijn duidelijk, comments in het Nederlands, logische flow. De test-file legt in comments uit wat elke check doet.

**✓ Functies klein (≤20-25 regels)?**  
`resetTestDb()` is 31 regels inclusief alle DELETE-statements — iets boven de grens, maar alle regels hebben één verantwoordelijkheid (database-reset). Niet splitsbaar zonder kunstmatige abstractie.

**✓ Geen premature abstractie?**  
Één functie, directe SQL-calls, geen onnodige hulpfuncties.

**⚠ Wijzigingen < 50 regels per wijziging?**  
Wijziging 2 voegt 93 regels toe in één commit (46 regels script + 47 regels test). Dit overschrijdt de 50-regel grens uit CLAUDE.md. De Architect heeft de test en het script bewust in één TDD-stap bedoeld; de Builder heeft dit als één commit opgeleverd. Marginale schending — geen blokkerende bevinding, wel notitie.

### TESTS

**✓ Zijn de 4 nieuwe tests in tests/reset-test-db.test.js groen?**
```
PASS tests/reset-test-db.test.js
  reset-test-db.js — statische checks
    ✓ script bestaat op scripts/reset-test-db.js (8 ms)
    ✓ node --check slaagt (geen syntaxfouten) (42 ms)
    ✓ productie-guard aanwezig: IS_TEST_DATABASE !== "true" (2 ms)
    ✓ tabellijst in sync: elke CREATE TABLE uit migrations heeft een DELETE FROM in het script (24 ms)
Tests: 4 passed, 4 total
```

**✓ Pre-existente falende tests: aantal gelijk gebleven?**  
`npm test` → 42 failed, 327 passed, 369 total. Zelfde 42 als vóór TICKET-001 (Builder rapporteerde identiek aantal). TICKET-001 heeft geen bestaande tests gebroken.

**✓ Dekken de nieuwe tests de acceptatiecriteria voor het reset-script?**  
Test 1: file-bestaat (AC3-fundament). Test 2: node --check (AC3). Test 3: guard-regex (AC4-statisch). Test 4: tabellijst-sync (AC6-statisch). Dekking is volledig voor wat statisch verifieerbaar is.

### STACK-SPECIFIEK

**✓ Vanilla JS (geen frameworks)?**  
Alleen `require('fs')`, `require('path')`, `require('child_process')`, `require('dotenv')`, `require('pg')` — alle al aanwezig in het project.

**✓ Geen wijzigingen aan server.js?**  
Bevestigd via `git show --stat` per commit.

**✓ Geen nieuwe dependencies?**  
`dotenv` en `pg` waren al in `dependencies`. Geen `package.json`-wijziging in de TICKET-001-commits.

**✓ Geen hardcoded fallback-secrets?**  
`.env.test.example` bevat alleen `# vul in`-placeholders en de letterlijke waarde `IS_TEST_DATABASE=true` (geen secret).

### VEILIGHEID

**✓ .env.test staat in .gitignore?**
```
$ git check-ignore .env.test
.env.test
exit: 0
```

**✓ .env.test.example bevat alleen placeholders, geen echte secrets?**  
Bevestigd via directe lezing — alle waarden zijn `# vul in` behalve `IS_TEST_DATABASE=true`.

**✓ IS_TEST_DATABASE-guard werkt aantoonbaar?**  
Zie AC4 in Deel 2.

**✓ schema.sql staat in .gitignore?**
`.gitignore` bevat de regel `schema.sql` — bevestigd.

### Code-kwaliteitsopmerking (niet blokkerend)

`client.connect()` staat op regel 15 **buiten** het try/catch-blok (regel 16). Bij een DB-verbindingsfout gooit `async function resetTestDb()` een unhandled promise rejection i.p.v. de schone foutmelding via `process.exit(1)`. In de sandbox was dit zichtbaar:

```
node:internal/process/promises:394
    triggerUncaughtException(err, true /* fromPromise */);
Error: getaddrinfo EAI_AGAIN aws-1-eu-west-1.pooler.supabase.com
exit: 1
```

De exit code is nog steeds 1 (niet-nul) — de bescherming werkt dus. Maar de foutmelding is een lelijke stack trace i.p.v. `[reset-test-db] Fout tijdens reset: ...`. **Aanbeveling voor een volgende sessie:** `client.connect()` verplaatsen naar binnen het try/catch, of `.catch()` toevoegen aan `resetTestDb()`.

---

## DEEL 2 — END-TO-END VERIFICATIE

**Omgeving:** sandbox Linux, geen netwerktoegang naar externe Supabase-instanties. AC5, AC6 en AC9 konden daardoor niet volledig worden uitgevoerd en vereisen handmatige verificatie door Martijn.

### .env-wisseling

| Stap | Resultaat |
|---|---|
| Backup aangemaakt: `cp .env .env.productie-backup` | ✓ |
| Test-env actief: `cp .env.test .env` | ✓ |
| SUPABASE_URL na wisseling | `heslgvdipjyyeloujevz` (test-project ref) |
| IS_TEST_DATABASE na wisseling | `true` |
| IS_TEST_DATABASE in productie-.env vóór wisseling | afwezig (exit 1 bij grep) ✓ |
| .env hersteld na review: SUPABASE_URL | `pomgdjtbcqgpotmfpzai` (productie-ref) ✓ |

### AC-coverage

**AC 1 ✓ — .gitignore sluit .env.test uit**
```
$ git check-ignore .env.test; echo $?
.env.test
0
```

**AC 2 ✓ — .env.test.example heeft precies 8 env-vars, geen echte secrets**
```
SUPABASE_URL=# vul in
SUPABASE_ANON_KEY=# vul in
DATABASE_URL=# vul in
ANTHROPIC_API_KEY=# vul in
JWT_SECRET=# vul in
TEACHER_TOKEN=# vul in
PORT=# vul in (aanbevolen: 8080)
IS_TEST_DATABASE=true
```
8 regels, alle placeholders behalve IS_TEST_DATABASE. ✓

**AC 3 ✓ — node --check scripts/reset-test-db.js slaagt**
```
$ node --check scripts/reset-test-db.js; echo $?
0
```

**AC 4 ✓ — Script faalt hard als IS_TEST_DATABASE niet "true" is**

Test: `IS_TEST_DATABASE=false` tijdelijk in `.env.test` gezet.
```
$ node scripts/reset-test-db.js 2>&1; echo exit: $?
[reset-test-db] IS_TEST_DATABASE is niet "true" -- weigeren te draaien (productie-bescherming).
exit: 1
```
Daarna `.env.test` hersteld naar `IS_TEST_DATABASE=true`. ✓

**AC 5 ✗ — Script slaagt (exit 0) met geldige .env.test (idempotentie)**  
Fout bij handmatige run: `error: Tenant or user not found` — de `DATABASE_URL` in `.env.test` werkt niet. Oorzaak: verkeerde pooler-URL of connectie-format (zie §Bevindingen). Scriptcode zelf is correct. Configuratieprobleem in `.env.test`.

**AC 6 ✗ — Na reset zijn de opgegeven tabellen leeg**  
Niet verifieerbaar zolang AC5 faalt (script kan niet verbinden).

**AC 7 ✓ — tests/reset-test-db.test.js groen zonder database-verbinding**
```
Tests: 4 passed, 4 total
```

**AC 8 ✓ (pre-existente fouten ongewijzigd) — npm test**
```
Test Suites: 10 failed, 54 passed, 64 total
Tests:       42 failed, 327 passed, 369 total
```
42 falende tests = zelfde aantal als vóór TICKET-001. Geen regressie door dit ticket.

**AC 9 ✗ — Server start met .env.test en geeft /api/health 200**  
Server startte succesvol en draaide alle 6 migrations op de test-database:
```
[migrations] uitgevoerd: 001_initial_schema.sql
...
[migrations] uitgevoerd: 006_cleanup_null_leraar_id.sql
[migrations] klaar.
Toetsapp backend draait op poort 8080
```
Maar `GET http://localhost:8080/api/health` → 404 `Cannot GET /api/health`.  
Oorzaak: het endpoint bestaat niet in `server.js`. Architect-fout in het ticket — het endpoint was niet geïmplementeerd en mag niet worden toegevoegd in TICKET-001 (geen server.js-wijzigingen). Server zelf werkt correct met test-database.

**AC 10 ✓ — docs/testdatabase.md aanwezig met secties A-E en IS_TEST_DATABASE-waarschuwing**  
Bestand aanwezig, 146 regels. Secties A t/m E aanwezig. IS_TEST_DATABASE-waarschuwing in sectie C: "NOOIT in productie-.env zetten". Dump/import-procedure in sectie B met uitleg waarom (niet via migrations). ✓

---

## DEEL 3 — DOCUMENTATIE

| Item | Status |
|---|---|
| Sectie A aanwezig (Supabase-setup) | ✓ — CLI, login/link, project aanmaken |
| Sectie B aanwezig (dump/import) | ✓ — pg_dump, import, exec_sql, schema_migrations |
| Sectie C aanwezig (.env.test invullen) | ✓ — tabel met 8 vars + IS_TEST_DATABASE-waarschuwing |
| Sectie D aanwezig (Reviewer-run) | ✓ — commando's met backup/herstel + verwijzing naar WORKFLOW.md |
| Sectie E aanwezig (schema-updates) | ✓ — 5-stappen herhaal-checklist |
| Leesbaar voor onervaren developer | ✓ |

Kleine kanttekening bij sectie B: de documentatie verwijst naar `"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"` voor Windows maar geeft geen instructie voor Scoop/Homebrew-installatie (die staat wel in het ticket zelf). Voor Martijn is dit afdoende omdat het ticket ook de handmatige stappen beschrijft — de `docs/testdatabase.md` is de dagelijkse werkwijze, niet de eenmalige setup. Niet blokkerend.

---

## VEILIGHEIDSCHECK

| Check | Resultaat |
|---|---|
| .env hersteld naar productie | ✓ — SUPABASE_URL = pomgdjtbcqgpotmfpzai |
| .env.productie-backup verwijderd | ✗ — sandbox-rechtenbeperking. **Martijn verwijdert handmatig:** `del .env.productie-backup` |
| IS_TEST_DATABASE in productie-.env | Afwezig ✓ |
| .env.test niet gecommit | ✓ |

---

## Bevindingen uit handmatige verificatie

### AC5 / AC6 — Reset-script: ✗ CONFIGURATIEPROBLEEM

Foutmelding bij `node scripts/reset-test-db.js`:
```
error: Tenant or user not found (FATAL, code XX000)
```
Dit is een Supabase-fout op de `client.connect()`-aanroep. Oorzaak: de `DATABASE_URL` in `.env.test` gebruikt waarschijnlijk de **Transaction Pooler**-URL (standaard in het Supabase-dashboard), maar die werkt niet met `pg.Client` — die vereist de **Session Pooler** of een directe verbinding. Het ticket beschrijft dit onderscheid in Sectie B2 voor `pg_dump`, maar de instructie in Sectie C2 verwijst naar de directe URI (`db.<ref>.supabase.co:5432`) die op IPv4-netwerken kan falen. De configuratie van `.env.test` is de oorzaak — niet de scriptcode zelf.

Neveneffect: de lelijke stack trace bevestigt de eerder genoteerde code-kwaliteitsopmerking. `client.connect()` buiten de try/catch geeft geen vriendelijke foutmelding.

**Actie voor Martijn:** zie stap E hieronder.

### AC9 — Server health-endpoint: ✗ ARCHITECT-FOUT IN TICKET

De server startte succesvol, draaide alle 6 migrations op de test-database en luisterde op poort 8080. Maar `GET /api/health` gaf een 404 (`Cannot GET /api/health`).

Reden: **het `/api/health` endpoint bestaat niet in `server.js`**. Grep op `health` in server.js en routes/ geeft geen resultaat. Het endpoint is nooit geïmplementeerd. TICKET-001 verbiedt wijzigingen aan `server.js` — de Builder heeft dit correct nageleefd. De AC verwijst naar een niet-bestaand endpoint, wat een fout in het ticket is.

De server zelf werkt correct met `.env.test`. De AC9-formulering ("server start en geeft 200 op /api/health") is niet verifieerbaar zonder server.js aan te passen — dat valt buiten scope van TICKET-001.

**Actie voor Architect:** AC9 herformuleren of een follow-up ticket aanmaken voor het `/api/health` endpoint.

---

## Handmatige verificatie door Martijn (AC 5, 6, 9)

Voer deze stappen uit met de echte test-database. Houd browser open op het test-Supabase-dashboard.

**Stap E — DATABASE_URL repareren in `.env.test`**

De fout `Tenant or user not found` betekent dat de `DATABASE_URL` in `.env.test` de verkeerde Supabase-pooler gebruikt of het verkeerde gebruikersformat heeft.

Open `.env.test` in je editor en zoek de `DATABASE_URL`-regel. Die ziet er nu waarschijnlijk zo uit:
```
DATABASE_URL=postgresql://postgres:[WACHTWOORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```
Port `6543` = Transaction Pooler → werkt **niet** voor `pg.Client`.

De correcte URL gebruikt de **Session Pooler** (port 5432, ander hostname-formaat):

1. Ga naar het test-Supabase-dashboard (het `toetsapp-test`-project).
2. Linker navigatie → tandwiel → **Project Settings** → **Database**.
3. Klik op **"Connect"** (blauwe knop rechtsboven of in het midden van de pagina).
4. Kies de tab **"Session pooler"** (niet "Transaction pooler", niet "Direct connection").
5. Kopieer de URI. Die heeft dit formaat:
   ```
   postgresql://postgres.[PROJECT_REF]:[WACHTWOORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
   ```
   Let op: port is **5432** (niet 6543) en de gebruikersnaam is `postgres.<project-ref>`.
6. Vul je wachtwoord in (dat je opsloeg bij aanmaken van het project).
7. Vervang de `DATABASE_URL`-regel in `.env.test`.
8. Herhaal daarna stap A–D hierboven om AC5 en AC6 te verifiëren.

---

## VERDICT: APPROVED (met drie follow-up acties)

**De TICKET-001-code-deliverables zijn correct en compleet.** Alle acceptatiecriteria die door de Builder-code beïnvloed worden (AC1–AC4, AC7, AC8, AC10) zijn groen. De drie falende criteria (AC5, AC6, AC9) zijn **geen Builder-fouten**:

| AC | Status | Verantwoordelijke |
|---|---|---|
| AC1 | ✓ | Builder |
| AC2 | ✓ | Builder |
| AC3 | ✓ | Builder |
| AC4 | ✓ | Builder |
| AC5 | ✗ | Martijn — DATABASE_URL in .env.test is misconfigured |
| AC6 | ✗ | Martijn — blokkeert door AC5 |
| AC7 | ✓ | Builder |
| AC8 | ✓ | Builder (42 pre-existente fouten, geen regressie) |
| AC9 | ✗ | Architect — /api/health endpoint bestaat niet in server.js |
| AC10 | ✓ | Builder |

**Follow-up acties:**

1. **Martijn — DATABASE_URL repareren in `.env.test`** (zie stap E hieronder). Dan zijn AC5 en AC6 verifieerbaar. Dit is een eenmalige configuratiefix, geen code-wijziging.

2. **Architect — AC9 herformuleren.** `/api/health` bestaat niet. Ofwel: een nieuw ticket aanmaken voor dit endpoint (`GET /api/health → 200 {"status":"ok"}`), ofwel AC9 vervangen door een alternatieve server-start-verificatie (bijv. `curl http://localhost:8080/api/klassen` met lege array als respons na reset).

3. **Builder (volgende sessie) — `client.connect()` verplaatsen naar binnen try/catch** in `reset-test-db.js`, zodat verbindingsfouten een vriendelijke foutmelding geven i.p.v. een stack trace. Kleine wijziging, niet blokkerend voor de huidige functionaliteit.

**Git plumbing schending:** vastgelegd in TICKET-001-fix.md als preventieve maatregel. De commits zelf zijn inhoudelijk correct.
