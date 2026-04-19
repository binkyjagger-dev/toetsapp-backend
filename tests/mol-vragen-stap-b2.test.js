const fs = require('fs');
const path = require('path');

const docentSetupPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-setup.js');

function getFunctionBody(src, naam) {
  const re = new RegExp('function\\s+' + naam + '\\s*\\([^)]*\\)\\s*\\{');
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

describe('mol — optie functies en init', () => {
  const c = fs.readFileSync(docentSetupPath, 'utf8');

  it('toonRondeInvoer bestaat', () => {
    expect(c).toContain('function toonRondeInvoer');
  });

  it('voegOptieToe bestaat', () => {
    expect(c).toContain('function voegOptieToe');
  });

  it('koppelOptieHandlers bestaat', () => {
    expect(c).toContain('function koppelOptieHandlers');
  });

  it('toggleCorrect bestaat', () => {
    expect(c).toContain('function toggleCorrect');
  });

  it('passPuntenAan bestaat', () => {
    expect(c).toContain('function passPuntenAan');
  });

  it('verwijderOptie bestaat', () => {
    expect(c).toContain('function verwijderOptie');
  });

  it('initStap4 bestaat', () => {
    expect(c).toContain('function initStap4');
  });

  it('naarStap3Mol roept initStap4 aan', () => {
    const body = getFunctionBody(c, 'naarStap3Mol');
    expect(body).not.toBeNull();
    expect(body).toContain('initStap4');
  });
});
