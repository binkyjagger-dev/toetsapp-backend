# TICKET-017: Post-submit-flow per groep — 10s bevestiging, dan volgende ronde of moltest

**Status:** Ready for Build
**Grootte:** M
**Aangemaakt door:** Architect
**Datum:** 2026-05-01

## Doel
Zodra het groepshoofd het groepsantwoord heeft ingediend, zien **alle**
leden van die groep gedurende **10 seconden** een scherm met het
gekozen groepsantwoord. Daarna gaat de groep automatisch verder:
- Naar de invoer van de volgende ronde, óf
- Naar de moltest als dit de laatste ronde was.

Per groep, onafhankelijk van andere groepen, zonder docent-tussenkomst.

## Achtergrond — root cause

Na TICKET-015 retourneert `bepaalGroepStatus` `fase: 'resultaat'`
zodra een groep een rij in `mol_groep_stemmen` heeft. Drie problemen:

1. `pollSpelerStatus` (`speler.js:181-184`) routeert `'resultaat'`
   naar `renderFeedbackScherm()` — niet naar
   `screen-speler-groepsantwoord`. Daardoor zien gewone leerlingen het
   groepsantwoord-bevestigingsscherm helemaal niet.
2. Het bevestigingsscherm (alleen door `submitGroepsantwoord` lokaal
   getoond aan het groepshoofd) telt 5 seconden af in plaats van 10
   — en het countdown-element (`groepsantwoord-countdown`) ontbreekt
   in de HTML.
3. `bepaalGroepStatus` heeft geen logica om na `'resultaat'` naar de
   volgende ronde of de moltest te transitioneren. `mol_groepen.ronde_nr`
   blijft op 1, en er is geen endpoint om de groep verder te zetten.
4. Bug onderwater: `submitGroepsantwoord` (`speler.js:403`) en
   `renderFeedbackScherm` (`speler.js:351`) gebruiken
   `speler.ronde_nr || 1`. `mol_leerlingen` heeft geen `ronde_nr`-kolom,
   dus dit valt altijd terug op `1`. In ronde 2+ wordt het
   groepsantwoord onder ronde 1 opgeslagen.

Bevestigd op productie 2026-05-01: groepshoofd ziet
`screen-speler-groepsantwoord` 5 sec, dan blijft hij hangen op
feedback-scherm zonder doorgang. Andere leerlingen zien
`screen-speler-groepsantwoord` helemaal niet.

## Scope

### Wel
- **Frontend (speler.js):**
  - `pollSpelerStatus` op `fase: 'resultaat'` toont
    `screen-speler-groepsantwoord` (niet `renderFeedbackScherm`),
    met daarop het door het groepshoofd gekozen antwoord (leesbaar)
    en een 10-seconden countdown.
  - Na de countdown: één leerling-side call naar nieuw endpoint
    `POST /api/mol/groep-volgende-fase` met `huidige_ronde_nr` als
    veiligheidssleutel, idempotent.
  - `submitGroepsantwoord` blijft het scherm direct lokaal tonen voor
    het groepshoofd (zonder dubbele poll-render); de gewone leerlingen
    pakken het via de poll op.
  - Bug-fix #4: gebruik `groepStatus.ronde_nr` (uit het laatst-opgehaalde
    `/groep-status`-antwoord) in plaats van `speler.ronde_nr`. Bewaar
    in een module-locale `let huidigeRondeNr = 1`, geüpdatet in
    `pollSpelerStatus`.
  - `renderFeedbackScherm` en `screen-speler-feedback` blijven
    bestaan — gebruikt aan het einde van de sessie na de moltest
    (out-of-scope: niet aangeraakt).

- **Frontend (HTML — mol-lesvorm.html):**
  - In `screen-speler-groepsantwoord` (regel 1275-1283): voeg een
    countdown-element toe (`<span id="groepsantwoord-countdown">10</span>`)
    en vervang "Feedback verschijnt zo..." door "Volgende fase over
    <span id='groepsantwoord-countdown'>10</span> seconden…".

