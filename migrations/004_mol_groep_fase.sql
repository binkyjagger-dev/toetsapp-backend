-- Aangemaakt: apr 2026
-- Beschrijving: per-groep fase-tracking voor onafhankelijke
--   groepsflow in Wie is de Mol

ALTER TABLE mol_groepen
  ADD COLUMN IF NOT EXISTS fase TEXT DEFAULT 'briefing',
  ADD COLUMN IF NOT EXISTS ronde_nr INT DEFAULT 1;

-- Status: nog niet uitgevoerd in productie
