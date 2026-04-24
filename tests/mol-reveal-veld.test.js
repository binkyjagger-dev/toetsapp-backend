const fs = require('fs');
const path = require('path');

const revealPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'reveal.js');

describe('MOL-01b Fix A1 - tweede heeftGeraden in renderResultaten', () => {
  let src;
  beforeAll(() => { src = fs.readFileSync(revealPath, 'utf8'); });

  it('renderResultaten heeftGeraden-declaratie ondersteunt verdachte_id', () => {
    const eersteDecl = src.indexOf('const heeftGeraden');
    const tweedeDecl = src.indexOf('const heeftGeraden', eersteDecl + 1);
    expect(tweedeDecl).toBeGreaterThan(-1);
    const fragment = src.slice(tweedeDecl, tweedeDecl + 200);
    expect(fragment).toContain('verdachte_id');
  });

  it('renderResultaten heeftGeraden-declaratie gebruikt OR voor beide velden', () => {
    const eersteDecl = src.indexOf('const heeftGeraden');
    const tweedeDecl = src.indexOf('const heeftGeraden', eersteDecl + 1);
    expect(tweedeDecl).toBeGreaterThan(-1);
    const fragment = src.slice(tweedeDecl, tweedeDecl + 200);
    expect(fragment).toContain('||');
  });
});

describe('MOL-01b Fix A2 - verdachte naam weergave in reveal.js', () => {
  let src;
  beforeAll(() => { src = fs.readFileSync(revealPath, 'utf8'); });

  it('Jij verdacht gebruikt mijnTest?.verdachte_id (zonder mol_ prefix)', () => {
    // mijnTest?.verdachte_id is GEEN substring van mijnTest?.mol_verdachte_id
    // dus deze test faalt zolang alleen mol_verdachte_id aanwezig is
    const idx = src.indexOf('Jij verdacht');
    expect(idx).toBeGreaterThan(-1);
    const fragment = src.slice(idx, idx + 150);
    expect(fragment).toContain('mijnTest?.verdachte_id');
  });

  it('Jij verdacht is backward-compatible met mol_verdachte_id', () => {
    const idx = src.indexOf('Jij verdacht');
    expect(idx).toBeGreaterThan(-1);
    const fragment = src.slice(idx, idx + 150);
    expect(fragment).toContain('mol_verdachte_id');
  });
});

describe('MOL-01 Fix 3 - reveal veldnaam verdachte_id (renderSpelerReveal)', () => {
  let src;
  beforeAll(() => { src = fs.readFileSync(revealPath, 'utf8'); });

  it('heeftGeraden-conditie ondersteunt verdachte_id (zonder mol_ prefix)', () => {
    expect(src).toContain('a.verdachte_id === mol');
  });

  it('heeftGeraden-conditie ondersteunt mol_verdachte_id (met mol_ prefix)', () => {
    expect(src).toContain('a.mol_verdachte_id === mol');
  });

  it('heeftGeraden-conditie gebruikt OR zodat beide velden werken', () => {
    const idx = src.indexOf('const heeftGeraden');
    expect(idx).toBeGreaterThan(-1);
    const fragment = src.slice(idx, idx + 200);
    expect(fragment).toContain('||');
  });
});
