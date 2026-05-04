# TICKET-021: Mol dient ook MC-antwoord in (sabotage-default)

**Status:** Ready for Build (kritisch — randvoorwaarde voor TICKET-022)
**Grootte:** S
**Aangemaakt door:** Architect
**Datum:** 2026-05-04

## Doel
De mol vult ook een MC-antwoord in, zodat zijn keuze opgeslagen wordt
in `mol_antwoorden` en de score-berekening (TICKET-022) zijn
individuele MC-punten kan tellen.

## Achtergrond — root cause

In `netlify-deploy/mol-js/speler.js:788-791`:
```js
if (speler.is_mol) {
  setTimeout(() => selecteerOptie('fout'), 100);
}
```

`selecteerOptie('fout')` werkt alleen voor de **oude niet-MC flow**
(buttons `opt-correct` / `opt-fout`). Voor MC-vragen worden buttons
gerenderd met id `opt-{optieId}` en de handler is `selecteerMcOptie`.
De auto-select van de mol vindt dus niets, de submit-knop verschijnt
nooit, en de mol klikt vermoedelijk ook niets aan → **geen rij in
`mol_antwoorden` voor de mol**.

**Bevestigd via productie-console 2026-05-04:**
```
mol_antwoorden voor speler.is_mol → []
```

Dit blokkeert de nieuwe score-spec (TICKET-022) waarin de mol per
ronde individuele MC-punten krijgt.

## Scope

### Wel
- `speler.js:788-791` — vervangen door MC-aware auto-select:
  - Als `caseData.vraagtype === 'mc'` en `caseData.mc_opties` heeft
    items: kies de **eerste optie met niet-maximaal-punten** (=
    sabotage-default, consistent met de oude `'fout'`-intentie).
  - Anders: gedrag behouden (`selecteerOptie('fout')`).
- Nieuwe test `tests/mol-mc-invoer.test.js` (jsdom) die bevestigt:
  - Bij MC + `speler.is_mol`: na render is een sabotage-optie
    geselecteerd én `submit-antwoord-btn` is `display:block`.
  - Bij niet-MC + `speler.is_mol`: bestaande gedrag intact.

### Niet
- Geen wijziging in de score-berekening (TICKET-022).
- Geen wijziging aan `submitAntwoord` — het bestaande POST-pad werkt.
- Geen UX-keuze om de mol zelf te laten kiezen. Auto-select houdt
  het mol-pad consistent met de huidige flow waarin de mol weinig
  klikt; dit kan in een vervolgticket veranderen als de docent dat
  wil.
- Geen wijziging aan andere mol-specifieke gedragingen
  (`speler.is_mol` checks elders in speler.js blijven ongewijzigd).

## Acceptatiecriteria

1. [ ] **AC1 — MC + mol: sabotage-optie geselecteerd:**
   Bij render van het invoer-scherm met `caseData.vraagtype === 'mc'`,
   `caseData.mc_opties = [{id:'a', punten:10}, {id:'b', punten:0}]`
   en `speler.is_mol = true`: na ~110ms is `geselecteerdeOptie === 'fout'`,
   `geselecteerdeMcOptieId === 'b'` (of een andere niet-max-punten
   optie), en `#submit-antwoord-btn.style.display === 'block'`.

2. [ ] **AC2 — MC + niet-mol: niets geselecteerd:**
   Bij dezelfde render maar `speler.is_mol = false`: na ~110ms is
   `geselecteerdeMcOptieId === null` en `#submit-antwoord-btn.style.display === 'none'`.

3. [ ] **AC3 — Niet-MC + mol: oud gedrag intact:**
   Bij `caseData.vraagtype !== 'mc'` (geen mc_opties) en
   `speler.is_mol = true`: na ~110ms is
   `geselecteerdeOptie === 'fout'` (zoals nu).

4. [ ] **AC4 — meerdere niet-correcte opties:**
   Bij `mc_opties = [{id:'a',punten:10},{id:'b',punten:5},{id:'c',punten:0}]`:
   de mol selecteert óf `b` óf `c` (deterministisch, eerste in array
   die niet de max-punten heeft). Vastleggen welke in de code en
   testen.

5. [ ] **AC5 — bestaande tests groen:** alle bestaande suites blijven
   slagen, met name `tests/mol-test-scherm.test.js` en
   `tests/mol-frontend-flow.test.js`.

6. [ ] **AC6 — productie-end-to-end:** na deploy heeft de mol een rij
   in `mol_antwoorden` per ronde (handmatig via console-check).

## Bestanden die geraakt worden

