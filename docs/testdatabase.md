# Testdatabase — handleiding

De Reviewer draait de backend altijd tegen een lege test-database,
nooit tegen productie. Dit document beschrijft de eenmalige setup
en de dagelijkse werkwijze.

## Sectie A — Eerste setup (eenmalig, door Martijn)

### A1. Supabase CLI beschikbaar maken

Aanbevolen: gebruik `npx` (geen installatie nodig).

```powershell
npx supabase@latest --version
```

Bij de prompt `Ok to proceed? (y)` typ `y` + Enter. Je ziet een versienummer.

### A2. Inloggen en linken aan productie

```powershell
npx supabase@latest login
npx supabase@latest link --project-ref <REFERENCE_ID>
```

Reference ID: productie-dashboard → tandwiel → Project Settings → General → Reference ID.

### A3. Nieuw test-project aanmaken

Ga naar https://supabase.com/dashboard → New project.
- Name: `toetsapp-test`
- Sla het database-wachtwoord op in je wachtwoordmanager.
- Wacht tot het project klaar is (~1–2 minuten).

## Sectie B — Schema dumpen en importeren

### B1. Schema-only dump van productie

Voer uit in CMD (niet PowerShell — PowerShell onderdrukt foutmeldingen):

```
"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" ^
  --schema-only --schema=public --no-owner --no-privileges ^
  --file=schema.sql ^
  --host=<SESSION_POOLER_HOST> --port=5432 ^
  --username=postgres.<PROJECT_REF> --dbname=postgres
```

Session Pooler-gegevens: productie-dashboard → Project Settings → Database → Connect → tab Session pooler.

Controle: open `schema.sql` en zoek naar `CREATE TABLE` (moet ≥10 keer voorkomen)
en `INSERT INTO` (moet 0 keer voorkomen).

**Waarom schema-dump en niet migrations:** niet alle schema-wijzigingen in
productie zijn via `/migrations` aangebracht. De dump dekt alles.

### B2. Schema importeren in test-project

1. Test-dashboard → SQL Editor → New query.
2. Plak de inhoud van `schema.sql` en klik Run.
3. Controleer in Table Editor: je ziet tabellen als `leraren`, `classes`,
   `lessons`, `mol_sessies`, `schema_migrations` (leeg, 0 rijen).

### B3. exec_sql-functie controleren

```sql
SELECT proname FROM pg_proc WHERE proname = 'exec_sql';
```

Verwacht: één rij. Geen rij? Kopieer de `exec_sql`-definitie uit productie
en voer die uit in het test-project.

### B4. schema_migrations bootstrappen

```sql
INSERT INTO schema_migrations (filename) VALUES
  ('001_initial_schema.sql'),
  ('002_add_lesson_classes.sql'),
  ('003_add_lesson_planning.sql'),
  ('004_mol_groep_fase.sql'),
  ('005_mol_groepen_fase_check.sql'),
  ('006_cleanup_null_leraar_id.sql');
```

Verwacht: 6 rijen. Zonder dit probeert `runMigrations()` alles opnieuw
te draaien tegen een al compleet schema.

### B5. RLS uitschakelen op mol-tabellen (test-project)

> **⚠ UITSLUITEND uitvoeren op het test-project — NOOIT op productie.**

Supabase zet standaard Row Level Security (RLS) aan op alle tabellen. In
het test-project blokkert dit schrijfpogingen via de anon key. Voer de
volgende SQL uit in het test-dashboard → SQL Editor → New query:

```sql
ALTER TABLE mol_sessies          DISABLE ROW LEVEL SECURITY;
ALTER TABLE mol_leerlingen       DISABLE ROW LEVEL SECURITY;
ALTER TABLE mol_groepen          DISABLE ROW LEVEL SECURITY;
ALTER TABLE mol_antwoorden       DISABLE ROW LEVEL SECURITY;
ALTER TABLE mol_cases            DISABLE ROW LEVEL SECURITY;
ALTER TABLE mol_groep_stemmen    DISABLE ROW LEVEL SECURITY;
ALTER TABLE mol_groep_votes      DISABLE ROW LEVEL SECURITY;
ALTER TABLE mol_scores           DISABLE ROW LEVEL SECURITY;
ALTER TABLE mol_briefing_klaar   DISABLE ROW LEVEL SECURITY;
ALTER TABLE mol_test_antwoorden  DISABLE ROW LEVEL SECURITY;
```

Controle: SQL Editor → run `SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'mol_%';`
Verwacht: kolom `rowsecurity` is `false` voor alle 10 rijen.

## Sectie C — .env.test invullen

Kopieer `.env.test.example` naar `.env.test` en vul in:

| Variabele | Bron |
|---|---|
| `SUPABASE_URL` | test-dashboard → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | test-dashboard → Project Settings → API → anon public |
| `DATABASE_URL` | test-dashboard → Project Settings → Database → URI (vul wachtwoord in) |
| `ANTHROPIC_API_KEY` | kopie uit productie-.env |
| `JWT_SECRET` | kopie uit productie-.env |
| `TEACHER_TOKEN` | kopie uit productie-.env |
| `PORT` | `8080` |
| `IS_TEST_DATABASE` | `true` — **NOOIT in productie-.env zetten** |

Controle: `grep '^IS_TEST_DATABASE=true$' .env.test` geeft precies één regel.

**Waarom IS_TEST_DATABASE:** het reset-script weigert te draaien als deze
variabele niet exact de waarde `true` heeft. Zo is het onmogelijk om
per ongeluk productie-data te wissen.

## Sectie D — Reviewer-run

De volledige procedure staat in WORKFLOW.md § Preamble Reviewer.
Samenvatting:

```powershell
# 1. Backup en wissel
cp .env .env.productie-backup
cp .env.test .env

# 2. Reset de test-database
node scripts/reset-test-db.js

# 3. Start de server
npm start
```

Controleer: `curl http://localhost:8080/api/health` geeft `{"status":"ok"}`.

Na de review:

```powershell
cp .env.productie-backup .env
del .env.productie-backup
```

## Sectie E — Bij schema-wijzigingen in productie

Wanneer productie een nieuwe migration of handmatige schema-wijziging krijgt:

1. Herhaal B1 (nieuwe dump van productie).
2. Test-project leegmaken: test-dashboard → SQL Editor →
   `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
3. Herhaal B2, B3, B4 (import + exec_sql + bootstrap).
4. Als je een nieuw test-project hebt gemaakt: herhaal ook C
   (nieuwe URL en keys).
5. Breid de tabellijst in `scripts/reset-test-db.js` uit als de nieuwe
   migration een nieuwe tabel toevoegt.
