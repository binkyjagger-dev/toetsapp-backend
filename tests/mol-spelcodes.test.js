const fs = require('fs');
const path = require('path');

const serverPath       = path.join(__dirname, '..', 'server.js');
const docentSessiePath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js');

describe('MOL-01 Fix 2 — spelcodes endpoint gebruikt docentCode', () => {
  let serverSrc, docentSrc;
  beforeAll(() => {
    serverSrc  = fs.readFileSync(serverPath, 'utf8');
    docentSrc  = fs.readFileSync(docentSessiePath, 'utf8');
  });

  it('genereer-spelcodes route heeft geen verifyToken als middleware', () => {
    const lijn = serverSrc.split('\n').find(l =>
      l.includes("'/api/mol/sessies/:id/genereer-spelcodes'") &&
      l.includes('app.post')
    );
    expect(lijn).toBeDefined();
    expect(lijn).not.toContain('verifyToken');
  });

  it('genereer-spelcodes handler controleert docentCode uit req.body', () => {
    const idx = serverSrc.indexOf("'/api/mol/sessies/:id/genereer-spelcodes'");
    expect(idx).toBeGreaterThan(-1);
    const fragment = serverSrc.slice(idx, idx + 600);
    expect(fragment).toContain('docentCode');
    expect(fragment).toContain('docent_code');
  });

  it('genereerSpelcodesEnToon stuurt docentCode mee in de request body', () => {
    const idx = docentSrc.indexOf('genereer-spelcodes');
    expect(idx).toBeGreaterThan(-1);
    const fragment = docentSrc.slice(idx, idx + 300);
    expect(fragment).toContain('docentCode');
  });
});