- `netlify-deploy/mol-js/speler.js`, regel **788-791**:
  vervang het `if (speler.is_mol)` blok door MC-aware variant.
  - **TOOLING-WARNING:** dit bestand bevat emojis. Gebruik **GEEN**
    Edit/Write — gebruik Python str.replace of bash heredoc volgens
    CLAUDE.md §"Tooling-beperkingen".
- `tests/mol-mc-invoer.test.js` (nieuw, ~80 regels, jsdom).

## Tests

### Bestaande tests die groen moeten blijven
- `tests/mol-test-scherm.test.js`
- `tests/mol-frontend-flow.test.js`
- `tests/mol-puntentelling-intern.test.js`
- `tests/mol-puntentelling-groep.test.js`
- `npm run lint:html`

### Nieuwe tests in `tests/mol-mc-invoer.test.js`

Skelet, jsdom-omgeving, eval-stijl voor het oproepen van
`renderSpelerRonde`:

```javascript
/**
 * @jest-environment jsdom
 *
 * TICKET-021 — Mol selecteert automatisch een sabotage-MC-optie.
 */

const fs = require('fs');
const path = require('path');

function setupDom() {
  document.body.innerHTML = `
    <div id="screen-speler-ronde">
      <div id="ronde-fase-label"></div>
      <div id="ronde-progress" style="width:0;"></div>
      <div id="ronde-topbar-label"></div>
      <div id="ronde-content"></div>
    </div>
  `;
  global.escH = (s) => String(s ?? '').replace(/[<>&"]/g, '');
  global.geselecteerdeOptie     = null;
  global.geselecteerdeMcOptieId = null;
  global.geselecteerdeLidId     = null;
  global.lastRenderedFase       = null;
  global.buildTimerRing         = () => '';
}

// Builder: laad speler.js via require + extract van renderSpelerRonde +
// selecteerOptie + selecteerMcOptie (vergelijk met patroon in
// tests/mol-test-scherm.test.js).

describe('TICKET-021 — mol-MC sabotage-default', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setupDom();
  });
  afterEach(() => jest.useRealTimers());

  it('AC1: MC + is_mol -> sabotage-optie geselecteerd, submit zichtbaar', () => {
    global.speler = { id: 'm', is_mol: true };
    const caseData = {
      vraagtype: 'mc',
      vraag: 'V?',
      mc_opties: [
        { id: 'a', tekst: 'A', punten: 10 },
        { id: 'b', tekst: 'B', punten: 0 },
      ],
    };
    global.renderSpelerRonde(1, 1, caseData, null, false, [], null,
      [{id:'m',is_mol:true,groep_id:'g'}], [{id:'m',is_mol:true,groep_id:'g'}],
      'invoer', Date.now(), 60, 60, [], []);
    jest.advanceTimersByTime(150);
    expect(global.geselecteerdeMcOptieId).toBe('b');
    expect(global.geselecteerdeOptie).toBe('fout');
    expect(document.getElementById('submit-antwoord-btn').style.display).toBe('block');
  });

  it('AC2: MC + niet-mol -> niets geselecteerd', () => {
    global.speler = { id: 's', is_mol: false };
    const caseData = {
      vraagtype: 'mc',
      vraag: 'V?',
      mc_opties: [
        { id: 'a', tekst: 'A', punten: 10 },
        { id: 'b', tekst: 'B', punten: 0 },
      ],
    };
    global.renderSpelerRonde(1, 1, caseData, null, false, [], null,
      [{id:'s',is_mol:false,groep_id:'g'}], [{id:'s',is_mol:false,groep_id:'g'}],
      'invoer', Date.now(), 60, 60, [], []);
    jest.advanceTimersByTime(150);
    expect(global.geselecteerdeMcOptieId).toBeNull();
    expect(document.getElementById('submit-antwoord-btn').style.display).toBe('none');
  });

  it('AC3: niet-MC + is_mol -> selecteerOptie("fout") als vanouds', () => {
    global.speler = { id: 'm', is_mol: true };
    const caseData = { vraag: 'V?' /* geen vraagtype: 'mc' */ };
    global.renderSpelerRonde(1, 1, caseData, null, false, [], null,
      [{id:'m',is_mol:true,groep_id:'g'}], [{id:'m',is_mol:true,groep_id:'g'}],
      'invoer', Date.now(), 60, 60, [], []);
    jest.advanceTimersByTime(150);
    expect(global.geselecteerdeOptie).toBe('fout');
  });
});
```

