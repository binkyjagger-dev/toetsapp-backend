# TICKET-002-review: Code Review

**Ticket:** TICKET-002 (jest.setup.js voor JWT_SECRET in tests)
**Commit:** d3f2903
**Reviewer:** Claude (Cowork sessie C)
**Datum:** 2026-04-24

---

## Verdict: ✅ APPROVED

---

## 1. Git-staat (verplichte eerste stap)

### git status (letterlijk)

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   .gitignore
  modified:   CLAUDE.md
  modified:   WORKFLOW.md
  modified:   [... 94 verdere bestanden ...]

Untracked files:
  tatus
  tickets/TICKET-001-fix.md
  tickets/TICKET-001-review.md
  tickets/TICKET-002-build.md
  tickets/TICKET-002.md
```

**Oordeel over de "modified" bestanden:**
`git diff server.js` laat zien dat de wijzigingen uitsluitend bestaan uit
`\r\n` → `\n` regeleindeconversie. Dit zijn CRLF-artefacten van de Linux
sandbox die Windows-bestanden ziet als gewijzigd vanwege line endings. Er
zijn geen inhoudelijke wijzigingen. De Builder heeft dit al benoemd in het
build-rapport. ✓

### git log --oneline -5 (letterlijk)

```
d3f2903 TICKET-002: jest.setup.js voor JWT_SECRET in tests
c455c46 chore: gitignore uitgebreid en TICKET-001 administratie
6001961 TICKET-001: docs/testdatabase.md met setup- en Reviewer-run-procedure
eaf2606 TICKET-001: reset-test-db.js met productie-guard + statische tests (TDD groen)
ff043af TICKET-001: .env.test.example met 8 env-vars en IS_TEST_DATABASE=true placeholder
```

Commit-boodschap volgt de afgesproken notatie `TICKET-XXX: <samenvatting>`. ✓

### git log origin/main..HEAD (letterlijk)

```
(leeg — geen output)
```

**⚠ Workflow-afwijking geconstateerd:**
De commit d3f2903 is reeds gepusht naar `origin/main`. De Builder rapporteerde
in het build-rapport "1 commit wacht op push", maar dat is inmiddels uitgevoerd.
Per WORKFLOW.md stap 8 hoort push pas na goedkeuring van de Reviewer te
gebeuren. Dit is een procedurele afwijking, geen code-kwaliteitsprobleem.
De code zelf is inhoudelijk correct — zie hieronder. Aanbeveling: in
toekomstige sessies pushen pas nadat de Reviewer APPROVED heeft gegeven.

---

## 2. Specifieke aandachtspunten

### A. Beveiligingscheck jest.setup.js ✓

Bestand gelezen. Inhoud:

```js
// Jest setup: overschrijf JWT_SECRET met de testwaarde vóór elke testsuite.
// Dit zorgt dat server.js dezelfde sleutel gebruikt als de testbestanden.
process.env.JWT_SECRET = 'stanislascollege_mol_secret_2025';
```

De waarde is **gelijk aan** `'stanislascollege_mol_secret_2025'` en is **niet
gelijk aan** `'stanislas_mol_jwt_2025_xK9mP'` (de productiewaarde).

Geen productiegeheim gecommit. ✓

Kanttekening: 'stanislascollege_mol_secret_2025' stond al hardcoded in 10
testbestanden vóór dit ticket — het is geen nieuw lek, en het is de juiste
testwaarde.

### B. Tatus-bestand ✓

Het bestand `tatus` is aanwezig in de projectroot. Het staat als **untracked**
in git status. Het is niet opgenomen in commit d3f2903 en heeft geen invloed
op de codebase. Waarschijnlijk een overblijfsel van een `git tatus`-typfout.
Niet geblokkeerd, maar kan worden opgeruimd.

### C. CRLF-claim ✓

`git show d3f2903 --stat` bevestigt: de commit bevat uitsluitend:

```
jest.setup.js | 3 +++
package.json  | 3 +++
2 files changed, 6 insertions(+)
```

De `git diff d3f2903 --name-only` toont veel bestanden, maar dat vergelijkt
de commit met de huidige werktree (Linux sandbox vs. Windows CRLF). De commit
zelf is inhoudelijk beperkt tot precies de twee genoemde bestanden. ✓

### D. npm test ✓

```
Test Suites: 64 passed, 64 total
Tests:       369 passed, 369 total
Snapshots:   0 total
Time:        31.267 s

