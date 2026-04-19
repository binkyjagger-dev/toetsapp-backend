const fs = require('fs');
const path = require('path');

const docentSetupPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-setup.js');

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

describe('mol — AI functies vragen stap', () => {
  const c = fs.readFileSync(docentSetupPath, 'utf8');

  it('genereerRondeAI bestaat', () => {
    expect(c).toContain('function genereerRondeAI');
  });

  it('vulRondeMetAIData bestaat', () => {
    expect(c).toContain('function vulRondeMetAIData');
  });

  it('vulOptieMetData bestaat', () => {
    expect(c).toContain('function vulOptieMetData');
  });

  it('genereerFeedbackOptie bestaat', () => {
    expect(c).toContain('function genereerFeedbackOptie');
  });

  it('genereerRondeAI roept /api/mol/genereer-vraag aan', () => {
    const body = getFunctionBody(c, 'genereerRondeAI');
    expect(body).not.toBeNull();
    expect(body).toContain('/api/mol/genereer-vraag');
  });

  it('genereerFeedbackOptie roept /api/mol/genereer-feedback aan', () => {
    const body = getFunctionBody(c, 'genereerFeedbackOptie');
    expect(body).not.toBeNull();
    expect(body).toContain('/api/mol/genereer-feedback');
  });
});