**Builder-let-op:** de exacte require/extract-strategie kan worden
overgenomen uit `tests/mol-test-scherm.test.js`. Belangrijk: tests
mogen géén literal emoji-strings bevatten (CLAUDE.md
§"Tooling-beperkingen"); gebruik regex-matchers waar nodig.

### Edge cases
- Lege `mc_opties` array → val terug op niet-MC pad (oude
  `selecteerOptie('fout')`).
- Alle opties hebben dezelfde punten → fallback: gewoon eerste optie
  selecteren (deterministisch).

## Mockup
N/A — geen UI-wijziging zichtbaar voor de gebruiker. Auto-select
gebeurt onzichtbaar.

## Technische notities

### Wat exact wijzigen — speler.js regel 788-791

**Vóór:**
```js
    // Mol heeft vaste keuze (fout)
    if (speler.is_mol) {
      setTimeout(() => selecteerOptie('fout'), 100);
    }
```

**Na:**
```js
    // Mol heeft vaste keuze: sabotage-default.
    if (speler.is_mol) {
      setTimeout(() => {
        const isMc = caseData.vraagtype === 'mc' && caseData.mc_opties && caseData.mc_opties.length > 0;
        if (isMc) {
          const maxPunten = Math.max(...caseData.mc_opties.map(o => o.punten || 0));
          const sabOptie  = caseData.mc_opties.find(o => (o.punten || 0) !== maxPunten)
                          || caseData.mc_opties[0];
          selecteerMcOptie(sabOptie.id, 'fout');
        } else {
          selecteerOptie('fout');
        }
      }, 100);
    }
```

Netto: ~10 regels toegevoegd, 1 regel vervangen. Onder de
50-regel-limiet.

### Waarom auto-select en niet handmatig

De mol speelt verder weinig actief mee in het invoer-scherm
(consistent met de oude flow). De spec ("speelt MC mee zoals
iedereen") gaat over puntentelling, niet over UX. Auto-select naar
een sabotage-optie:
- houdt de mol-flow snel,
- vermijdt accidenteel correct antwoord (frustreert mol-rol),
- is consistent met oude `'fout'`-intentie.

Mocht je later willen dat de mol zelf kiest: simpele toggle in een
vervolgticket.

## Verificatie door Reviewer

### Setup
Volg `WORKFLOW.md` § Preamble Reviewer Deel 2.

### AC1 + AC4 — handmatige browser-check

1. Maak een sessie met **2 leerlingen × 1 groep × 1 ronde × MC-vraag**
   (gebruik `direct_setup=1` URL of normale flow).
2. Speel als de mol-leerling tot het invoer-scherm.
3. Verwacht: een MC-optie is **automatisch** geselecteerd (visueel:
   `.selected` class), submit-knop is zichtbaar.
4. Klik submit. Open console:
   ```js
   { let s = await apiFetch('/api/mol/sessie/' + localStorage.getItem('mol_sessie_id'));
     let mol = s.leerlingen.find(l => l.is_mol);
     console.log(s.antwoorden.filter(a => a.leerling_id === mol.id)); }
   ```
   **Verwacht:** array met 1 rij, `mc_optie_id` is een niet-max-punten
   optie.

### AC2 — niet-mol heeft geen auto-select

Speel als niet-mol-leerling. Verwacht: niets geselecteerd, submit-knop
verborgen tot je zelf klikt.

### AC3 — niet-MC fallback

Maak een sessie met een niet-MC vraag (open vraag, oude flow). Speel
als mol. Verwacht: `'opt-fout'` heeft de `.selected` class.

### AC5 — npm test
```bash
npm test
```
**Verwacht:** alle suites groen incl. nieuwe `mol-mc-invoer`.

### AC6 — productiebewijs (optioneel)

Na deploy + één afgespeelde ronde: console-check zoals in AC1.

### Cleanup
Standaard env-restore.

## Architect self-check

- [x] **Klein genoeg?** Ja, S. ~10 regels speler.js + 1 testfile.
- [x] **Eén probleem?** Ja: mol heeft geen MC-antwoord in DB.
- [x] **Acceptatiecriteria testbaar?** Ja, AC1-AC4 via jsdom, AC5 via
      npm test, AC6 via console.
- [x] **Tooling-restrictie genoteerd?** Ja, expliciet voor speler.js.
- [x] **Productiediagnose bevestigd?** Ja, console-check 2026-05-04
      gaf `mol_antwoorden = []`.

## Vervolgticket-suggestie

**TICKET-022:** nieuwe score-berekening volgens spec. Voorwaarde:
TICKET-021 staat live zodat mol-MC-rijen daadwerkelijk in de DB komen.
