/**
 * @jest-environment jsdom
 *
 * TICKET-007-fix — reveal-mol-naam via getElementById ipv reveal-content
 * Test: renderSpelerReveal() schrijft naar bestaande DOM-elementen zonder crash
 */

const fs = require('fs');
const path = require('path');
const revealPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'reveal.js');

describe('TICKET-007-fix — renderSpelerReveal DOM-render', () => {
  beforeAll(() => {
    global.speler = { id: 'l1', groep_id: 'g1', is_mol: false, groep_naam: 'Groep A' };
    global.escH = (s) => String(s);
    global.sessieState = null;
    const indirectEval = eval;
    indirectEval(fs.readFileSync(revealPath, 'utf8'));
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="reveal-mol-naam"></div>
      <div id="reveal-eigen-gok"></div>
      <div id="reveal-afsluiting" style="display:none;"></div>
      <div id="reveal-scores-lijst"></div>
      <div id="reveal-groep-naam"></div>
    `;
  });

  const state = {
    sessie: { les_naam: 'Testles', n_rondes: 2 },
    leerlingen: [
      { id: 'mol1', groep_id: 'g1', naam: 'Eva', is_mol: true,  groep_naam: 'Groep A' },
      { id: 'l1',   groep_id: 'g1', naam: 'Jan', is_mol: false, groep_naam: 'Groep A' },
    ],
    cases: [],
    antwoorden: [],
    groepStemmen: [],
    testAntwoorden: [],
  };

  it('gooit geen TypeError (AC1)', () => {
    expect(() => global.renderSpelerReveal(state, [])).not.toThrow();
  });

  it('#reveal-mol-naam bevat de naam van de mol (AC2)', () => {
    global.renderSpelerReveal(state, []);
    expect(document.getElementById('reveal-mol-naam').textContent).toContain('Eva');
  });

  it('#reveal-afsluiting is zichtbaar na aanroep (AC3)', () => {
    global.renderSpelerReveal(state, []);
    const el = document.getElementById('reveal-afsluiting');
    expect(el.style.display).not.toBe('none');
  });

  it('#reveal-scores-lijst werkt nog (geen regressie renderEindstand) (AC4)', () => {
    global.renderSpelerReveal(state, [
      { leerling_id: 'mol1', totaal: 20 },
      { leerling_id: 'l1',   totaal: 35 },
    ]);
    const lijstHtml = document.getElementById('reveal-scores-lijst').innerHTML;
    expect(lijstHtml).toContain('Eva');
    expect(lijstHtml).toContain('Jan');
  });
});
