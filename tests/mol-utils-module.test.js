const fs = require('fs');
const path = require('path');

const utilsJsPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'utils.js');
const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol-js/utils.js — module extractie', () => {
  it('mol-js/utils.js bestaat', () => {
    expect(fs.existsSync(utilsJsPath)).toBe(true);
  });

  it('utils.js bevat de utility functies', () => {
    const content = fs.readFileSync(utilsJsPath, 'utf8');
    expect(content).toContain('function showScreen');
    expect(content).toContain('function toast');
    expect(content).toContain('function escH');
    expect(content).toContain('function uid');
  });

  it('utils.js bevat geen alert() aanroepen', () => {
    const content = fs.readFileSync(utilsJsPath, 'utf8');
    expect(content).not.toMatch(/alert\(/);
  });

  it('mol-lesvorm.html laadt mol-js/utils.js', () => {
    const content = fs.readFileSync(molHtmlPath, 'utf8');
    expect(content).toContain('src="mol-js/utils.js"');
  });

  it('functies niet meer inline in mol-lesvorm.html', () => {
    const content = fs.readFileSync(molHtmlPath, 'utf8');
    expect(content).not.toContain('function showScreen');
    expect(content).not.toContain('function toast');
    expect(content).not.toContain('function escH');
  });
});
