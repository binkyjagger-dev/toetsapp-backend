const fs = require('fs');
const path = require('path');
const revealPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'reveal.js');
const molPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol-js/reveal.js — extractie', () => {
  it('bestaat', () => { expect(fs.existsSync(revealPath)).toBe(true); });
  it('bevat kernfuncties', () => {
    const c = fs.readFileSync(revealPath, 'utf8');
    expect(c).toContain('function renderSpelerReveal');
    expect(c).toContain('function bouwScoreOpbouw');
    expect(c).toContain('function renderResultaten');
  });
  it('geen alert()', () => { expect(fs.readFileSync(revealPath, 'utf8')).not.toMatch(/alert\(/); });
  it('script tag aanwezig', () => { expect(fs.readFileSync(molPath, 'utf8')).toContain('src="mol-js/reveal.js"'); });
  it('functies niet meer inline', () => {
    const c = fs.readFileSync(molPath, 'utf8');
    expect(c).not.toContain('function renderSpelerReveal');
    expect(c).not.toContain('function bouwScoreOpbouw');
  });
});
