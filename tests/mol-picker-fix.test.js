const fs = require('fs');
const path = require('path');

const pickerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'leerlingen-picker.js');
const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol — leerlingen picker filters', () => {
  it('niveau dropdown wordt gevuld', () => {
    const c = fs.readFileSync(pickerPath, 'utf8');
    // picker-niveau moet voorkomen in context van innerHTML of appendChild
    const pattern = /picker-niveau[\s\S]{0,120}innerHTML|picker-niveau[\s\S]{0,120}appendChild/;
    expect(c).toMatch(pattern);
  });

  it('leerjaar dropdown wordt gevuld', () => {
    const c = fs.readFileSync(pickerPath, 'utf8');
    const pattern = /picker-leerjaar[\s\S]{0,120}innerHTML|picker-leerjaar[\s\S]{0,120}appendChild/;
    expect(c).toMatch(pattern);
  });

  it('picker-lijst heeft CSS voor geselecteerde rij', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    // Moet een CSS regel hebben met .geselecteerd binnen picker-lijst context
    expect(c).toMatch(/#picker-lijst[^}]*\.geselecteerd|\.ll-picker-rij\.geselecteerd|\.picker-rij\.geselecteerd/);
  });
});
