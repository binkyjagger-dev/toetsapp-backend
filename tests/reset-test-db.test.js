'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const scriptPath = path.join(__dirname, '..', 'scripts', 'reset-test-db.js');
const migrationsDir = path.join(__dirname, '..', 'migrations');

describe('reset-test-db.js — statische checks', () => {
  it('script bestaat op scripts/reset-test-db.js', () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  it('node --check slaagt (geen syntaxfouten)', () => {
    expect(() => {
      execSync(`node --check "${scriptPath}"`, { stdio: 'pipe' });
    }).not.toThrow();
  });

  it('productie-guard aanwezig: IS_TEST_DATABASE !== "true"', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');
    // De guard-regel moet process.exit(1) aanroepen als IS_TEST_DATABASE niet "true" is
    expect(content).toMatch(/IS_TEST_DATABASE[^=]*!==\s*["']true["']/);
    expect(content).toMatch(/process\.exit\(1\)/);
  });

  it('tabellijst in sync: elke CREATE TABLE uit migrations heeft een DELETE FROM in het script', () => {
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    // Verzamel alle CREATE TABLE-namen uit migrations (exclusief schema_migrations)
    const migFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf8'));

    const createTableNames = new Set();
    for (const sql of migFiles) {
      for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/gi)) {
        if (m[1] !== 'schema_migrations') createTableNames.add(m[1]);
      }
    }

    // Elk CREATE TABLE-naam (behalve schema_migrations) moet een DELETE FROM hebben
    for (const tabel of createTableNames) {
      expect(scriptContent).toMatch(new RegExp(`DELETE FROM ${tabel}\\b`));
    }
  });
});
