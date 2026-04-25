# MOL-01b — Review-herstel na Bouwblok 0

**Epic:** Wie is de Mol — leerlingflow end-to-end
**Rol:** Builder
**Prioriteit:** Blokkerend — herstel dit vóór je start met MOL-02
**Referentie:** Review-rapport MOL-01 (april 2026)

---

## Context voor de builder

De review van MOL-01 heeft twee categorieën bevindingen opgeleverd:

1. **Blokkerende bugs** — twee defecten in `reveal.js` die gerepareerd moeten worden vóór MOL-02
2. **Fundamentele werkwijze-correcties** — de manier waarop je tests schrijft deugt structureel niet; dit moet voor elke toekomstige fix worden gevolgd

Lees dit document volledig vóór je begint. Herstel de bugs in de volgorde hieronder.

---

## Deel A — Blokkerende bugs

---

### Fix A1 — `reveal.js` regel 252: tweede `heeftGeraden` niet gerepareerd

**Bestand:** `netlify-deploy/mol-js/reveal.js`
**Locatie:** regel 252

**Probleem:** De fix in MOL-01 repareerde `heeftGeraden` in `renderSpelerReveal()` (regel 6–9). Maar in de groepenoverzicht-sectie van hetzelfde bestand staat een tweede identieke berekening die nog steeds alleen `mol_verdachte_id` controleert:

```javascript
// HUIDIG (fout):
const test=testAntwoorden.find(t=>t.leerling_id===l.id),
      heeftGeraden=test&&mol&&test.mol_verdachte_id===mol.id;
```

Spelers die via het nieuwe `/test`-endpoint hebben gestemd (waarbij `verdachte_id` is opgeslagen) worden daardoor in de docent-groepsweergave altijd als "✗ Mol gemist" gemarkeerd.

**Wat je gaat wijzigen:** Dezelfde uitbreidingslogica als Fix 3 van MOL-01 toepassen op deze tweede berekening:

```javascript
// NIEUW (correct):
const test = testAntwoorden.find(t => t.leerling_id === l.id);
const heeftGeraden = test && mol &&
  (test.verdachte_id === mol.id || test.mol_verdachte_id === mol.id);
```

Lees vóór je schrijft: de volledige omgeving van regel 252 (minstens 10 regels voor en na) zodat je weet welke variabele `l` en `mol` representeren in die scope.

**Stap 1 — Test schrijven** (voeg toe aan `tests/mol-reveal-veld.test.js`):

Het bestaande testbestand test alleen de broncode van `renderSpelerReveal`. Voeg een extra test toe die de tweede `heeftGeraden`-berekening in de groepenoverzicht-sectie verifieert. Gebruik hetzelfde patroon als de bestaande tests (lees de bron, zoek op `heeftGeraden`, check dat `||` aanwezig is en dat beide veldnamen voorkomen). Schrijf de test zo dat hij faalt zolang de fix er niet is.

**Stap 2 — Bevestig dat de test faalt** (`npm test -- --testPathPattern mol-reveal`)

**Stap 3 — Fix uitvoeren** via `str_replace` op de exacte twee regels. Schrijf de eerste en laatste regel van wat je gaat vervangen vóór je de `str_replace` uitvoert.

**Stap 4 — Verifieer:** `node --check netlify-deploy/mol-js/reveal.js` → `npm test`

**Stap 5 — Commit:** `MOL-01b: fix tweede heeftGeraden in reveal.js groepoverzicht`

---

### Fix A2 — `reveal.js` regel 33: weergave verdachte naam toont altijd '?'

**Bestand:** `netlify-deploy/mol-js/reveal.js`
**Locatie:** regel 33

**Probleem:** De tekst "Jij verdacht: …" zoekt de naam op via `mijnTest?.mol_verdachte_id`:

```javascript
// HUIDIG (fout):
leerlingen.find(l => l.id === mijnTest?.mol_verdachte_id)?.naam || '?'
```

Voor spelers die het nieuwe endpoint gebruiken (opgeslagen als `verdachte_id`) is `mol_verdachte_id` altijd `null` → de app toont '?' in plaats van de naam van de verdachte.

**Wat je gaat wijzigen:** De opzoeklogica aanpassen zodat beide veldnamen werken:

```javascript
// NIEUW (correct):
leerlingen.find(l => l.id === (mijnTest?.verdachte_id || mijnTest?.mol_verdachte_id))?.naam || '?'
```

**Stap 1 — Test schrijven** (voeg toe aan `tests/mol-reveal-veld.test.js`):

Voeg een test toe die verifieert dat de broncode van `reveal.js` bij de "Jij verdacht"-weergave zowel `verdachte_id` als `mol_verdachte_id` gebruikt (analoog aan de bestaande heeftGeraden-tests).

