const fs = require('fs');
const path = require('path');

const LEGACY_STRING_TEST_FILES = [
  'analyse-module.test.js', 'api-module.test.js', 'auth-module.test.js',
  'auth-security.test.js', 'classes.test.js', 'klassen-module.test.js',
  'leerdoelen-module.test.js', 'leerdoelen.test.js', 'leerlingen-module.test.js',
  'leerlingen.test.js', 'lessen-module.test.js', 'lessen-split.test.js',
  'lesson-multi-class.test.js', 'lesson-planning.test.js', 'lessons-detail.test.js',
  'lessons.test.js', 'migrations.test.js', 'mol-api-module.test.js',
  'mol-dashboard-render.test.js', 'mol-docent-sessie-fix.test.js',
  'mol-docent-sessie.test.js', 'mol-docent-setup.test.js', 'mol-dode-code.test.js',
  'mol-drie-bugs.test.js', 'mol-flow.test.js', 'mol-frontend-flow.test.js',
  'mol-frontend-schermen.test.js', 'mol-groepen-fix.test.js', 'mol-hergebruik.test.js',
  'mol-ids-fix.test.js', 'mol-leerlingen-picker.test.js', 'mol-picker-fix.test.js',
  'mol-picker-interactie.test.js', 'mol-projectie.test.js', 'mol-reveal.test.js',
  'mol-schermen.test.js', 'mol-sessie-bugs.test.js', 'mol-sessielijst-fix.test.js',
  'mol-speler.test.js', 'mol-stap-navigatie.test.js', 'mol-stap1-2-fix.test.js',
  'mol-state-module.test.js', 'mol-utils-module.test.js', 'mol-verwijzingen.test.js',
  'mol-vragen-data.test.js', 'mol-vragen-stap-b2.test.js', 'mol-vragen-stap-b3.test.js',
  'mol-vragen-stap.test.js', 'navigatie-module.test.js', 'public-classes.test.js',
  'refresh-cache.test.js', 'state-module.test.js', 'student-module.test.js',
  'utils-module.test.js',
];

const SKIP_FILES = ['test-quality.test.js', 'mol-dashboard-render-dom.test.js'];

function detecteerOvertreding(inhoud, bestandsnaam) {
  if (LEGACY_STRING_TEST_FILES.includes(bestandsnaam)) return null;
  if (SKIP_FILES.includes(bestandsnaam)) return null;
  const leestMolJs = /readFileSync\([^)]*mol-js/.test(inhoud);
  if (!leestMolJs) return null;
  const gebruiktStringMatch = /\.(toContain|toMatch)\s*\(/.test(inhoud);
  if (!gebruiktStringMatch) return null;
  const heeftJsdom = /@jest-environment\s+jsdom/.test(inhoud);
  if (heeftJsdom) return null;
  return `Bestand tests/${bestandsnaam} gebruikt fs.readFileSync op mol-js broncode `
    + `met .toContain/.toMatch assertions. Dit is een string-matching test en verboden `
    + `sinds 21 apr 2026. Schrijf een runtime DOM-test met jsdom. `
    + `Zie project-instructies sectie 'Test-kwaliteit'.`;
}

describe('test-quality — geen nieuwe string-matching tests voor mol-js DOM-code', () => {
  it('whitelist-bestanden worden niet gemarkeerd', () => {
    const voorbeeld = LEGACY_STRING_TEST_FILES[0];
    const inhoud = fs.readFileSync(path.join(__dirname, voorbeeld), 'utf8');
    expect(detecteerOvertreding(inhoud, voorbeeld)).toBeNull();
  });

  it('fake string-matching test wordt gedetecteerd', () => {
    const fake = [
      "const fs = require('fs');",
      "const c = fs.readFileSync('mol-js/speler.js', 'utf8');",
      "expect(c).toContain('showScreen');",
    ].join('\n');
    const result = detecteerOvertreding(fake, 'mol-nieuw.test.js');
    expect(result).not.toBeNull();
    expect(result).toContain('mol-nieuw.test.js');
    expect(result).toContain('string-matching test');
  });

  it('geldig jsdom DOM-test wordt niet gedetecteerd', () => {
    const valid = [
      '/** @jest-environment jsdom */',
      "const c = fs.readFileSync('mol-js/x.js', 'utf8');",
      "expect(el.textContent).toContain('test');",
    ].join('\n');
    expect(detecteerOvertreding(valid, 'mol-nieuw-dom.test.js')).toBeNull();
  });

  it('bestand zonder mol-js reads wordt niet gedetecteerd', () => {
    const safe = [
      "const c = fs.readFileSync('mol-lesvorm.html', 'utf8');",
      "expect(c).toContain('screen-sessie-lijst');",
    ].join('\n');
    expect(detecteerOvertreding(safe, 'mol-html-check.test.js')).toBeNull();
  });

  it('geen overtredingen in huidige testsuite', () => {
    const testsDir = __dirname;
    const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js'));
    const overtredingen = [];
    for (const file of files) {
      const inhoud = fs.readFileSync(path.join(testsDir, file), 'utf8');
      const melding = detecteerOvertreding(inhoud, file);
      if (melding) overtredingen.push(melding);
    }
    expect(overtredingen).toEqual([]);
  });
});
