const fs = require('fs');
const path = require('path');

const authJsPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'auth.js');
const indexHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'index.html');

describe('auth.js — module extractie', () => {
  it('js/auth.js bestaat', () => {
    expect(fs.existsSync(authJsPath)).toBe(true);
  });

  it('auth.js bevat de verwachte functies', () => {
    const content = fs.readFileSync(authJsPath, 'utf8');
    expect(content).toContain('function loginTeacher');
    expect(content).toContain('function registreer');
    expect(content).toContain('function logoutTeacher');
    expect(content).toContain('DOMContentLoaded');
  });

  it('auth.js gebruikt showToast in plaats van alert', () => {
    const content = fs.readFileSync(authJsPath, 'utf8');
    expect(content).not.toMatch(/alert\(/);
  });

  it('index.html laadt js/auth.js via script tag', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).toContain('src="js/auth.js"');
  });

  it('functies zijn niet meer inline in index.html', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).not.toContain('async function loginTeacher');
    expect(content).not.toContain('async function registreer');
    expect(content).not.toContain('function logoutTeacher');
  });
});
