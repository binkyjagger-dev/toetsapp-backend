const fs = require('fs');
const path = require('path');

const pickerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'leerlingen-picker.js');
const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol-lesvorm — id consistentie', () => {
  it('lessen-dropdown id consistent', () => {
    const c = fs.readFileSync(pickerPath, 'utf8');
    expect(c).toContain('sessie-les-select');
    expect(c).not.toContain('setup-les-kiezer');
  });

  it('leerlingen-picker modal bestaat', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    expect(c).toContain('ll-picker-modal');
  });

  it('alle picker ids aanwezig in HTML', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    const ids = [
      'll-picker-modal', 'picker-count', 'picker-klas',
      'picker-leerjaar', 'picker-lijst', 'picker-niveau',
      'picker-periode', 'setup-les-content',
      'sessie-les-select', 'setup-les-naam',
      'les-kiezer-preview',
    ];
    for (const id of ids) {
      expect(c).toContain(id);
    }
  });
});
