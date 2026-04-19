const fs = require('fs');
const path = require('path');

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

describe('mol — laadDocentSessie fix', () => {
  const c = fs.readFileSync(docentSessiePath, 'utf8');
  const body = getFunctionBody(c, 'laadDocentSessie');

  it('laadDocentSessie bestaat', () => {
    expect(body).not.toBeNull();
  });

  it('laadDocentSessie gebruikt geen ontbrekende element-ids', () => {
    expect(body).not.toContain('docent-sessie-code');
    expect(body).not.toContain('docent-code-display');
    expect(body).not.toContain('docent-speler-url');
  });

  it('laadDocentSessie navigeert naar screen-spelcodes', () => {
    expect(body).toContain('screen-spelcodes');
  });

  it('startSessie bestaat', () => {
    expect(c).toMatch(/function\s+startSessie/);
  });
});
