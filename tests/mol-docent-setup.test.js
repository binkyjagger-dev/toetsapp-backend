const fs = require('fs');
const path = require('path');

const setupJsPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-setup.js');
const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol-js/docent-setup.js — extractie', () => {
  it('mol-js/docent-setup.js bestaat', () => {
    expect(fs.existsSync(setupJsPath)).toBe(true);
  });

  it('docent-setup.js bevat de kernfuncties', () => {
    const content = fs.readFileSync(setupJsPath, 'utf8');
    expect(content).toContain('function goToLeerlingenSetup');
    expect(content).toContain('function parseLeerlingen');
    expect(content).toContain('function genereerGroepsindeling');
    expect(content).toContain('function renderGroepsindeling');
    expect(content).toContain('function selecteerMol');
    expect(content).toContain('function renderRondeKaart');
    expect(content).toContain('function initStap4');
    expect(content).toContain('function genereerRondeAI');
    expect(content).toContain('function voegOptieToe');
  });

  it('docent-setup.js bevat geen alert() aanroepen', () => {
    const content = fs.readFileSync(setupJsPath, 'utf8');
    expect(content).not.toMatch(/alert\(/);
  });

  it('mol-lesvorm.html laadt mol-js/docent-setup.js', () => {
    const content = fs.readFileSync(molHtmlPath, 'utf8');
    expect(content).toContain('src="mol-js/docent-setup.js"');
  });

  it('kernfuncties niet meer inline', () => {
    const content = fs.readFileSync(molHtmlPath, 'utf8');
    expect(content).not.toContain('function parseLeerlingen');
    expect(content).not.toContain('function genereerGroepsindeling');
    expect(content).not.toContain('function renderVraagKaart');
  });
});
