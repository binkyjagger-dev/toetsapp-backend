/**
 * @jest-environment jsdom
 *
 * TICKET-007 Fix 2 — Scherm 12: eindstand gesorteerde lijst
 * Test 1: gesorteerd op punten, hoogste eerst
 * Test 2: winnaar krijgt 🥇 badge
 * Test 3: mol krijgt MOL tag
 * Test 4: leerlingen buiten eigen groep worden niet getoond
 */

const fs = require('fs');
const path = require('path');
const revealPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'reveal.js');

describe('TICKET-007 Fix 2 — reveal eindstand', () => {
  beforeAll(() => {
    global.speler = { id: 'l1', groep_id: 'g1' };
    global.escH = (s) => String(s);
    global.sessieState = null;
    const indirectEval = eval;
    indirectEval(fs.readFileSync(revealPath, 'utf8'));
  });

  beforeEach(() => {
    document.body.innerHTML = '<div id="reveal-scores-lijst"></div>';
  });

  const leerlingen = [
    { id: 'l1', groep_id: 'g1', naam: 'Anna', is_mol: false },
    { id: 'l2', groep_id: 'g1', naam: 'Bo',   is_mol: false },
    { id: 'l3', groep_id: 'g2', naam: 'Cees',  is_mol: false },
  ];
  const scores = [
    { leerling_id: 'l1', totaal: 30 },
    { leerling_id: 'l2', totaal: 50 },
  ];

  it('toont spelers gesorteerd op punten, hoogste eerst', () => {
    global.renderEindstand(leerlingen, scores);
    const html = document.getElementById('reveal-scores-lijst').innerHTML;
    expect(html.indexOf('Bo')).toBeLessThan(html.indexOf('Anna'));
  });

  it('winnaar krijgt 🥇 badge', () => {
    global.renderEindstand(leerlingen, scores);
    const firstRow = document.getElementById('reveal-scores-lijst').firstElementChild;
    expect(firstRow.innerHTML).toContain('🥇');
  });

  it('mol krijgt MOL tag', () => {
    const metMol = [
      { id: 'l1', groep_id: 'g1', naam: 'Anna', is_mol: true },
      { id: 'l2', groep_id: 'g1', naam: 'Bo',   is_mol: false },
    ];
    const hoog = [{ leerling_id: 'l1', totaal: 99 }, { leerling_id: 'l2', totaal: 10 }];
    global.renderEindstand(metMol, hoog);
    const firstRow = document.getElementById('reveal-scores-lijst').firstElementChild;
    expect(firstRow.innerHTML).toContain('MOL');
  });

  it('leerlingen van andere groep worden niet getoond', () => {
    global.renderEindstand(leerlingen, scores);
    const html = document.getElementById('reveal-scores-lijst').innerHTML;
    expect(html).not.toContain('Cees');
  });
});
