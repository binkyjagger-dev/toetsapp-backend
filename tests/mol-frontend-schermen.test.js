const fs = require('fs');
const path = require('path');

const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');
const spelerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');
const setupPath  = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-setup.js');

describe('mol-js — nieuwe schermen', () => {
  it('mol-lesvorm.html bevat geen oude schermen', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    expect(c).not.toContain('id="screen-docent-login"');
    expect(c).not.toContain('id="screen-speler-wacht"');
  });

  it('mol-lesvorm.html bevat alle nieuwe schermen', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    expect(c).toContain('id="screen-sessie-lijst"');
    expect(c).toContain('id="screen-speler-login"');
    expect(c).toContain('id="screen-speler-briefing"');
    expect(c).toContain('id="screen-speler-ronde"');
    expect(c).toContain('id="screen-speler-discussie"');
    expect(c).toContain('id="screen-speler-feedback"');
    expect(c).toContain('id="screen-speler-test"');
    expect(c).toContain('id="screen-speler-reveal"');
    expect(c).toContain('id="screen-spelcodes"');
  });

  it('speler.js gebruikt nieuwe scherm-ids', () => {
    const c = fs.readFileSync(spelerPath, 'utf8');
    expect(c).toContain('screen-speler-login');
    expect(c).toContain('screen-speler-feedback');
    expect(c).toContain('spelcode');
  });

  it('speler.js toont geen punten in vraagscherm', () => {
    const c = fs.readFileSync(spelerPath, 'utf8');
    const match = c.match(/function renderSpelerRonde[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toMatch(/punten/i);
  });

  it('speler.js filtert eigen naam uit briefing', () => {
    const c = fs.readFileSync(spelerPath, 'utf8');
    // In de groepshoofd-keuze moet speler.id gefilterd worden
    const briefingMatch = c.match(/function renderSpelerBriefing[\s\S]*?\n\}/);
    expect(briefingMatch).not.toBeNull();
    expect(briefingMatch[0]).toMatch(/l\.id\s*!==\s*speler\.id/);
  });

  it('docent-setup.js gebruikt nieuwe scherm-ids', () => {
    const c = fs.readFileSync(setupPath, 'utf8');
    expect(c).toContain('screen-sessie-stap');
    expect(c).toContain('genereer-feedback');
    expect(c).toContain('mol-voorstel');
    expect(c).toContain('genereer-spelcodes');
  });

  it('speler.js roept ronde-feedback aan', () => {
    const c = fs.readFileSync(spelerPath, 'utf8');
    expect(c).toContain('ronde-feedback');
  });
});