**Stap 2 — Bevestig dat de test faalt**

**Stap 3 — Fix uitvoeren** via `str_replace`

**Stap 4 — Verifieer:** `node --check netlify-deploy/mol-js/reveal.js` → `npm test`

**Stap 5 — Commit:** `MOL-01b: fix verdachte naam weergave in reveal.js — verdachte_id en mol_verdachte_id`

---

## Deel B — Fundamentele werkwijze-correcties

Dit zijn geen bugs in de huidige code, maar structurele tekortkomingen in de manier waarop je werkt. Ze gelden **met ingang van nu voor elk toekomstig ticket**.

---

### B1 — Schrijf gedragstests, geen broncode-scantests

**Dit is de belangrijkste correctie.**

De tests in MOL-01 lezen de bronbestanden met `fs.readFileSync` en controleren of bepaalde strings aanwezig zijn. Dit zijn geen tests — het zijn spellingcontroles. Ze detecteren niet of de code correct gedraagt.

**Wat er mis is met de huidige aanpak:**

```javascript
// FOUT — broncode-scantest:
it('genereer-spelcodes handler controleert docentCode', () => {
  const fragment = serverSrc.slice(idx, idx + 600);
  expect(fragment).toContain('docentCode');        // test of het woord erin staat
  expect(fragment).toContain('docent_code');       // test of het woord erin staat
});
```

Dit slaagt ook als de docentCode-check altijd `true` retourneert, of helemaal niet werkt.

**Wat een gedragstest doet:**

Een gedragstest roept de échte server aan via HTTP (met supertest) en controleert wat het endpoint daadwerkelijk teruggeeft. Het maakt niet uit hoe de broncode eruitziet — alleen het gedrag telt.

**Patroon voor een supertest-gedragstest:**

Kijk naar bestaande gedragstests in de codebase (bijv. `tests/server.test.js` of vergelijkbare bestanden) om te zien hoe supertest is opgezet. Volg dat patroon exact.

Een gedragstest voor het spelcodes-endpoint ziet er globaal zo uit:

```javascript
const request = require('supertest');
const app     = require('../server');   // of het pad dat in bestaande tests wordt gebruikt

describe('MOL-01 Fix 2 — spelcodes endpoint gedrag', () => {
  it('geeft 403 als docentCode ontbreekt in de body', async () => {
    const res = await request(app)
      .post('/api/mol/sessies/test-id/genereer-spelcodes')
      .send({});                          // geen docentCode
    expect(res.status).toBe(403);
  });

  it('geeft 403 als docentCode onjuist is', async () => {
    const res = await request(app)
      .post('/api/mol/sessies/test-id/genereer-spelcodes')
      .send({ docentCode: 'fout' });
    expect(res.status).toBe(403);
  });
});
```

Voor een 200-test heb je een bestaande sessie nodig in de testdatabase — kijk hoe andere tests dat doen (bijv. via mock of een before-hook die testdata aanmaakt).

**Vuistregel:** Als jouw test geen HTTP-aanroep doet en geen `expect(res.status)` bevat, is het geen test van de server — het is een test van de tekst in een bestand.

---

### B2 — Lees bestaande tests vóór je nieuwe schrijft

Vóór je een nieuw testbestand aanmaakt, open je een bestaand testbestand dat een vergelijkbaar endpoint test. Beantwoord voor jezelf:
- Hoe wordt de app geïmporteerd?
- Hoe wordt supertest gebruikt?
- Hoe wordt testdata aangemaakt (mock? seed? before-hook)?
- Worden er na afloop database-records opgeruimd?

Pas datzelfde patroon toe. Nooit een testbestand schrijven zonder eerst een bestaand te lezen.

---

### B3 — Controleer bij elke fix of hetzelfde patroon elders voorkomt

Bij Fix 3 (heeftGeraden in reveal.js) had een `grep` op `mol_verdachte_id` in de codebase het tweede exemplaar op regel 252 zichtbaar gemaakt vóór de commit. Dit is een verplichte stap:

**Vóór je een fix committ die een veldnaam, functienaam of patroon verandert:**

```bash
# Zoek in het hele project naar het patroon dat je aan het repareren bent:
grep -rn "mol_verdachte_id" netlify-deploy/ server.js
```

Als er meer dan één hit is: verwerk alle hits, of documenteer expliciet waarom een hit buiten scope valt.

---

## Afronden

Na beide commits:

```
git status       → leeg
git log --oneline -5
npm test         → alle tests groen
```

Rapporteer aan Martijn:
- Output van `git log --oneline -5`
- Output van `npm test` (X passing, Y suites)
- Of je bij Fix A1 of A2 iets tegenkwam dat niet in dit ticket stond

**Volgende stap na dit ticket:** MOL-02 (Briefing-fase completeren) — maar pas na review van dit herstel.
