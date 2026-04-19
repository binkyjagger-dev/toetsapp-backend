const fs = require('fs');
const path = require('path');

const docentSetupPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-setup.js');
const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol — stap navigatie zonder stap3', () => {
  it('naarStap3Mol navigeert naar stap4', () => {
    const c = fs.readFileSync(docentSetupPath, 'utf8');
    const match = c.match(/function\s+naarStap3Mol\s*\([^)]*\)\s*\{[^}]*\}/);
    expect(match).not.toBeNull();
    expect(match[0]).toContain('screen-sessie-stap4');
  });

  it('terugknop stap4 wijst naar stap2', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    const stap4Start = c.indexOf('id="screen-sessie-stap4"');
    expect(stap4Start).toBeGreaterThan(-1);
    const stap4End = c.indexOf('<!-- SCREEN:', stap4Start + 1);
    const stap4Section = c.slice(stap4Start, stap4End > -1 ? stap4End : stap4Start + 2000);
    const terugMatch = stap4Section.match(/<button[^>]*onclick="showScreen\('screen-sessie-stap\d'\)"[^>]*>\s*← Terug/);
    expect(terugMatch).not.toBeNull();
    expect(terugMatch[0]).toContain("showScreen('screen-sessie-stap2')");
  });
});
