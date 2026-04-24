const fs = require('fs');
const path = require('path');

const migPath = path.join(__dirname, '..', 'migrations', '005_mol_groepen_fase_check.sql');

describe('MOL-01 Fix 4 — migratie 005 CHECK constraint fase-waarden', () => {
  let sql;
  beforeAll(() => { sql = fs.readFileSync(migPath, 'utf8'); });

  it('constraint staat invoer toe (code-waarde)', () => {
    expect(sql).toContain("'invoer'");
  });

  it('constraint staat discussie toe (code-waarde)', () => {
    expect(sql).toContain("'discussie'");
  });

  it('constraint staat resultaat toe (code-waarde)', () => {
    expect(sql).toContain("'resultaat'");
  });

  it('constraint staat test toe (code-waarde)', () => {
    expect(sql).toContain("'test'");
  });

  it('constraint bevat geen individueel (onjuiste waarde)', () => {
    expect(sql).not.toContain("'individueel'");
  });

  it('constraint bevat geen moltest (onjuiste waarde)', () => {
    expect(sql).not.toContain("'moltest'");
  });
});
