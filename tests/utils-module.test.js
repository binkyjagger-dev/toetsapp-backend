const fs = require('fs');
const path = require('path');

const utilsJsPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'utils.js');
const indexHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'index.html');

describe('utils.js + index.html opschonen', () => {
  it('js/utils.js bestaat', () => {
    expect(fs.existsSync(utilsJsPath)).toBe(true);
  });

  it('utils.js bevat de utility functies', () => {
    const content = fs.readFileSync(utilsJsPath, 'utf8');
    expect(content).toContain('function showToast');
    expect(content).toContain('function showScreen');
    expect(content).toContain('function openModal');
    expect(content).toContain('function closeModal');
    expect(content).toContain('function escHtml');
    expect(content).toContain('function formatDate');
  });

  it('index.html laadt js/utils.js via script tag', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).toContain('src="js/utils.js"');
  });

  it('utils.js bevat geen alert() aanroepen', () => {
    const content = fs.readFileSync(utilsJsPath, 'utf8');
    expect(content).not.toMatch(/alert\(/);
  });

  it('index.html bevat minimaal inline JavaScript', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    const lines = content.split('\n');
    let inInlineScript = false;
    let inlineCount = 0;
    for (const line of lines) {
      if (/<script>/.test(line) && !/<script[^>]+src=/.test(line)) {
        inInlineScript = true; continue;
      }
      if (/<\/script>/.test(line)) { inInlineScript = false; continue; }
      if (inInlineScript && line.trim()) inlineCount++;
    }
    // Leerdoelen module (~280 regels) blijft inline tot stap 11
    expect(inlineCount).toBeLessThan(300);
  });

  it('utility functies niet meer inline in index.html', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).not.toContain('function showToast');
    expect(content).not.toContain('function showScreen');
    expect(content).not.toContain('function escHtml');
  });
});
