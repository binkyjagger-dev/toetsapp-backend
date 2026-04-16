const fs = require('fs');
const path = require('path');

const llJsPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'leerlingen.js');
const indexHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'index.html');

describe('leerlingen.js — module extractie', () => {
  it('js/leerlingen.js bestaat', () => {
    expect(fs.existsSync(llJsPath)).toBe(true);
  });

  it('leerlingen.js bevat de kernfuncties', () => {
    const content = fs.readFileSync(llJsPath, 'utf8');
    expect(content).toContain('function laadLeerlingenTab');
    expect(content).toContain('function laadLeerlingen');
    expect(content).toContain('function renderLeerlingenTabel');
    expect(content).toContain('function verwijderLeerling');
    expect(content).toContain('function handleXlsxUpload');
    expect(content).toContain('function bevestigImport');
  });

  it('leerlingen.js bevat geen alert() aanroepen', () => {
    const content = fs.readFileSync(llJsPath, 'utf8');
    expect(content).not.toMatch(/alert\(/);
  });

  it('index.html laadt js/leerlingen.js via script tag', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).toContain('src="js/leerlingen.js"');
  });

  it('kernfuncties zijn niet meer inline in index.html', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).not.toContain('function laadLeerlingenTab');
    expect(content).not.toContain('function laadLeerlingen');
    expect(content).not.toContain('function handleXlsxUpload');
  });
});
