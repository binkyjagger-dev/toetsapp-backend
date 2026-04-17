const fs = require('fs');
const path = require('path');

const klassenJsPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'klassen.js');
const indexHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'index.html');

describe('klassen.js — module extractie', () => {
  it('js/klassen.js bestaat', () => {
    expect(fs.existsSync(klassenJsPath)).toBe(true);
  });

  it('klassen.js bevat de kernfuncties', () => {
    const content = fs.readFileSync(klassenJsPath, 'utf8');
    expect(content).toContain('function renderKlasActiviteiten');
    expect(content).toContain('function openCreateClass');
    expect(content).toContain('function deleteClass');
    expect(content).toContain('function renderKlasLeerlingen');
    expect(content).toContain('function renderKlasResultaten');
  });

  it('klassen.js bevat geen alert() aanroepen', () => {
    const content = fs.readFileSync(klassenJsPath, 'utf8');
    expect(content).not.toMatch(/alert\(/);
  });

  it('index.html laadt js/klassen.js via script tag', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).toContain('src="js/klassen.js"');
  });

  it('kernfuncties zijn niet meer inline in index.html', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).not.toContain('function openCreateClass');
    expect(content).not.toContain('function deleteClass');
    expect(content).not.toContain('function renderKlasActiviteiten');
  });
});
