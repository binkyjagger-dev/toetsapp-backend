-- Aangemaakt: begin project
-- Beschrijving: initieel schema — leraren, klassen, lessen,
--   resultaten, leerdoelen en leerlingen.

CREATE TABLE IF NOT EXISTS leraren (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  naam            TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  wachtwoord      TEXT NOT NULL,
  aangemaakt_op   BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  email_verified  BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS classes (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at BIGINT,
  niveau     TEXT,
  leerjaar   TEXT,
  leraar_id  UUID REFERENCES leraren(id)
);

CREATE TABLE IF NOT EXISTS lessons (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  content               TEXT,
  created_at            BIGINT,
  chapter_val           TEXT,
  -- Deprecated: vervangen door lesson_classes junction
  --   tabel. Behouden voor backwards compatibiliteit.
  class_id              TEXT REFERENCES classes(id),
  toegestane_lesvormen  JSONB DEFAULT '["socratisch"]',
  lesvorm_mode          TEXT DEFAULT 'locked',
  leraar_id             UUID REFERENCES leraren(id)
);

CREATE TABLE IF NOT EXISTS results (
  id                  TEXT PRIMARY KEY,
  lesson_id           TEXT REFERENCES lessons(id),
  lesson_name         TEXT,
  student_name        TEXT NOT NULL,
  class_id            TEXT,
  class_name          TEXT,
  understanding       TEXT,
  refl_goed           TEXT,
  refl_verbeteren     TEXT,
  messages            JSONB,
  scores              JSONB,
  leerdoel_scores     JSONB,
  timestamp           BIGINT,
  lesvorm             TEXT DEFAULT 'socratisch',
  score_norm          NUMERIC,
  lesvorm_data        JSONB,
  opgaven             JSONB,
  opgaven_antwoorden  JSONB,
  opgaven_feedback    JSONB
);

CREATE TABLE IF NOT EXISTS leerdoelen (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leraar_id   UUID REFERENCES leraren(id),
  niveau      TEXT,
  lesbrief    TEXT,
  hoofdstuk   TEXT,
  type        TEXT,
  lesdoel     TEXT,
  created_at  BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS leerlingen_import (
  id            TEXT PRIMARY KEY,
  leraar_id     UUID REFERENCES leraren(id),
  lesperiode    TEXT,
  stamnummer    TEXT,
  roepnaam      TEXT,
  tussenvoegsel TEXT,
  achternaam    TEXT,
  klas          TEXT,
  studie        TEXT,
  leerjaar      TEXT,
  leerniveau    TEXT
);

-- Status: reeds uitgevoerd in productie
