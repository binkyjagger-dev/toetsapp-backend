const fs = require('fs');
const path = require('path');
const glob = require('path');

const molJsDir = path.join(__dirname, '..', 'netlify-deploy', 'mol-js');
const readAll = () => {
  const files = fs.readdirSync(molJsDir).filter(f => f.endsWith('.js'));
  return files.map(f => fs.readFileSync(path.join(molJsDir, f), 'utf8')).join('\n');
};

describe('mol-lesvorm — alle verwijzingen geldig', () => {
  // A) Geen oude scherm-ids meer in mol-js/
  it('geen screen-docent-login in mol-js/', () => {
    expect(readAll()).not.toContain("'screen-docent-login'");
  });
  it('geen screen-docent-sessie in mol-js/', () => {
    expect(readAll()).not.toContain("'screen-docent-sessie'");
  });
  it('geen screen-hergebruik in mol-js/', () => {
    expect(readAll()).not.toContain("'screen-hergebruik'");
  });
  it('geen screen-keuze in mol-js/', () => {
    expect(readAll()).not.toContain("'screen-keuze'");
  });
  it('geen screen-projectie in mol-js/', () => {
    expect(readAll()).not.toContain("'screen-projectie'");
  });
  it('geen screen-resultaten in mol-js/', () => {
    expect(readAll()).not.toContain("'screen-resultaten'");
  });
  it('geen screen-speler-wacht (oud) in mol-js/', () => {
    const all = readAll();
    const matches = all.match(/'screen-speler-wacht'/g) || [];
    expect(matches.length).toBe(0);
  });

  // B) Ontbrekende functies bestaan nu
  it('naarStap2Leerlingen bestaat', () => {
    expect(readAll()).toContain('function naarStap2Leerlingen');
  });
  it('naarStap3Mol bestaat', () => {
    expect(readAll()).toContain('function naarStap3Mol');
  });
  it('naarStap4Vragen bestaat', () => {
    expect(readAll()).toContain('function naarStap4Vragen');
  });
  it('nieuweSessie bestaat', () => {
    expect(readAll()).toContain('function nieuweSessie');
  });
  it('openSessieNaAanmaken bestaat', () => {
    expect(readAll()).toContain('function openSessieNaAanmaken');
  });
  it('printSpelcodes bestaat', () => {
    expect(readAll()).toContain('function printSpelcodes');
  });
  it('sessieAanmakenEnStart bestaat', () => {
    expect(readAll()).toContain('function sessieAanmakenEnStart');
  });
  it('submitRondeAntwoord bestaat', () => {
    expect(readAll()).toContain('function submitRondeAntwoord');
  });
  it('voegRondeToe bestaat', () => {
    expect(readAll()).toContain('function voegRondeToe');
  });
});
