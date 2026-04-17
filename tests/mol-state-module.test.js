const fs = require('fs');
const path = require('path');

const stateJsPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'state.js');
const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol-js/state.js — module extractie', () => {
  it('mol-js/state.js bestaat', () => {
    expect(fs.existsSync(stateJsPath)).toBe(true);
  });

  it('state.js bevat alle verwachte declaraties', () => {
    const content = fs.readFileSync(stateJsPath, 'utf8');
    expect(content).toContain('let docentToken');
    expect(content).toContain('let sessieId');
    expect(content).toContain('let sessieState');
    expect(content).toContain('let speler');
    expect(content).toContain('let setupData');
    expect(content).toContain('let vragenData');
    expect(content).toContain('let groepsindeling');
    expect(content).toContain('let pollTimer');
    expect(content).toContain('let heartbeatTimer');
    expect(content).toContain('let molLessenCache');
  });

  it('mol-lesvorm.html laadt mol-js/state.js', () => {
    const content = fs.readFileSync(molHtmlPath, 'utf8');
    expect(content).toContain('src="mol-js/state.js"');
  });

  it('mol-lesvorm.html heeft geen dubbele declaraties', () => {
    const content = fs.readFileSync(molHtmlPath, 'utf8');
    expect(content).not.toMatch(/^let docentToken/m);
    expect(content).not.toMatch(/^let sessieId/m);
    expect(content).not.toMatch(/^let sessieState/m);
    expect(content).not.toMatch(/^let pollTimer/m);
    expect(content).not.toMatch(/^let heartbeatTimer/m);
  });
});
