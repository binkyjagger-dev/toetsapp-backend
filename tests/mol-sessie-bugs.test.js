const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
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

describe('mol — sessie aanmaken bugs', () => {
  it('/api/mol/genereer-vraag endpoint bestaat in server.js', () => {
    const c = fs.readFileSync(serverPath, 'utf8');
    expect(c).toContain('/api/mol/genereer-vraag');
  });

  it('err null-check in catch-block van maakSessie', () => {
    const c = fs.readFileSync(docentSessiePath, 'utf8');
    const body = getFunctionBody(c, 'maakSessie');
    expect(body).not.toBeNull();
    const catchIdx = body.indexOf('catch');
    expect(catchIdx).toBeGreaterThan(-1);
    const catchBlock = body.slice(catchIdx);
    const heeftNullCheck = /if\s*\(\s*err\s*\)/.test(catchBlock) || /err\?\./.test(catchBlock);
    expect(heeftNullCheck).toBe(true);
  });

  it('leesVragenUitDOM stuurt mc_opties formaat', () => {
    const c = fs.readFileSync(docentSessiePath, 'utf8');
    const body = getFunctionBody(c, 'leesVragenUitDOM');
    expect(body).not.toBeNull();
    expect(body).toContain('mc_opties');
  });
});
