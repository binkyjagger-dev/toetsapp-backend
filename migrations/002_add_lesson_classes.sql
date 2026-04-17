-- Aangemaakt: apr 2026
-- Beschrijving: junction tabel voor lessen gekoppeld aan
--   meerdere klassen. Vervangt lessons.class_id (enkelvoud).

CREATE TABLE IF NOT EXISTS lesson_classes (
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  class_id  TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (lesson_id, class_id)
);

-- Status: reeds uitgevoerd in productie