- **Backend — nieuw endpoint:**
  - `POST /api/mol/groep-volgende-fase`
  - Body: `{ sessie_id, groep_id, huidige_ronde_nr }`
  - Logica:
    - Lees `mol_groepen` voor `groep_id`. Lees `mol_sessies.n_rondes`.
    - Idempotentie-check: als `groep.ronde_nr !== huidige_ronde_nr`
      → return `{ ok: true, advanced: false }`. Iemand anders heeft
      al geadvanced.
    - Anders: als `huidige_ronde_nr < n_rondes`: update
      `mol_groepen.ronde_nr = huidige_ronde_nr + 1`, `fase = 'invoer'`.
      Return `{ ok: true, advanced: true, next: 'ronde', ronde_nr: huidige_ronde_nr + 1 }`.
    - Anders (laatste ronde): update `mol_groepen.fase = 'test'`.
      Return `{ ok: true, advanced: true, next: 'test' }`.

- **Backend — `bepaalGroepStatus` uitbreiding:**
  - Nieuwe vroege check in de briefing-tak (vóór de bestaande
    `groep?.fase === 'invoer'` check): als `groep?.fase === 'test'`,
    return `{ fase: 'test', ronde_nr: groep.ronde_nr || 1, wacht_op: [] }`.

### Niet
- Géén verwijdering van `renderFeedbackScherm` of het feedback-scherm.
  Die worden in de sessie-eindfase nog gebruikt.
- Géén ondersteuning voor open-vraag-discussie (zie TICKET-016 scope).
- Géén wijziging in `/api/mol/sessies/:id/groepsantwoord` of `/api/mol/groep-stem-hoofd`.
- Géén verplaatsing van fase-state naar `mol_groepen.fase`-enum
  buiten wat dit ticket nodig heeft (`'briefing' | 'invoer' | 'test'`
  blijft, ronde_nr blijft de drijfveer voor de invoer-fase). Volledige
  refactor blijft TICKET-018 (vervolgsuggestie).
- Géén wijziging in de docent-UI of het auto-advance-mechanisme.
- Géén ondersteuning voor "groepshoofd komt nooit met antwoord" (geen
  timeout-fallback). Aparte ticket als die edge-case gewenst is.

## Acceptatiecriteria

1. [ ] **AC1 — alle leden zien het bevestigingsscherm:** Wanneer het
   groepshoofd `POST /api/mol/sessies/:id/groepsantwoord` succesvol
   uitvoert, retourneert `bepaalGroepStatus` voor álle leerlingen in
   die groep `fase: 'resultaat'`. De frontend (`pollSpelerStatus`)
   toont op die fase voor élke leerling — groepshoofd én niet —
   `screen-speler-groepsantwoord` (niet `screen-speler-feedback`).

2. [ ] **AC2 — gekozen antwoord leesbaar getoond:** Op
   `screen-speler-groepsantwoord` toont `#groepsantwoord-tekst` de
   leesbare tekst van het door het groepshoofd gekozen antwoord (niet
   de raw MC-optie-ID). Bij MC: opzoeken in
   `sessieState.cases[ronde].mc_opties`. Bij `'correct'`: tekst
   "Correct antwoord". Bij `'fout'`: tekst "Alternatief antwoord".

3. [ ] **AC3 — 10-seconden countdown:** Op
   `screen-speler-groepsantwoord` is een element zichtbaar met id
   `groepsantwoord-countdown` dat van **10 naar 0** telt (1 keer per
   seconde). Bij 0 wordt automatisch
   `POST /api/mol/groep-volgende-fase` aangeroepen.

4. [ ] **AC4 — endpoint `/groep-volgende-fase` bestaat:**
   `POST /api/mol/groep-volgende-fase` met body
   `{ sessie_id, groep_id, huidige_ronde_nr }` retourneert HTTP 200
   en zet `mol_groepen.ronde_nr = huidige_ronde_nr + 1` als er nog
   meer rondes zijn, of `mol_groepen.fase = 'test'` als de laatste
   ronde voorbij is. Zonder van deze velden in de body → HTTP 400.

5. [ ] **AC5 — idempotent:** Twee opeenvolgende calls op
   `/groep-volgende-fase` met dezelfde `huidige_ronde_nr` updaten
   `mol_groepen` slechts één keer. Tweede call retourneert
   `{ ok: true, advanced: false }`.

