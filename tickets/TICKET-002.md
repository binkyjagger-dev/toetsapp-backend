# TICKET-002: Onderzoeksrapport — 42 falende tests

**Status:** Onderzoek voltooid — wacht op beslissing Martijn
**Type:** Onderzoeksrapport (geen implementatieplan)
**Aangemaakt door:** Architect
**Datum:** 2026-04-24

---

## Samenvatting

Alle 42 falende tests hebben **één enkele oorzaak**: een JWT_SECRET-mismatch
tussen de testbestanden en de productie-`.env` die gisteren voor het eerst
geladen werd via `dotenv`.

Er zijn geen meerdere categorieën. Er zijn geen beschadigde endpoints, geen
kapotte testlogica, geen ingestorte refactors. Het is één configuratiefout
die tegelijk 10 testbestanden raakt.

---

## 1. Overzicht per categorie

### Categorie A — verifyToken endpoints: HTTP 401 (41 failures)

**Wat er gebeurt:**
De server laadt via `require('dotenv').config()` de productie-`.env`, die
`JWT_SECRET=stanislas_mol_jwt_2025_xK9mP` bevat. De `verifyToken`-middleware
verifieert tokens dus met dit secret.

Alle 10 falende testbestanden hebben bovenaan hardcoded staan:
```js
const JWT_SECRET = 'stanislascollege_mol_secret_2025';
```
Dit was de oorspronkelijke fallback-waarde in `server.js`. Tokens die met
deze waarde worden gesigneerd, worden door de server afgewezen (verkeerd
secret → `jwt.verify` gooit een error → 401).

**Betrokken testbestanden en aantallen:**

| Testbestand | Failures | Endpoints getest |
|---|---|---|
| `tests/mol-flow.test.js` | 14 | GET/POST `/api/mol/sessies`, `/groep-status`, `/state`, `/test-vragen`, `/resultaten` |
| `tests/lesson-planning.test.js` | 6 | POST/PATCH/GET `/api/lesson_classes` |
| `tests/mol-schermen.test.js` | 5 | POST/GET diverse `/api/mol/` endpoints |
| `tests/leerdoelen.test.js` | 3 | GET/POST `/api/leerdoelen` |
| `tests/leerlingen.test.js` | 3 | POST `/api/leerlingen/koppel-klas` |
| `tests/lessons-detail.test.js` | 3 | GET `/api/lessons` |
| `tests/classes.test.js` | 2 | GET `/api/classes` |
| `tests/auth-security.test.js` | 2 | GET `/api/classes` |
| `tests/lesson-multi-class.test.js` | 2 | GET `/api/lessons` |

**Geschatte moeite:** XS

---

### Categorie B — optionalToken endpoint: stille mislukking (1 failure)

**Wat er gebeurt:**
`POST /api/lessons` gebruikt `optionalToken` (blokkeert niet bij verkeerd
token, pikt alleen het leraar-ID op als het token klopt). Door het verkeerde
secret valt `jwt.verify` stil — `req.leraar` wordt nooit gezet —
`req.leraar?.id` geeft `null` terug in plaats van `'leraar-42'`.

**Betrokken testbestand:**

| Testbestand | Failures | Test |
|---|---|---|
| `tests/lessons.test.js` | 1 | `stores leraar_id from JWT token` |

De andere twee tests in dit bestand slagen wel, omdat ze niet afhankelijk
zijn van het JWT-payload.

**Geschatte moeite:** XS (zelfde fix als categorie A)

---

## 2. Tijdlijn van de oorzaak

```
Vóór gisteren:
  server.js: const JWT_SECRET = process.env.JWT_SECRET || 'stanislascollege_mol_secret_2025';
  → process.env.JWT_SECRET was leeg in tests → fallback werd gebruikt → tests werkten

Gisteren (commit a8f4a2e, 23-04-2026 17:06):
  "chore: dotenv toegevoegd voor lokale env-variabelen"
  → require('dotenv').config() toegevoegd aan server.js
  → .env met JWT_SECRET=stanislas_mol_jwt_2025_xK9mP werd nu wél geladen
  → fallback wordt niet meer bereikt
  → tokens in tests (gesigneerd met old fallback) worden geweigerd
  → 42 tests rood
```

De tests waren dus niet al "langer" rood — ze zijn rood geworden door de
dotenv-commit van gisteren. Vóór die commit werkten ze.

---

## 3. Verificatie: beide .env-bestanden bevatten hetzelfde (verkeerde) secret

```
.env:      JWT_SECRET=stanislas_mol_jwt_2025_xK9mP
.env.test: JWT_SECRET=stanislas_mol_jwt_2025_xK9mP
```

Beide bestanden bevatten hetzelfde secret, maar geen van beide komt overeen
met de hardcoded waarde in de testbestanden.

---

## 4. Prioritering

### Laaghangend fruit

De hele batch van 42 failures is laaghangend fruit. Er is één fix nodig:
zorgen dat het JWT-secret dat de server gebruikt tijdens tests overeenkomt
met het secret dat de tests gebruiken om tokens te signen.

