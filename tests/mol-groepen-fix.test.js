const fs = require('fs');
const path = require('path');

const docentSetupPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-setup.js');
const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

function getFunctionBody(src, naam) {
  const re = new RegExp('function\\s+' + naam + '\\s*\\([^)]*\\)\\s*\\{');
  const m = src.match(re);
  if (!m) return null;
  const start = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

describe('mol — groepen genereren', () => {
  it('groepsgrootte wordt correct gelezen via setupData', () => {
    const c = fs.readFileSync(docentSetupPath, 'utf8');
    const body = getFunctionBody(c, 'kiesGroepGrootte');
    expect(body).not.toBeNull();
    expect(body).toContain('setupData.groepGrootte');
  });

  it('resterende leerlingen worden verdeeld over groepen', () => {
    const c = fs.readFileSync(docentSetupPath, 'utf8');
    const body = getFunctionBody(c, 'genereerGroepsindeling');
    expect(body).not.toBeNull();
    const heeftModulo = /%/.test(body);
    const heeftWhile = /while\s*\(/.test(body);
    const heeftSliceRest = /slice\s*\(/.test(body) && /rest/i.test(body);
    expect(heeftModulo || heeftWhile || heeftSliceRest).toBe(true);
  });

  it('stap hernoemening in HTML: 4 stappen → 3 stappen', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    expect(c).toContain('Stap 1 van 3');
    expect(c).toContain('Stap 2 van 3');
    expect(c).toContain('Stap 3 van 3');
    expect(c).not.toContain('Stap 1 van 4');
    expect(c).not.toContain('Stap 2 van 4');
    expect(c).not.toContain('Stap 4 van 4');
  });

  it('page-eyebrow op screen-sessie-stap2 toont Stap 2 van 3', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    const stap2Start = c.indexOf('id="screen-sessie-stap2"');
    const stap2End = c.indexOf('<!-- SCREEN:', stap2Start + 1);
    const section = c.slice(stap2Start, stap2End);
    expect(section).toContain('Stap 2 van 3');
  });

  it('knop stap2 tekst: Vragen instellen', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    const stap2Start = c.indexOf('id="screen-sessie-stap2"');
    const stap2End = c.indexOf('<!-- SCREEN:', stap2Start + 1);
    const section = c.slice(stap2Start, stap2End);
    expect(section).toContain('Vragen instellen');
  });
});