6. [ ] **AC6 — overgang naar volgende ronde werkt per groep:**
   Sessie met `n_rondes: 3`. Groep A is in ronde 1 met groepsantwoord
   ingediend. Na een succesvolle `/groep-volgende-fase`-call met
   `huidige_ronde_nr: 1`, retourneert
   `GET /api/mol/sessies/:id/groep-status?groep_id=<A>`
   `{ fase: "invoer", ronde_nr: 2, wacht_op: [<alle leden>] }`.

7. [ ] **AC7 — overgang naar moltest na laatste ronde:**
   Sessie met `n_rondes: 1`. Groep A is in ronde 1 met groepsantwoord
   ingediend. Na een succesvolle `/groep-volgende-fase`-call,
   retourneert `groep-status` voor groep A
   `{ fase: "test", ronde_nr: 1, wacht_op: [] }`.

8. [ ] **AC8 — onafhankelijkheid:** In dezelfde sessie zit groep B nog
   in ronde 1 met `mol_groepen.fase = 'invoer'`, geen antwoorden.
   Na de `/groep-volgende-fase`-call van groep A blijft `groep-status`
   voor groep B `{ fase: "invoer", ronde_nr: 1, wacht_op: [<alle leden>] }`.

9. [ ] **AC9 — ronde_nr-bug gefixt:** Wanneer een groep in ronde 2 zit
   en het groepshoofd dient het groepsantwoord in, wordt
   `mol_groep_stemmen` opgeslagen met `ronde_nr: 2` (niet 1). Test
   via integratie: groep A wordt eerst naar ronde 2 geadvanced (AC6),
   groepshoofd dient antwoord in, query `mol_groep_stemmen` →
   nieuwe rij heeft `ronde_nr === 2`.

10. [ ] **AC10 — `npm test` groen:** alle bestaande tests blijven
    slagen, inclusief TICKET-014, TICKET-015, TICKET-016 tests.

11. [ ] **AC11 — diff-omvang:** `git diff --stat` toont 4 of 5
    bestanden: `server.js`, `netlify-deploy/mol-js/speler.js`,
    `netlify-deploy/mol-lesvorm.html`, en 1-2 nieuwe testbestanden.

## Bestanden die geraakt worden

- `server.js`:
  - **Nieuwe endpoint** `POST /api/mol/groep-volgende-fase` —
    plaatsen direct ná `app.post('/api/mol/groep-ronde-start', ...)`
    op regel ~1296. ~25 regels.
  - **`bepaalGroepStatus`** (regel 1786-1856): in de briefing-tak
    één extra check toevoegen vóór de bestaande
    `groep?.fase === 'invoer'`-tak. ~3 regels.

- `netlify-deploy/mol-js/speler.js`:
  - **Nieuwe functie** `renderGroepsantwoordWachten(rondeNr)` —
    bouwt het bevestigingsscherm uit `sessieState.groepStemmen` +
    `sessieState.cases`, start countdown 10s, callt
    `/groep-volgende-fase`. ~30 regels.
  - **`pollSpelerStatus`** (regel 176-184): vervang `'resultaat'`-handler
    om `renderGroepsantwoordWachten` aan te roepen i.p.v.
    `renderFeedbackScherm`. ~5 regels.
  - **Module-state**: nieuwe `let huidigeRondeNr = 1` toevoegen aan
    `state.js`, geüpdatet in `pollSpelerStatus` na het lezen van
    `groepStatus.ronde_nr`.
  - **Bug-fix**: in `submitGroepsantwoord` (regel 403) en
    `renderFeedbackScherm` (regel 351) `speler.ronde_nr || 1`
    vervangen door `huidigeRondeNr`.

- `netlify-deploy/mol-lesvorm.html`:
  - **`screen-speler-groepsantwoord`** (regel 1275-1283): voeg
    countdown-element en update tekst. ~3 regels.

- `tests/groep-volgende-fase.test.js` — **nieuw**, dekt AC4-AC8.
  ~150 regels.

- `tests/speler-groepsantwoord-render.test.js` — **nieuw**, jsdom-test
  voor AC1-AC3 (toont scherm + countdown + tekst). ~60 regels.

> **Tooling-let-op:** `speler.js` en `mol-lesvorm.html` bevatten
> emoji's (zie CLAUDE.md "Tooling-beperkingen"). Edit/Write tools
> kunnen die bestanden afkappen — gebruik **altijd** Python
> (`scripts/safe_replace.py` of inline) of bash heredoc voor
> wijzigingen aan deze twee bestanden.