Er zijn twee gelijkwaardige oplossingsrichtingen (keuze is aan Martijn):

**Optie 1 — jest.setup.js (voorkeur):**
Voeg een `jest.setup.js` toe dat `process.env.JWT_SECRET` overschrijft
naar de bekende testwaarde, en registreer dit in `package.json` als
`"jest": { "setupFiles": ["./jest.setup.js"] }`.
Voordeel: geen wijzigingen in de 10 testbestanden.

**Optie 2 — dotenv blokkeren voor tests:**
Zorg dat `dotenv` tijdens `jest`-runs géén `.env` laadt (bijv. via
`NODE_ENV=test` guard in server.js, of via `jest --env`). De fallback
`'stanislascollege_mol_secret_2025'` zou dan actief worden.
Nadeel: vereist logica in server.js die niet in productie hoort.

---

## 5. Aanbevolen vervolgaanpak

**Dit moet één klein ticket worden: TICKET-002-fix.**

Geen reden om het op te splitsen — er is één oorzaak, één fix.

Geschatte omvang: **XS**
- 1 nieuw bestand: `jest.setup.js` (~3 regels)
- 1 aanpassing: `package.json` (jest.setupFiles instellen)
- Geen wijzigingen in tests, geen wijzigingen in server.js

Na de fix: alle 42 tests zouden direct groen moeten worden, mits de
endpoints zelf correct geïmplementeerd zijn (wat de groene tests in dezelfde
bestanden suggereren).

**Volgorde:**
1. TICKET-002-fix (XS) — basisinfrastructuur test-JWT herstellen
2. Daarna pas nieuwe features — pas als de testsuite betrouwbaar groen is

---

## 6. Risicoanalyse

### Verhullen de falende tests echte bugs?

**Nee.** De tests falen niet omdat de productie-code kapot is — ze falen
omdat de test-infrastructuur verkeerd geconfigureerd is. De endpoints zelf
zijn correct: ze geven terecht 401 als een token met het verkeerde secret
binnenkomt. Dit is correct beveiligingsgedrag.

### Risico van het laten staan

Het echte risico zit niet in de falende tests zélf, maar in de situatie die
ze creëren: **de testsuite geeft geen betrouwbaar signaal meer.** Als er
een echte regressie wordt geïntroduceerd in een van de 10 betrokken
testbestanden, valt die volledig weg in de ruis van de bestaande 42 failures.

### Na de fix: kan de fix nieuwe problemen onthullen?

Mogelijk. Nu de endpoints nooit bereikt worden (401 blokkeert alles), zijn
er een aantal testscenario's die na de fix voor het eerst écht uitgevoerd
worden:
- `lesson-planning.test.js` — tests voor POST/PATCH `lesson_classes`:
  de junctionChain-mock heeft `select()` en `single()` — controleer of
  de mock-keten correct is opgebouwd voor de server-code (dit is niet
  zichtbaar zolang de 401 blokkeert)
- `lessons-detail.test.js` — de `from('lesson_classes')`-aanroep in
  `GET /api/lessons` valt terug op `lessonsChain` (de test mockt
  `lesson_classes` niet apart) — dit kan na de fix alsnog falen met een
  andere fout

Dit zijn potentiële **tweede-orde-failures**: tests die nu 401 geven maar
na de fix mogelijk een andere fout tonen. De Builder moet hierop bedacht
zijn en dit rapporteren als het voorkomt.

---

## 7. Bijzonderheden aangetroffen tijdens onderzoek

- `mol-flow.test.js`: sommige failures tonen niet "Expected 200, Received 401"
  maar "Expected 'ronde_1', Received undefined" — dit is dezelfde oorzaak
  (401 → leeg body → `.fase` is undefined), maar de test checkt `res.body.fase`
  zonder eerst `res.status` te checken. Dit maskeert de werkelijke 401.
  Niet een bug, maar een zwakke plek in de testopzet die het debuggen bemoeilijkt.

- `.env.test.example` heeft `JWT_SECRET=# vul in` als placeholder — de
  eigenaar heeft dit niet ingevuld met de fallback-waarde. Als de Reviewer
  `.env.test` gebruikt voor end-to-end tests, werkt dat correct (dezelfde
  productie-JWT wordt gebruikt). Maar voor Jest-unit-tests is dit de
  verkeerde waarde.

- Geen enkel testbestand laadt `dotenv` zelf — ze gaan er allemaal vanuit
  dat `JWT_SECRET` niet in de omgeving staat. Dit was een geldige aanname
  vóór de dotenv-commit van gisteren.

---

## Conclusie

| | |
|---|---|
| **Aantal unieke oorzaken** | 1 |
| **Betrokken testbestanden** | 10 |
| **Betrokken failures** | 42 |
| **Fix-omvang** | XS |
| **Risico op echte productie-bugs** | Laag |
| **Aanbeveling** | 1 ticket (TICKET-002-fix), XS, Builder-sessie |
