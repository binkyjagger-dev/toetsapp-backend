-- Aangemaakt: apr 2026
-- Beschrijving: opruiming van test-sessies met leraar_id=NULL (5 sessies per apr 2026).
--   Verwijdert alle gerelateerde data in kind-naar-ouder volgorde.
--   Idempotent: tweede keer draaien verwijdert 0 rijen.
--   Al handmatig gedraaid via Supabase SQL Editor (apr 2026).
--   BEGIN/COMMIT verwijderd: supabase.rpc('exec_sql') ondersteunt geen transactie-commando's.

DELETE FROM mol_test_antwoorden WHERE sessie_id IN (SELECT id FROM mol_sessies WHERE leraar_id IS NULL);
DELETE FROM mol_groep_stemmen   WHERE sessie_id IN (SELECT id FROM mol_sessies WHERE leraar_id IS NULL);
DELETE FROM mol_antwoorden      WHERE sessie_id IN (SELECT id FROM mol_sessies WHERE leraar_id IS NULL);
DELETE FROM mol_briefing_klaar  WHERE sessie_id IN (SELECT id FROM mol_sessies WHERE leraar_id IS NULL);
DELETE FROM mol_cases           WHERE sessie_id IN (SELECT id FROM mol_sessies WHERE leraar_id IS NULL);
DELETE FROM mol_leerlingen      WHERE sessie_id IN (SELECT id FROM mol_sessies WHERE leraar_id IS NULL);
DELETE FROM mol_groepen         WHERE sessie_id IN (SELECT id FROM mol_sessies WHERE leraar_id IS NULL);
DELETE FROM mol_sessies         WHERE leraar_id IS NULL;