## Tests

### Bestaande tests die groen moeten blijven
- Alle 472+ tests, in het bijzonder:
  - `tests/discussie-fase-start.test.js` (TICKET-014)
  - `tests/discussie-resultaat-per-groep.test.js` (TICKET-015)
  - `tests/discussie-data-vraag-opties.test.js` (TICKET-016)
  - `tests/mol-flow.test.js` (volledige flow)
  - `tests/mol-groep-ronde-start.test.js` (TICKET-013)
  - `tests/dom-contract.test.js` (DOM-contract op nieuwe HTML-elementen)

### Nieuwe tests in `tests/groep-volgende-fase.test.js`
Patroon kopiëren uit `tests/mol-groep-ronde-start.test.js`. Test
scenarios:
- AC4a: 200 + advanced=true bij geldig payload (volgende ronde).
- AC4b: 400 zonder `groep_id` of `huidige_ronde_nr`.
- AC5: tweede call met dezelfde `huidige_ronde_nr` → advanced=false.
- AC6: na advance retourneert `bepaalGroepStatus` `fase: 'invoer',
  ronde_nr: 2`.
- AC7: laatste ronde → `mol_groepen.fase = 'test'`, `bepaalGroepStatus`
  retourneert `fase: 'test'`.
- AC8: andere groep blijft ongewijzigd.
- AC9 (deels): de update-call op `mol_groepen` zet `ronde_nr` op de
  juiste waarde.

### Nieuwe tests in `tests/speler-groepsantwoord-render.test.js`
jsdom-test (zoals `tests/mol-scherm7.test.js` patroon). Test:
- AC1: na fase='resultaat' is `screen-speler-groepsantwoord` zichtbaar.
- AC2: `#groepsantwoord-tekst` bevat de leesbare tekst (niet de raw
  optie-ID).
- AC3: `#groepsantwoord-countdown` bestaat en heeft initiele waarde 10.

### Edge cases
- Twee leerlingen tellen tegelijk af, tweede call verliest de race —
  gedekt door AC5 (idempotentie).
- Groepshoofd refreshet de pagina midden in de countdown → poll pikt
  `fase: 'resultaat'` weer op → countdown begint opnieuw vanaf 10.
  Acceptabel: na max 10 sec extra alsnog naar volgende fase.
- `n_rondes === 0` (defect data) → `huidige_ronde_nr < n_rondes` is
  altijd false → ga direct naar test. Acceptabel.

## Mockup — `screen-speler-groepsantwoord` (na wijziging)

```html
<div id="screen-speler-groepsantwoord" class="screen">
  <div class="content" style="text-align:center;">
    <div style="font-size:3rem;margin:1.5rem 0;color:var(--green);">✓</div>
    <div class="page-eyebrow">Groepsantwoord</div>
    <div id="groepsantwoord-tekst" style="font-size:1.4rem;font-weight:700;color:#fff;margin:1rem 0;"></div>
    <div style="color:var(--muted);font-size:0.85rem;">
      Ingediend door <span id="groepsantwoord-door"></span>
    </div>
    <div style="margin-top:1.5rem;font-size:0.85rem;color:var(--muted);">
      Volgende fase over <span id="groepsantwoord-countdown">10</span> seconden…
    </div>
  </div>
</div>
```

## Technische notities

### Nieuwe endpoint — server.js (na regel ~1296)

