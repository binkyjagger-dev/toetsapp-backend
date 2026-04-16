const fs = require('fs');
const path = require('path');

const navJsPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'navigatie.js');
const indexHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'index.html');

describe('navigatie.js — module extractie', () => {
  it('js/navigatie.js bestaat', () => {
    expect(fs.existsSync(navJsPath)).toBe(true);
  });

  it('navigatie.js bevat de verwachte functies', () => {
    const content = fs.readFileSync(navJsPath, 'utf8');
    expect(content).toContain('function navNaar');
    expect(content).toContain('function openKlas');
    expect(content).toContain('function setBreadcrumb');
    expect(content).toContain('function setMainActions');
    expect(content).toContain('function toggleSidebar');
  });

  it('navigatie.js definieert de view-lijst als constante', () => {
    const content = fs.readFileSync(navJsPath, 'utf8');
    expect(content).toMatch(/const ALL_VIEWS/);
  });

  it('index.html laadt js/navigatie.js via script tag', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).toContain('src="js/navigatie.js"');
  });

  it('functies zijn niet meer inline in index.html', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).not.toContain('function navNaar');
    expect(content).not.toContain('function openKlas');
    expect(content).not.toContain('function setBreadcrumb');
  });
});
