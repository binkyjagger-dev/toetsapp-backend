const fs = require('fs');
const path = require('path');

const apiJsPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'api.js');
const indexHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'index.html');

describe('api.js — module extractie', () => {
  it('js/api.js bestaat', () => {
    expect(fs.existsSync(apiJsPath)).toBe(true);
  });

  it('api.js bevat API_BASE en apiFetch', () => {
    const content = fs.readFileSync(apiJsPath, 'utf8');
    expect(content).toMatch(/API_BASE/);
    expect(content).toMatch(/apiFetch/);
  });

  it('api.js bevat de Railway URL', () => {
    const content = fs.readFileSync(apiJsPath, 'utf8');
    expect(content).toContain('toetsapp-backend-production.up.railway.app');
  });

  it('index.html laadt js/api.js via script tag', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).toContain('src="js/api.js"');
  });

  it('index.html heeft API_BASE en apiFetch niet meer inline', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).not.toContain('const API_BASE');
    expect(content).not.toContain('async function apiFetch');
  });
});