lint:html — geen inline <script> blokken gevonden
```

**0 failures. 369 tests groen.**

lessons-detail.test.js: ✓ groen (opgenomen in de 64 passing suites).
Geen tweede-orde-failures aangetroffen, zoals het onderzoeksrapport als
risico benoemde. ✓

---

## 3. Code Review Checklist

### SCOPE

- ✓ Doet de code wat het ticket vraagt?
  Ja. jest.setup.js overschrijft JWT_SECRET met de testwaarde; package.json
  registreert het bestand via `"setupFiles": ["./jest.setup.js"]`. Exact
  wat Optie 1 uit het onderzoeksrapport beschreef.

- ✓ Doet de code NIETS wat het ticket niet vraagt?
  Ja. Uitsluitend 2 bestanden gewijzigd, uitsluitend wat het ticket vroeg.
  server.js en testbestanden zijn onaangeroerd.

- ✓ Zijn alle acceptatiecriteria afgedekt?
  Alle 6 criteria uit het build-rapport zijn bevestigd.

### KWALITEIT (Simon Willison + CLAUDE.md)

- ✓ Code begrijpelijk voor een onervaren developer?
  3 regels code + 2 regels commentaar die precies uitleggen wat het doet
  en waarom. Uitstekend.

- ✓ Functies klein (≤20-25 regels)? N.v.t. — geen functies.

- ✓ Geen premature abstractie? N.v.t.

- ✓ Wijzigingen < 50 regels per wijziging?
  6 regels totaal. ✓

- ✓ HTML en JS strikt gescheiden? N.v.t. — geen HTML betrokken.

### TESTS

- ✓ Tests toegevoegd voor alle nieuwe logica?
  jest.setup.js is test-infrastructuur, geen feature-logica. Er zijn geen
  aparte unit tests nodig; de 42 voormalige failures die nu groen zijn
  vormen de functionele verificatie.

- ✓ Dekken de tests de acceptatiecriteria?
  Indirect: alle 369 tests slagen, inclusief de 42 die voorheen faalden
  door de JWT-mismatch.

- ✓ Edge cases getest? N.v.t. voor configuratiewijziging.

- ✓ npm test groen? 369/369. ✓

### STACK-SPECIFIEK

- ✓ Vanilla JS (geen frameworks ingeslopen)? Ja.

- ✓ Supabase-queries veilig? N.v.t.

- ✓ Geen hardcoded fallback-secrets toegevoegd?
  'stanislascollege_mol_secret_2025' is geen nieuw secret — het stond al
  hardcoded in 10 testbestanden. Dit is de correcte testwaarde. ✓

- ✓ Geen breaking API-contracten? N.v.t.

### VEILIGHEID

- ✓ Geen geheimen in code?
  jest.setup.js bevat uitsluitend de bekende testwaarde
  'stanislascollege_mol_secret_2025', niet de productiewaarde. ✓

- ✓ Input-validatie? N.v.t.
- ✓ Geen nieuwe XSS-vectoren? N.v.t.
- ✓ AVG: geen leerlingdata naar externe API's? N.v.t.

---

## 4. Samenvatting

De implementatie is correct, minimaal, en exact binnen scope. 6 regels code
lossen een infrastructuurprobleem op dat 42 tests rood maakte. De code is
goed voorzien van commentaar, bevat geen veiligheidsproblemen, en alle 369
tests zijn groen inclusief het risicovolle lessons-detail.test.js.

**Enige aandachtspunt voor Martijn:** de commit is al live op origin/main
(dus ook op Railway als Railway automatisch deployt bij push naar main).
Geen actie vereist voor de code zelf; wel de procedure voor volgend keer
bijstellen: push pas na APPROVED van Reviewer.

**Aanbeveling uit het build-rapport (niet blokkerend):**
Het bestand `tatus` in de root kan worden verwijderd. Een `.gitattributes`
met `* text=auto` kan de CRLF-artefacten in de Linux sandbox voorkomen.
Beide zijn kleine opruimtaken voor een apart moment.

---

## Deel 2: API end-to-end verificatie

**N.v.t.** — Dit ticket bevat geen nieuwe API-endpoints. Zoals gespecificeerd
in de Reviewer-preamble voor TICKET-002 geldt alleen Deel 1 (code review).

---

## Conclusie

| Check | Uitkomst |
|---|---|
| A. Beveiligingscheck jest.setup.js | ✅ Testwaarde, niet productiewaarde |
| B. Tatus-bestand | ✅ Untracked, niet in commit |
| C. CRLF-claim | ✅ Commit bevat uitsluitend jest.setup.js + package.json |
| D. npm test (369 tests) | ✅ 369/369 groen |
| lessons-detail.test.js groen | ✅ Bevestigd |
| Workflow (push volgorde) | ⚠ Commit al gepusht vóór review — geen code-issue |

**Verdict: APPROVED**
