const fs = require('fs');
const path = require('path');

const spelerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');
const docentPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js');

describe('mol-js — frontend per-groep flow', () => {
  it('speler.js bevat geen aanroep naar globale ronde_fase endpoint', () => {
    const c = fs.readFileSync(spelerPath, 'utf8');
    expect(c).not.toContain('/api/mol/ronde-fase');
  });

  it('speler.js roept groep-status endpoint aan', () => {
    const c = fs.readFileSync(spelerPath, 'utf8');
    expect(c).toContain('groep-status');
  });

  it('briefing-start stuurt groepshoofd_stem mee', () => {
    const c = fs.readFileSync(spelerPath, 'utf8');
    expect(c).toContain('groepshoofd_stem');
    expect(c).toContain('briefing-start');
  });

  it('speler.js toont discussiescherm met groepshoofd naam', () => {
    const c = fs.readFileSync(spelerPath, 'utf8');
    expect(c).toContain('groepshoofd_naam');
    expect(c).toContain('discussie-data');
  });

  it('speler.js heeft groepsantwoord flow voor groepshoofd', () => {
    const c = fs.readFileSync(spelerPath, 'utf8');
    expect(c).toContain('groepsantwoord');
    expect(c).toContain('is_groepshoofd');
  });

  it('docent-sessie.js heeft geen PATCH naar /api/mol/ronde-fase', () => {
    const c = fs.readFileSync(docentPath, 'utf8');
    const m = c.match(/['"]\/api\/mol\/ronde-fase['"]/);
    expect(m).toBeNull();
  });

  it('mol-test stuurt verdachte_id mee voor hele sessie', () => {
    const c = fs.readFileSync(spelerPath, 'utf8');
    expect(c).toContain('verdachte_id');
    // submitTest mag geen ronde_nr in body hebben
    const submitTestMatch = c.match(/async function submitTest[\s\S]*?\n\}/);
    expect(submitTestMatch).not.toBeNull();
    expect(submitTestMatch[0]).not.toContain('ronde_nr');
  });
});
