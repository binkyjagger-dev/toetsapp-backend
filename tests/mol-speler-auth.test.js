const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');

describe('MOL-01 Fix 1 — speler-endpoints zonder verifyToken', () => {
  let src;
  beforeAll(() => { src = fs.readFileSync(serverPath, 'utf8'); });

  it('groep-status route heeft geen verifyToken als middleware', () => {
    // Zoek de exacte routedefinitie-regel
    const lijn = src.split('\n').find(l =>
      l.includes("'/api/mol/sessies/:id/groep-status'") &&
      l.includes('app.get')
    );
    expect(lijn).toBeDefined();
    expect(lijn).not.toContain('verifyToken');
  });

  it('discussie-data route heeft geen verifyToken als middleware', () => {
    const lijn = src.split('\n').find(l =>
      l.includes("'/api/mol/sessies/:id/discussie-data'") &&
      l.includes('app.get')
    );
    expect(lijn).toBeDefined();
    expect(lijn).not.toContain('verifyToken');
  });
});
