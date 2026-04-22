const fs = require('fs');
const path = require('path');

const docentSessiePath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js');
const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

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

describe('renderDocentSessie — dashboard', () => {
  const c = fs.readFileSync(docentSessiePath, 'utf8');
  const body = getFunctionBody(c, 'renderDocentSessie');
  const refreshBody = getFunctionBody(c, 'refreshDashboardData');

  it('happy path: toont dashboard en fetcht data', () => {
    expect(body).toContain("showScreen('screen-docent-dashboard')");
    expect(refreshBody).toContain('/api/mol/sessies/');
    expect(refreshBody).toContain('/dashboard');
    expect(refreshBody).toContain('dashboard-sessie-naam');
    expect(refreshBody).toContain('dashboard-stat-online');
    expect(refreshBody).toContain('les_naam');
    expect(refreshBody).toContain('stats.online');
  });

  it('sessie gestopt: status-gestopt klasse wordt gezet', () => {
    expect(refreshBody).toContain('status-gestopt');
    expect(refreshBody).toContain('status-actief');
  });

  it('leeg sessieId: toast en geen navigatie', () => {
    expect(body).toContain('Geen sessie geselecteerd');
    const checkIdx = body.indexOf('Geen sessie geselecteerd');
    const dashboardIdx = body.indexOf("showScreen('screen-docent-dashboard')");
    expect(checkIdx).toBeLessThan(dashboardIdx);
  });

  it('netwerkfout: toast en terug naar sessielijst', () => {
    expect(body).toContain('Netwerkfout');
    expect(body).toContain("showScreen('screen-sessie-lijst')");
  });

  it('klasse-reset: verwijdert oude status-klasse voor nieuwe toevoegen', () => {
    expect(refreshBody).toMatch(/classList\.remove\(.*status-actief/);
    expect(refreshBody).toMatch(/classList\.remove\(.*status-gestopt/);
  });

  it('CSS klassen status-actief en status-gestopt bestaan in HTML', () => {
    const html = fs.readFileSync(molHtmlPath, 'utf8');
    expect(html).toContain('.status-actief');
    expect(html).toContain('.status-gestopt');
  });
});
