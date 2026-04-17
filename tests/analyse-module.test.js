const fs = require('fs');
const path = require('path');

const analyseJsPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'analyse.js');
const indexHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'index.html');

describe('analyse.js — module extractie', () => {
  it('js/analyse.js bestaat', () => {
    expect(fs.existsSync(analyseJsPath)).toBe(true);
  });

  it('analyse.js bevat de kernfuncties', () => {
    const content = fs.readFileSync(analyseJsPath, 'utf8');
    expect(content).toContain('function vulAnalyseFilters');
    expect(content).toContain('function runAnalyse');
    expect(content).toContain('function initAnalyseTab');
    expect(content).toContain('function renderVoortgangLeerling');
    expect(content).toContain('function renderKlasGemiddelden');
    expect(content).toContain('function renderHiatenKaart');
  });

  it('vulAnalyseFilters is gedefinieerd', () => {
    const content = fs.readFileSync(analyseJsPath, 'utf8');
    expect(content).toContain('function vulAnalyseFilters');
  });

  it('analyse.js bevat geen alert() aanroepen', () => {
    const content = fs.readFileSync(analyseJsPath, 'utf8');
    expect(content).not.toMatch(/alert\(/);
  });

  it('index.html laadt js/analyse.js via script tag', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).toContain('src="js/analyse.js"');
  });

  it('kernfuncties zijn niet meer inline in index.html', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).not.toContain('function runAnalyse');
    expect(content).not.toContain('function initAnalyseTab');
    expect(content).not.toContain('function renderHiatenKaart');
  });
});
