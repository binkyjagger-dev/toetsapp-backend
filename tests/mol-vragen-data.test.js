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

describe('mol — vragen uit DOM lezen', () => {
  const c = fs.readFileSync(docentSessiePath, 'utf8');
  const maakSessieBody = getFunctionBody(c, 'maakSessie');

  it('maakSessie bestaat', () => {
    expect(maakSessieBody).not.toBeNull();
  });

  it('vragenData wordt niet gebruikt in maakSessie', () => {
    expect(maakSessieBody).not.toContain('vragenData');
  });

  it('vragen worden uit DOM gelezen in maakSessie', () => {
    const heeftDomSelector =
      maakSessieBody.includes('.ronde-vraag-input') ||
      maakSessieBody.includes('ronde-kaart') ||
      maakSessieBody.includes('leesVragenUitDOM');
    expect(heeftDomSelector).toBe(true);
  });
});
