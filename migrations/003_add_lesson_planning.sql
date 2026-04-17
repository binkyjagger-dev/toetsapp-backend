-- Aangemaakt: apr 2026
-- Beschrijving: datum en feedback per les per klas.
--   Maakt lesplanning en reflectie mogelijk in het klasoverzicht.

ALTER TABLE lesson_classes ADD COLUMN IF NOT EXISTS lesson_date DATE;
ALTER TABLE lesson_classes ADD COLUMN IF NOT EXISTS feedback TEXT;

-- Status: reeds uitgevoerd in productie
