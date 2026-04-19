const fs = require('fs');
const path = require('path');

const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');
const docentSessiePath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js');

function getFunctionBody(src, naam) {
  const re = new RegExp('(?:async\\s+)?function\\s+' + naam + '\\s*\\([^)]*\\)\\s*\\{');
  const m = src.match(re);
  if (!m) return null;
  const start = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(m.index, i + 1); }
  }
  return null;
}

describe('mol — sessielijst fixes', () => {
  it('sessie-lijst-loading bestaat in HTML', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    expect(c).toContain('sessie-lijst-loading');
  });

  it('sessie-lijst-wrap bestaat in HTML', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    expect(c).toContain('sessie-lijst-wrap');
  });

  it('sessie-lijst-leeg bestaat in HTML', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    expect(c).toContain('sessie-lijst-leeg');
  });

  it('knoptekst is Sessie opslaan', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    expect(c).toContain('Sessie opslaan');
    expect(c).not.toContain('Sessie aanmaken en starten');
  });

  it('sessiekaart heeft Starten knop', () => {
    const c = fs.readFileSync(docentSessiePath, 'utf8');
    const body = getFunctionBody(c, 'laadSessieLijst');
    expect(body).not.toBeNull();
    expect(body).toMatch(/Starten|startSessie/);
  });

  it('sessiekaart heeft Bewerken knop', () => {
    const c = fs.readFileSync(docentSessiePath, 'utf8');
    const body = getFunctionBody(c, 'laadSessieLijst');
    expect(body).not.toBeNull();
    expect(body).toMatch(/Bewerken|bewerkSessie/);
  });
});
