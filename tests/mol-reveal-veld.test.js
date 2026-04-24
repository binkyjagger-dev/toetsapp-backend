const fs = require('fs');
const path = require('path');

const revealPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'reveal.js');

describe('MOL-01 Fix 3 — reveal veldnaam verdachte_id', () => {
  let src;
  beforeAll(() => { src = fs.readFileSync(revealPath, 'utf8'); });

  it('heeftGeraden-conditie ondersteunt verdachte_id (zonder mol_ prefix)', () => {
    expect(src).toContain('a.verdachte_id === mol');
  });

  it('heeftGeraden-conditie ondersteunt mol_verdachte_id (met mol_ prefix)', () => {
    expect(src).toContain('a.mol_verdachte_id === mol');
  });

  it('heeftGeraden-conditie gebruikt OR zodat beide velden werken', () => {
    // Beide velden moeten in dezelfde zoekconditie zitten (||)
    const idx = src.indexOf('heeftGeraden');
    expect(idx).toBeGreaterThan(-1);
    const fragment = src.slice(idx, idx + 200);
    expect(fragment).toContain('||');
  });
});
