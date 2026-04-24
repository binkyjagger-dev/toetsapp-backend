'use strict';
require('dotenv').config({ path: '.env.test' });
const { Client } = require('pg');

if (process.env.IS_TEST_DATABASE !== 'true') {
  console.error(
    '[reset-test-db] IS_TEST_DATABASE is niet "true" -- ' +
    'weigeren te draaien (productie-bescherming).'
  );
  process.exit(1);
}

async function resetTestDb() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET CONSTRAINTS ALL DEFERRED');
    // Kinderen voor ouders (FK-veilig). schema_migrations blijft ongemoeid.
    await client.query('DELETE FROM mol_test_antwoorden');
    await client.query('DELETE FROM mol_groep_stemmen');
    await client.query('DELETE FROM mol_antwoorden');
    await client.query('DELETE FROM mol_briefing_klaar');
    await client.query('DELETE FROM mol_cases');
    await client.query('DELETE FROM mol_leerlingen');
    await client.query('DELETE FROM mol_groepen');
    await client.query('DELETE FROM mol_sessies');
    await client.query('DELETE FROM results');
    await client.query('DELETE FROM lesson_classes');
    await client.query('DELETE FROM lessons');
    await client.query('DELETE FROM leerdoelen');
    await client.query('DELETE FROM leerlingen_import');
    await client.query('DELETE FROM classes');
    await client.query('DELETE FROM leraren');
    await client.query('COMMIT');
    console.log('[reset-test-db] Alle tabellen geleegd.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[reset-test-db] Fout tijdens reset:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetTestDb();