```js
// -- POST /api/mol/groep-volgende-fase ---------------------------------------
// Idempotent: alleen advancen als groep.ronde_nr === huidige_ronde_nr.
// Volgende ronde: ronde_nr+1, fase=invoer. Laatste ronde: fase=test.
app.post('/api/mol/groep-volgende-fase', async (req, res) => {
  try {
    const { sessie_id, groep_id, huidige_ronde_nr } = req.body;
    if (!sessie_id || !groep_id || huidige_ronde_nr === undefined) {
      return res.status(400).json({ error: 'sessie_id, groep_id en huidige_ronde_nr verplicht' });
    }
    const [{ data: sessie }, { data: groep }] = await Promise.all([
      supabase.from('mol_sessies').select('n_rondes').eq('id', sessie_id).single(),
      supabase.from('mol_groepen').select('ronde_nr, fase').eq('id', groep_id).single(),
    ]);
    if (!groep) return res.status(404).json({ error: 'groep niet gevonden' });
    if (groep.ronde_nr !== huidige_ronde_nr) {
      return res.json({ ok: true, advanced: false });
    }
    const nRondes = sessie?.n_rondes || 1;
    if (huidige_ronde_nr < nRondes) {
      await supabase.from('mol_groepen')
        .update({ ronde_nr: huidige_ronde_nr + 1, fase: 'invoer' })
        .eq('id', groep_id);
      return res.json({ ok: true, advanced: true, next: 'ronde', ronde_nr: huidige_ronde_nr + 1 });
    }
    await supabase.from('mol_groepen').update({ fase: 'test' }).eq('id', groep_id);
    res.json({ ok: true, advanced: true, next: 'test' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

### `bepaalGroepStatus` — vroege test-fase check

In de briefing-tak (`server.js:1811`), vóór de bestaande
`groep?.fase === 'invoer'`-check toevoegen:

```js
if (groep?.fase === 'test') {
  return { fase: 'test', ronde_nr: groep.ronde_nr || 1, wacht_op: [] };
}
```

### Frontend — pollSpelerStatus (`speler.js:176-184` aanpassing)

**Vóór:**
```js
if (fase === 'discussie') { await renderDiscussiescherm(); return; }
if (fase === 'resultaat') { await renderFeedbackScherm(); return; }
```

**Na:**
```js
if (fase === 'discussie') { await renderDiscussiescherm(); return; }
if (fase === 'resultaat') { renderGroepsantwoordWachten(ronde); return; }
```

(`renderFeedbackScherm` blijft staan — wordt nog gebruikt aan
sessie-eind, niet meer in deze flow.)

### Frontend — nieuwe `renderGroepsantwoordWachten`

Plaatsen direct na de bestaande `renderGroepsantwoordBevestiging`
(`speler.js:412`). Pseudocode:

```js
function renderGroepsantwoordWachten(rondeNr) {
  if (lastRenderedFase === `ronde_${rondeNr}_resultaat`) return; // idempotent in poll
  lastRenderedFase = `ronde_${rondeNr}_resultaat`;

  const groepStem = (sessieState?.groepStemmen || []).find(
    s => s.groep_id === speler.groep_id && s.ronde_nr === rondeNr
  );
  const caseR = (sessieState?.cases || []).find(c => c.ronde_nr === rondeNr);
  const leden = (sessieState?.leerlingen || []).filter(l => l.groep_id === speler.groep_id);
  const hoofd = leden.find(l => l.is_groepshoofd);

  let antwoordTekst = groepStem?.gekozen_argument || '';
  const optie = (caseR?.mc_opties || []).find(o => o.id === antwoordTekst || o.tekst === antwoordTekst);
  if (optie) antwoordTekst = optie.tekst;
  else if (antwoordTekst === 'correct') antwoordTekst = 'Correct antwoord';
  else if (antwoordTekst === 'fout')    antwoordTekst = 'Alternatief antwoord';

  const tekstEl = document.getElementById('groepsantwoord-tekst');
  const doorEl  = document.getElementById('groepsantwoord-door');
  if (tekstEl) tekstEl.textContent = antwoordTekst;
  if (doorEl)  doorEl.textContent  = hoofd?.naam || '—';

  showScreen('screen-speler-groepsantwoord');
  startCountdown('groepsantwoord-countdown', 10, async () => {
    try {
      await apiFetch('/api/mol/groep-volgende-fase', {
        method: 'POST',
        body: JSON.stringify({
          sessie_id: sessieId,
          groep_id:  speler.groep_id,
          huidige_ronde_nr: rondeNr,
        }),
      });
    } catch (_) {}
    lastRenderedFase = null;
    pollSpelerStatus();
  });
}
```

`submitGroepsantwoord` mag ongewijzigd blijven. Het scherm dat hij
direct toont wordt door de eerstvolgende poll vervangen door
`renderGroepsantwoordWachten` (die ook countdown + endpoint-call doet).

### `huidigeRondeNr` global in `state.js`

```js
// state.js — toevoegen
let huidigeRondeNr = 1;
```

In `pollSpelerStatus`, na `const ronde = groepStatus.ronde_nr || 1;`:
```js
huidigeRondeNr = ronde;
```

In `submitGroepsantwoord` en `renderFeedbackScherm`: vervang
`speler.ronde_nr || 1` door `huidigeRondeNr`.

### Waarom `submitGroepsantwoord` niet wijzigen
De groepshoofd ziet via `submitGroepsantwoord` direct het scherm voor
goede UX (geen 3,5s polldelay). De volgende poll komt langs met
`fase: 'resultaat'` en `renderGroepsantwoordWachten` neemt het over —
de countdown begint dan pas. In het slechtste geval ziet de
groepshoofd het scherm 3,5s zonder countdown en daarna 10s mét.
Acceptabel voor deze ticket; cleanup (countdown direct starten in
`submitGroepsantwoord`) is een polish-ticket.

Een betere oplossing zou zijn dat `submitGroepsantwoord` zelf
`renderGroepsantwoordWachten(huidigeRondeNr)` aanroept in plaats van
zijn eigen scherm op te bouwen. Dat is **wel** binnen scope — de
Builder mag deze cleanup meenemen als hij `renderGroepsantwoordBevestiging`
volledig vervangt door `renderGroepsantwoordWachten`. Beide functies
doen dan hetzelfde. Eindresultaat: `renderGroepsantwoordBevestiging`
wordt verwijderd.

## Verificatie door Reviewer

```bash
cp .env .env.productie-backup
cp .env.test .env
node scripts/reset-test-db.js
npm start > server.log 2>&1 &
sleep 3
curl http://localhost:8080/api/health
```

### Setup
Maak een sessie met **2 groepen × 2 leerlingen**, `n_rondes: 2`,
allemaal briefing-klaar, beide groepen met `mol_groepen.fase = 'invoer'`,
`ronde_nr: 1`. `mol_cases` bevat ronde 1 én ronde 2 met MC-opties.

### AC4 + AC6 — volgende-fase happy path

```bash
# Beide leden van groep A indienen + groepshoofd dient groepsantwoord:
curl -X POST http://localhost:8080/api/mol/antwoord -H "Content-Type: application/json" \
  -d "{\"sessie_id\":\"$SID\",\"ronde_nr\":1,\"leerling_id\":\"$LA1\",\"antwoord\":\"A\",\"mc_optie_id\":\"A\"}"
