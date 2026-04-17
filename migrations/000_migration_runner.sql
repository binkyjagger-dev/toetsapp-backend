-- Aangemaakt: begin project
-- Beschrijving: tabel voor bijhouden uitgevoerde migraties.
--   Voer dit EENMALIG uit in Supabase voordat je de server
--   deployt met de migratie-runner.

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    TEXT PRIMARY KEY,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Status: handmatig uit te voeren in Supabase SQL Editor
