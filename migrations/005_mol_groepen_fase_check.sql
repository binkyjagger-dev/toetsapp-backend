-- Aangemaakt: apr 2026
-- Gewijzigd: apr 2026 (MOL-01) — fase-waarden afgestemd op bepaalGroepStatus()
-- Beschrijving: CHECK constraint op mol_groepen.fase
--   Staat de fasen toe die bepaalGroepStatus() daadwerkelijk retourneert:
--   briefing, invoer, discussie, resultaat, test, reveal.

ALTER TABLE mol_groepen
  DROP CONSTRAINT IF EXISTS mol_groepen_fase_check;

ALTER TABLE mol_groepen
  ADD CONSTRAINT mol_groepen_fase_check
  CHECK (fase IN ('briefing', 'invoer', 'discussie', 'resultaat', 'test', 'reveal'));

-- Status: nog niet uitgevoerd in productie
