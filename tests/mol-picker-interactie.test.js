const fs = require('fs');
const path = require('path');

const molHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-lesvorm.html');

describe('mol — picker filters en selectie', () => {
  it('filters hebben onchange handlers in HTML', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    // Per filter: verwacht een select met id="..." én onchange of laadPickerLeerlingen in dezelfde tag
    const selectPattern = (id) => new RegExp(
      `<select[^>]*id=["']${id}["'][^>]*(onchange|laadPickerLeerlingen)[^>]*>|<select[^>]*(onchange|laadPickerLeerlingen)[^>]*id=["']${id}["'][^>]*>`
    );
    expect(c).toMatch(selectPattern('picker-niveau'));
    expect(c).toMatch(selectPattern('picker-leerjaar'));
    expect(c).toMatch(selectPattern('picker-klas'));
    expect(c).toMatch(selectPattern('picker-periode'));
  });

  it('alles-selecteren knoppen aanwezig in HTML', () => {
    const c = fs.readFileSync(molHtmlPath, 'utf8');
    expect(c).toContain('selecteerAllePickerLeerlingen');
    expect(c).toContain('deselecteerAllePickerLeerlingen');
  });
});
