const fs = require('fs');
const path = require('path');

const docentSetupPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-setup.js');
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

function getCssRule(src, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped + '\\s*\\{[^}]+\\}');
  const m = src.match(re);
  return m ? m[0] : null;
}

describe('mol — drie bugfixes', () => {
  it('groepGrootte wordt correct geïnitialiseerd bij stap 2', () => {
    const c = fs.readFileSync(docentSetupPath, 'utf8');
    const body = getFunctionBody(c, 'goToLeerlingenSetup');
    expect(body).not.toBeNull();
    const heeftActiefBtn = body.includes('.actief') || body.includes('groepGrootte = 3');
    expect(heeftActiefBtn).toBe(true);
  });

  it('laadSessieLijst wordt aangeroepen na maakSessie', () => {
    const c = fs.readFileSync(docentSessiePath, 'utf8');
    const body = getFunctionBody(c, 'maakSessie');
    expect(body).not.toBeNull();
    expect(body).toContain('laadSessieLijst');
  });

  it('ronde-vraag-input heeft witte achtergrond', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    const rule = getCssRule(c, '.ronde-vraag-input');
    expect(rule).not.toBeNull();
    expect(rule).toMatch(/background\s*:\s*(#fff|white)/);
  });

  it('optie-tekst-input heeft witte achtergrond', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    const rule = getCssRule(c, '.optie-tekst-input');
    expect(rule).not.toBeNull();
    expect(rule).toMatch(/background\s*:\s*(#fff|white)/);
  });

  it('optie-feedback-input heeft witte achtergrond', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    const rule = getCssRule(c, '.optie-feedback-input');
    expect(rule).not.toBeNull();
    expect(rule).toMatch(/background\s*:\s*(#fff|white)/);
  });
});