curl -X POST http://localhost:8080/api/mol/antwoord -H "Content-Type: application/json" \
  -d "{\"sessie_id\":\"$SID\",\"ronde_nr\":1,\"leerling_id\":\"$LA2\",\"antwoord\":\"B\",\"mc_optie_id\":\"B\"}"
curl -X POST "http://localhost:8080/api/mol/sessies/$SID/groepsantwoord" -H "Content-Type: application/json" \
  -d "{\"leerling_id\":\"$LA1\",\"groep_id\":\"$GA\",\"antwoord\":\"B\",\"ronde_nr\":1}"

# Volgende-fase call:
curl -X POST http://localhost:8080/api/mol/groep-volgende-fase -H "Content-Type: application/json" \
  -d "{\"sessie_id\":\"$SID\",\"groep_id\":\"$GA\",\"huidige_ronde_nr\":1}"
# Verwacht: { "ok": true, "advanced": true, "next": "ronde", "ronde_nr": 2 }

# Groep-status A:
curl "http://localhost:8080/api/mol/sessies/$SID/groep-status?groep_id=$GA"
# Verwacht: { "fase": "invoer", "ronde_nr": 2, "wacht_op": ["$LA1","$LA2"] }
```

### AC5 — idempotent

```bash
curl -X POST http://localhost:8080/api/mol/groep-volgende-fase -H "Content-Type: application/json" \
  -d "{\"sessie_id\":\"$SID\",\"groep_id\":\"$GA\",\"huidige_ronde_nr\":1}"
# Verwacht: { "ok": true, "advanced": false }
```

### AC7 — laatste ronde naar test

Herhaal voor ronde 2 (indienen + groepsantwoord):
```bash
curl -X POST http://localhost:8080/api/mol/antwoord ...   # leden lid_A1, lid_A2 ronde_nr=2
curl -X POST "http://localhost:8080/api/mol/sessies/$SID/groepsantwoord" \
  -d "{\"leerling_id\":\"$LA1\",\"groep_id\":\"$GA\",\"antwoord\":\"X\",\"ronde_nr\":2}" \
  -H "Content-Type: application/json"

