const fs = require('fs');
const path = require('path');

const docentSetupPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-setup.js');
const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol — vragen instellen stap 3', () => {
  it('ronde-kaart-template bestaat in HTML', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    expect(c).toContain('ronde-kaart-template');
  });

  it('optie-template bestaat in HTML', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    expect(c).toContain('optie-template');
  });

  it('renderRondeKaart bestaat in docent-setup.js', () => {
    const c = fs.readFileSync(docentSetupPath, 'utf8');
    expect(c).toContain('function renderRondeKaart');
  });
});
