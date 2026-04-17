const fs = require('fs');
const path = require('path');
const sessiePath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js');
const molPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol-js projectie functies', () => {
  it('openProjectie zit in docent-sessie.js', () => {
    expect(fs.readFileSync(sessiePath, 'utf8')).toContain('function openProjectie');
  });
  it('sluitProjectie zit in docent-sessie.js', () => {
    expect(fs.readFileSync(sessiePath, 'utf8')).toContain('function sluitProjectie');
  });
  it('niet meer inline', () => {
    const c = fs.readFileSync(molPath, 'utf8');
    expect(c).not.toContain('function openProjectie');
    expect(c).not.toContain('function sluitProjectie');
  });
});
