# Review: TICKET-004 — MOL-03 sessie 2 (Fix 3 + Fix 4)

```
Ticket:  TICKET-004-MOL-03-sessie2
Commit:  0cb53d56b0172ccde7a7da7fa75b57095d2052f9
Datum:   2026-04-25
Verdict: APPROVED
```

---

## Deel 1 — Code Review

### SCOPE

✓ **Doet de code wat het ticket vraagt?**
Ja. Fix 3 verwijdert textarea + validatie uit scherm 10; Fix 4 voegt de dubbele filter toe
aan `pollSpelerStatus()`. Precies wat het ticket beschrijft.

✓ **Doet de code NIETS wat het ticket niet vraagt?**
Nee. De diff is minimaal: 9 regels verwijderd uit `speler.js`, 4 regels uit
`mol-lesvorm.html`, 172 regels nieuwe tests. Geen nevenwerkingen.

> ⚠ **Observatie (niet blokkerend):** `selecteerTestRonde()` (speler.js, regel 901) is
> na Fix 3 dode code geworden — ze wordt nergens meer aangeroepen. Dit ticket vraagt
> niet om opruimen, maar een volgend ticket kan dit oppakken.

✓ **Zijn alle acceptatiecriteria afgedekt?**
Ja, zie Deel 2.

---

### KWALITEIT (Simon Willison + CLAUDE.md)

✓ **Code begrijpelijk voor een onervaren developer?**
Ja. De verwijderingen maken de functies eenvoudiger. `submitTest()` is gedaald van ~20
naar ~14 regels.

✓ **Functies klein (≤20-25 regels)?**
`renderSpelerTest()` en `submitTest()` vallen nu ruim binnen de limiet.

✓ **Geen premature abstractie?**
Geen nieuwe abstracties geïntroduceerd.

✓ **Wijzigingen < 50 regels per wijziging?**
HTML-wijziging: 4 regels. JS-wijziging: 9 regels. Beide ruim onder de grens.

✓ **HTML en JS strikt gescheiden?**
Ja. HTML-structuur in `mol-lesvorm.html`, JS-gedrag in `speler.js`. Geen HTML in JS
gebouwd buiten het template-patroon.

---

### TESTS

✓ **Tests toegevoegd voor alle nieuwe logica?**
Ja. `mol-test-scherm.test.js` (Fix 3) en `mol-wacht-scherm6.test.js` (Fix 4).

✓ **Dekken de tests de acceptatiecriteria?**
Ja. Elk acceptatiecriterium heeft minimaal één test.

> ⚠ **Observatie (niet blokkerend):** De wacht-chip tests roepen `renderSpelerRonde()`
> aan met al vooraf-gefilterde `alleAntwoorden`-data. De filterlogica in
> `pollSpelerStatus()` zelf (ronde_nr + groepsfilter) heeft geen dedicated unit test.
> Dit is een kleine gap: als iemand de filter ooit verwijdert, vangen de wacht-chip
> tests dat niet op. De diff-inspectie bevestigt de filter wél correct staat (zie Deel 2).
> Kan opgepakt worden in een afzonderlijk ticket als technische schuld.

> ⚠ **Observatie (niet blokkerend):** De wacht-chip tests testen niet het randgeval
> "leerling uit een andere groep met hetzelfde ronde_nr". In productie is dit gedekt
> door de groepsfilter in `pollSpelerStatus()`, maar een testgeval zou dit explicieter
> vastleggen.

✓ **Tests leesbaar zonder extra uitleg?**
Ja. Elke testfile heeft een JSDoc-header, `beforeAll`/`beforeEach` zijn duidelijk,
testnamen beschrijven exact het gedrag.

✓ **npm test groen?**
Ja — 412 tests, 0 failures, 73 suites. Zie Deel 2.

---

### STACK-SPECIFIEK

✓ **Vanilla JS (geen frameworks ingeslopen)?**
Geen frameworks. Puur vanilla JS + jsdom in tests.

✓ **Supabase-queries veilig?**
Geen nieuwe server-side queries. Frontend-only wijziging.

✓ **Geen hardcoded fallback-secrets toegevoegd?**
Geen secrets in de diff.

✓ **Geen breaking API-contracten zonder melding?**
`argument` verdwijnt uit de POST-body van `/api/mol/sessies/:id/test`. Verificatie in
`server.js` (regel 2015) toont dat de server dit veld nooit destructureerde of gebruikte:
```js
const { leerling_id, verdachte_id } = req.body;
```
Geen breaking change. Het veld bestond alleen client-side.

---

### VEILIGHEID

✓ **Geen geheimen in code?**
Geen.

✓ **Input-validatie waar input van buitenaf komt?**
De min-lengte check op `argument` is terecht verwijderd — het veld bestaat niet meer.
De validatie op `testVerdachteId` (server-side: verdachte_id verplicht impliciet aanwezig
via upsert) blijft intact.

