const fs = require('fs');
const path = require('path');

const spelerJsPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');
const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol-js/speler.js — extractie', () => {
  it('bestaat', () => { expect(fs.existsSync(spelerJsPath)).toBe(true); });

  it('bevat kernfuncties', () => {
    const c = fs.readFileSync(spelerJsPath, 'utf8');
    expect(c).toContain('function spelerLogin');
    expect(c).toContain('function initSpelerFlow');
    expect(c).toContain('function pollSpelerStatus');
    expect(c).toContain('function renderSpelerRonde');
    expect(c).toContain('function submitAntwoord');
  });

  it('geen alert()', () => {
    expect(fs.readFileSync(spelerJsPath, 'utf8')).not.toMatch(/alert\(/);
  });

  it('script tag aanwezig', () => {
    expect(fs.readFileSync(molHtmlPath, 'utf8')).toContain('src="mol-js/speler.js"');
  });

  it('functies niet meer inline', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    expect(c).not.toContain('function spelerLogin');
    expect(c).not.toContain('function pollSpelerStatus');
  });
});