curl -X POST http://localhost:8080/api/mol/groep-volgende-fase -H "Content-Type: application/json" \
  -d "{\"sessie_id\":\"$SID\",\"groep_id\":\"$GA\",\"huidige_ronde_nr\":2}"
# Verwacht: { "ok": true, "advanced": true, "next": "test" }

curl "http://localhost:8080/api/mol/sessies/$SID/groep-status?groep_id=$GA"
# Verwacht: { "fase": "test", "ronde_nr": 2, "wacht_op": [] }
```

### AC8 — onafhankelijkheid

```bash
curl "http://localhost:8080/api/mol/sessies/$SID/groep-status?groep_id=$GB"
# Verwacht: { "fase": "invoer", "ronde_nr": 1, "wacht_op": ["$LB1","$LB2"] }
```

### AC1 + AC2 + AC3 — frontend handmatig

Open de productie/test-frontend in twee browsers (groepshoofd +
gewone leerling). Doorloop briefing → invoer → submit beide
antwoorden → groepshoofd dient groepsantwoord in. Beide leerlingen
moeten:
- `screen-speler-groepsantwoord` zien
- het gekozen antwoord leesbaar zien
- countdown van 10 → 0 zien lopen
- na 10s automatisch naar het invoerscherm van ronde 2 gaan (of naar
  moltest als laatste ronde)

DevTools-snippet om te valideren (op een leerling-tab):
```js
console.log('scherm:', document.querySelector('.screen.active')?.id);
console.log('antwoordtekst:', document.getElementById('groepsantwoord-tekst')?.textContent);
console.log('countdown:', document.getElementById('groepsantwoord-countdown')?.textContent);
```

### AC10 + AC11

```bash
npm test
git diff --stat main..HEAD
```

### Cleanup
```bash
kill %1
cp .env.productie-backup .env
rm .env.productie-backup
head -1 .env
```

## Architect self-check

- [x] Klein genoeg? M — vier bestanden raken aan, ~150 regels
      productiecode totaal. Aan de bovengrens van M; splitsen in S+S
      zou kunstmatig zijn want frontend/backend hangen samen.
- [x] Eén probleem? Eén user-story (post-submit-flow) met meerdere
      onlosmakelijke onderdelen (scherm tonen, countdown, advance-call,
      backend-state, bepaalGroepStatus-tak).
- [x] Acceptatiecriteria testbaar zonder menselijk oordeel? Ja, AC1-AC9
      via supertest + curl, AC10-AC11 via tooling. AC1-AC3 raken UI;
      jsdom-tests dekken die.
- [x] Welk deel van server.js? Nieuw endpoint na regel 1296 +
      ~3-regel-toevoeging in `bepaalGroepStatus` briefing-tak.
- [x] Tooling-let-op gemaakt? Ja — `speler.js` en `mol-lesvorm.html`
      bevatten emoji's en moeten via Python/heredoc bewerkt worden.

## Vervolgticket-suggesties

- **TICKET-018:** verplaats fase-state naar `mol_groepen.fase`-enum
  (`'briefing' | 'invoer' | 'discussie' | 'resultaat' | 'test'`) en
  refactor `bepaalGroepStatus` zodat het direct uit `mol_groepen.fase`
  leest in plaats van afleiden uit `mol_antwoorden`/`mol_groep_stemmen`.
  Maakt ook de `'resultaat_5sec'`-shortcut in
  `/api/mol/groep-stem-hoofd` overbodig.
- **TICKET-019:** moltest per groep volledig per-groep. Nu start de
  test sessie-breed (`sessie.status = 'test'`); na TICKET-017 kan een
  enkele groep al in `mol_groepen.fase = 'test'` zitten terwijl
  andere groepen nog rondes spelen. `bepaalGroepStatus` retourneert
  dan `fase: 'test'` voor die groep, en `pollSpelerStatus` toont het
  testscherm. Maar het einde van de test (overgang naar `'reveal'`)
  blijft sessie-breed — misschien per groep maken zodra de test
  ingediend is.
- **TICKET-020:** `submitGroepsantwoord` direct
  `renderGroepsantwoordWachten` aanroepen + countdown direct starten,
  zodat het groepshoofd geen 3,5s polldelay ziet. Polish.
