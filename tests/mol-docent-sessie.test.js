const fs = require('fs');
const path = require('path');

const sessieJsPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js');
const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol-js/docent-sessie.js — extractie', () => {
  it('mol-js/docent-sessie.js bestaat', () => {
    expect(fs.existsSync(sessieJsPath)).toBe(true);
  });

  it('bevat de kernfuncties', () => {
    const content = fs.readFileSync(sessieJsPath, 'utf8');
    expect(content).toContain('function maakSessie');
    expect(content).toContain('function laadSessieLijst');
    expect(content).toContain('function renderDocentSessie');
    expect(content).toContain('function startSessieAuto');
    expect(content).toContain('function advanceFase');
  });

  it('geen alert()', () => {
    const content = fs.readFileSync(sessieJsPath, 'utf8');
    expect(content).not.toMatch(/alert\(/);
  });

  it('script tag aanwezig', () => {
    const content = fs.readFileSync(molHtmlPath, 'utf8');
    expect(content).toContain('src="mol-js/docent-sessie.js"');
  });

  it('startSessieAuto komt precies 1 keer voor', () => {
    const content = fs.readFileSync(sessieJsPath, 'utf8');
    const matches = content.match(/function startSessieAuto/g);
    expect(matches).toHaveLength(1);
  });

  it('functies niet meer inline', () => {
    const content = fs.readFileSync(molHtmlPath, 'utf8');
    expect(content).not.toContain('function maakSessie');
    expect(content).not.toContain('function laadSessieLijst');
    expect(content).not.toContain('function renderDocentSessie');
  });
});
