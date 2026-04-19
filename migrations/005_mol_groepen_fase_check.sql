-- Aangemaakt: apr 2026
-- Beschrijving: CHECK constraint op mol_groepen.fase
--   Staat alleen de vijf afgesproken dashboard-fasen toe:
--   briefing, individueel, groep, moltest, reveal.
--   Faalt als er bestaande rijen zijn met een andere waarde.

ALTER TABLE mol_groepen
  DROP CONSTRAINT IF EXISTS mol_groepen_fase_check;

ALTER TABLE mol_groepen
  ADD CONSTRAINT mol_groepen_fase_check
  CHECK (fase IN ('briefing', 'individueel', 'groep', 'moltest', 'reveal'));

-- Status: nog niet uitgevoerd in productie
