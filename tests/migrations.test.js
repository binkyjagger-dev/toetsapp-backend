const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'migrations');
const serverPath = path.join(__dirname, '..', 'server.js');

const EXPECTED_FILES = [
  '000_migration_runner.sql',
  '001_initial_schema.sql',
  '002_add_lesson_classes.sql',
  '003_add_lesson_planning.sql',
];

describe('Migrations — structuur en runner', () => {
  it('migrations/ map bestaat', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
  });

  it('migratiebestanden bestaan', () => {
    for (const file of EXPECTED_FILES) {
      expect(fs.existsSync(path.join(migrationsDir, file))).toBe(true);
    }
  });

  it('elk migratiebestand heeft een beschrijving', () => {
    for (const file of EXPECTED_FILES) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      expect(content).toMatch(/-- Beschrijving:/);
    }
  });

  it('bestanden zijn gesorteerd uitvoerbaar', () => {
    const nums = EXPECTED_FILES
      .map(f => f.match(/^(\d+)/))
      .filter(Boolean)
      .map(m => parseInt(m[1]));
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i]).toBeGreaterThan(nums[i - 1]);
    }
  });

  it('server.js bevat runMigrations', () => {
    const content = fs.readFileSync(serverPath, 'utf8');
    expect(content).toContain('function runMigrations');
    expect(content).toContain('schema_migrations');
  });
});
