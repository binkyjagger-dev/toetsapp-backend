const fs = require('fs');
const path = require('path');

const spelerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');
const setupPath  = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-setup.js');

describe('mol-js — nieuwe schermen en flow', () => {
  const spelerTekst = () => fs.readFileSync(spelerPath, 'utf8');
  const setupTekst  = () => fs.readFileSync(setupPath, 'utf8');

  it('speler.js: login gebruikt spelcode', () => {
    const c = spelerTekst();
    expect(c).toMatch(/speler_code|spelcode/);
    expect(c).toMatch(/sessie_code|sessiecode/);
    expect(c).toContain('screen-speler-login');
  });

  it('speler.js: eigen naam uitgesloten in briefing', () => {
    const c = spelerTekst();
    expect(c).toMatch(/l\.id\s*!==\s*speler\.id/);
  });

  it('speler.js: geen punten in ronde-render', () => {
    const c = spelerTekst();
    const match = c.match(/function renderSpelerRonde[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/punten/i);
  });

  it('speler.js: renderFeedbackScherm bestaat', () => {
    const c = spelerTekst();
    expect(c).toContain('renderFeedbackScherm');
    expect(c).toContain('ronde-feedback');
  });

  it('speler.js: discussie toont vraag + opties', () => {
    const c = spelerTekst();
    expect(c).toContain('discussie-vraag');
    expect(c).toMatch(/discussie-opties|discussie-gh-opties/);
  });

  it('speler.js: pollSpelerStatus gebruikt nieuwe scherm-ids', () => {
    const c = spelerTekst();
    expect(c).toContain('screen-speler-ronde');
    expect(c).toContain('screen-speler-discussie');
    expect(c).toContain('screen-speler-feedback');
    expect(c).toContain('screen-speler-reveal');
  });

  it('docent-setup.js: nieuwe scherm-ids', () => {
    const c = setupTekst();
    expect(c).toContain('screen-sessie-stap');
    expect(c).toContain('screen-spelcodes');
  });

  it('docent-setup.js: AI-feedback genereren', () => {
    const c = setupTekst();
    expect(c).toContain('genereer-feedback');
    expect(c).toMatch(/feedback-input|\.feedback-input/);
  });

  it('docent-setup.js: mol-voorstel endpoint', () => {
    const c = setupTekst();
    expect(c).toContain('mol-voorstel');
  });

  it('docent-setup.js: spelcodes endpoint', () => {
    const c = setupTekst();
    expect(c).toContain('genereer-spelcodes');
  });
});
