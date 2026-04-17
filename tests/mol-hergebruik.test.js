const fs = require('fs');
const path = require('path');
const hgPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'hergebruik.js');
const molPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol-js/hergebruik.js — extractie', () => {
  it('bestaat', () => { expect(fs.existsSync(hgPath)).toBe(true); });
  it('bevat kernfuncties', () => {
    const c = fs.readFileSync(hgPath, 'utf8');
    expect(c).toContain('function openHergebruik');
    expect(c).toContain('function startHergebruik');
    expect(c).toContain('function renderHergebruikGroepen');
  });
  it('geen alert()', () => { expect(fs.readFileSync(hgPath, 'utf8')).not.toMatch(/alert\(/); });
  it('script tag aanwezig', () => { expect(fs.readFileSync(molPath, 'utf8')).toContain('src="mol-js/hergebruik.js"'); });
  it('functies niet meer inline', () => {
    const c = fs.readFileSync(molPath, 'utf8');
    expect(c).not.toContain('function openHergebruik');
    expect(c).not.toContain('function renderHergebruikGroepen');
  });
});
