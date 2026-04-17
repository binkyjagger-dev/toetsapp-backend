const fs = require('fs');
const path = require('path');

const ldJsPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'leerdoelen.js');
const indexHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'index.html');

describe('leerdoelen.js — module extractie', () => {
  it('js/leerdoelen.js bestaat', () => {
    expect(fs.existsSync(ldJsPath)).toBe(true);
  });

  it('leerdoelen.js bevat de kernfuncties', () => {
    const content = fs.readFileSync(ldJsPath, 'utf8');
    expect(content).toContain('function laadLeerdoelenTab');
    expect(content).toContain('function renderLeerdoelenTabel');
    expect(content).toContain('function filterLeerdoelen');
    expect(content).toContain('function openLdModal');
    expect(content).toContain('function slaLeerdoelOp');
    expect(content).toContain('function verwijderLeerdoel');
    expect(content).toContain('function importeerLeerdoelenXlsx');
    expect(content).toContain('function bevestigLdImport');
  });

  it('leerdoelen.js declareert alleLeerdoelen niet opnieuw', () => {
    const content = fs.readFileSync(ldJsPath, 'utf8');
    expect(content).not.toContain('let alleLeerdoelen');
  });

  it('leerdoelen.js bevat geen alert() aanroepen', () => {
    const content = fs.readFileSync(ldJsPath, 'utf8');
    expect(content).not.toMatch(/alert\(/);
  });

  it('index.html laadt js/leerdoelen.js via script tag', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).toContain('src="js/leerdoelen.js"');
  });

  it('index.html heeft geen inline JavaScript meer', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).not.toContain('function laadLeerdoelenTab');
    expect(content).not.toContain('function renderLeerdoelenTabel');
  });
});
