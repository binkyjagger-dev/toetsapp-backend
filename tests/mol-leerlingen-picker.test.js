const fs = require('fs');
const path = require('path');
const pickerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'leerlingen-picker.js');
const molPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol-js/leerlingen-picker.js — extractie', () => {
  it('bestaat', () => { expect(fs.existsSync(pickerPath)).toBe(true); });
  it('bevat kernfuncties', () => {
    const c = fs.readFileSync(pickerPath, 'utf8');
    expect(c).toContain('function openLeerlingenPicker');
    expect(c).toContain('function laadPickerLeerlingen');
    expect(c).toContain('function bevestigLeerlingenKeuze');
    expect(c).toContain('function laadMolLessenDropdown');
  });
  it('geen alert()', () => { expect(fs.readFileSync(pickerPath, 'utf8')).not.toMatch(/alert\(/); });
  it('script tag aanwezig', () => { expect(fs.readFileSync(molPath, 'utf8')).toContain('src="mol-js/leerlingen-picker.js"'); });
  it('functies niet meer inline', () => {
    const c = fs.readFileSync(molPath, 'utf8');
    expect(c).not.toContain('function openLeerlingenPicker');
    expect(c).not.toContain('function laadMolLessenDropdown');
  });
});
