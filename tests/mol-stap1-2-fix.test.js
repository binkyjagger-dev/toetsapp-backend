const fs = require('fs');
const path = require('path');

const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol — stap1 en stap2 fixes', () => {
  const html = () => fs.readFileSync(molHtmlPath, 'utf8');

  it('rondes input bestaat met juist id', () => {
    expect(html()).toContain('setup-n-rondes');
  });

  it('groepgrootte knoppen hebben juist id', () => {
    expect(html()).toContain('setup-groep-grootte');
  });

  it('leerlingen textarea heeft juist id', () => {
    expect(html()).toContain('id="leerlingen-input"');
  });

  it('groepen preview heeft juist id', () => {
    expect(html()).toContain('preview-groepen');
  });

  it('preview-count bestaat', () => {
    expect(html()).toContain('preview-count');
  });

  it('terugknoppen aanwezig', () => {
    const c = html();
    expect(c).toContain('screen-sessie-stap1');
    // stap2 moet terug kunnen naar stap1
    expect(c).toMatch(/← Terug/);
  });
});