✓ **Geen nieuwe XSS-vectoren in de frontend?**
Geen nieuwe `innerHTML`-patronen. Verwijderingen reduceren het aanvalsoppervlak.

✓ **AVG: geen leerlingdata naar externe APIs?**
Geen externe API-calls toegevoegd.

---

## Deel 2 — Verificatie via diff en testuitvoer

### Stap 1 — node --check

```
node --check netlify-deploy/mol-js/speler.js
(geen output)
exit: 0
```
✓ Geen syntaxfouten.

---

### Stap 2 — npm test

```
Test Suites: 73 passed, 73 total
Tests:       412 passed, 412 total
Snapshots:   0 total
Time:        30.475 s
```
✓ 412 tests groen (baseline 407 + 5 nieuw). Geen regressie.

> Let op: de `lint:html` SyntaxError is een pre-existing fout in `scripts/lint-html.js`
> en staat los van deze commit. Geen regressie van TICKET-004.

---

### Stap 3 — Verificatie Fix 3 via diff + directe bestandscheck

**mol-lesvorm.html — aanwezigheid van verwijderde elementen:**

| Element | Aanwezig in huidige code? | Verwacht |
|---|---|---|
| `id="test-argument-tekst"` | Nee (python3 grep: geen treffer) | Nee ✓ |
| `id="test-ronde-keuze"` | Nee (python3 grep: geen treffer) | Nee ✓ |

> **Noot:** `test-argument-tekst` is verwijderd in déze commit (diff regel –1313 t/m –1316).
> `test-ronde-keuze` was al verwijderd uit de HTML in een eerdere commit; commit 0cb53d5
> verwijdert de bijbehorende rendering-code in `renderSpelerTest()`.

**netlify-deploy/mol-js/speler.js — submitTest():**

| Patroon | Aanwezig? | Verwacht |
|---|---|---|
| `test-argument-tekst` | Nee | Nee ✓ |
| `arg.length` (in submitTest) | Nee* | Nee ✓ |
| `argument: arg` in POST-body | Nee | Nee ✓ |

> *`arg.length` komt nog voor op regel 811 in `submitAntwoord()` — een andere functie.
> Dit is correct gedrag; die validatie hoort daar thuis.

**netlify-deploy/mol-js/speler.js — renderSpelerTest():**

| Patroon | Aanwezig? | Verwacht |
|---|---|---|
| `test-ronde-keuze` | Nee | Nee ✓ |
| `rondeOpties` | Nee | Nee ✓ |

---

### Stap 4 — Verificatie Fix 4 via diff

**pollSpelerStatus() regel 153:**

```js
const alleAntwoorden = antwoorden.filter(a => a.ronde_nr === ronde && mijnGroep.some(l => l.id === a.leerling_id));
```

Ticket verwachtte exact:
```js
antwoorden.filter(a => a.ronde_nr === ronde && mijnGroep.some(l => l.id === a.leerling_id))
```

✓ Exacte overeenkomst. Zowel `ronde_nr`-filter als groepsfilter aanwezig.

---

### Stap 5 — Acceptatiecriteria per criterium

**Fix 3:**

| # | Criterium | Status |
|---|---|---|
| 3.1 | mol-lesvorm.html: `test-argument-tekst` verwijderd | ✓ verwijderd in deze commit |
| 3.2 | mol-lesvorm.html: `test-ronde-keuze` sectie verwijderd | ✓ afwezig in huidige code |
| 3.3 | speler.js submitTest(): argumenttekst-validatie verwijderd | ✓ geen `arg.length`/`argument: arg` in submitTest |
| 3.4 | speler.js renderSpelerTest(): ronde-keuze rendering verwijderd | ✓ `rondeOpties` en `rc.innerHTML` weg |
| 3.5 | tests bevestigen Fix 3 (3 cases) | ✓ 3 tests groen in mol-test-scherm.test.js |

**Fix 4:**

| # | Criterium | Status |
|---|---|---|
| 4.1 | pollSpelerStatus(): filter op ronde_nr én mijnGroep | ✓ regel 153, exacte match |
| 4.2 | tests: wacht-chip `klaar` class bij ingediend | ✓ groen in mol-wacht-scherm6.test.js |
| 4.3 | tests: geen `klaar` class als niet ingediend | ✓ groen in mol-wacht-scherm6.test.js |

**Alle 7 (technisch 8) acceptatiecriteria: ✓**

---

## Verdict

**APPROVED**

De code doet exact wat het ticket vraagt. Tests zijn groen, node --check slaagt,
geen regressie, geen security-issues, geen API-breaking changes.

Twee niet-blokkerende observaties voor een volgend ticket:
1. `selecteerTestRonde()` (speler.js:901) is dode code na Fix 3 — opruimen.
2. Unit test voor de groepsfilter in `pollSpelerStatus()` ontbreekt — kan als technische
   schuld worden opgepakt.
