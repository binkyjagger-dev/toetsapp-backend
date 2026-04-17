const fs = require('fs');
const path = require('path');

const apiJsPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'api.js');
const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol-js/api.js — module extractie', () => {
  it('mol-js/api.js bestaat', () => {
    expect(fs.existsSync(apiJsPath)).toBe(true);
  });

  it('api.js bevat API constante en apiFetch', () => {
    const content = fs.readFileSync(apiJsPath, 'utf8');
    expect(content).toContain('const API');
    expect(content).toContain('function apiFetch');
  });

  it('api.js bevat localhost fallback', () => {
    const content = fs.readFileSync(apiJsPath, 'utf8');
    expect(content).toContain('localhost');
  });

  it('mol-lesvorm.html laadt mol-js/api.js', () => {
    const content = fs.readFileSync(molHtmlPath, 'utf8');
    expect(content).toContain('src="mol-js/api.js"');
  });

  it('const API en apiFetch niet meer inline', () => {
    const content = fs.readFileSync(molHtmlPath, 'utf8');
    expect(content).not.toContain('const API');
    expect(content).not.toContain('async function apiFetch');
  });
});
