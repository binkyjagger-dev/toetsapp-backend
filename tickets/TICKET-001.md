# TICKET-001: Test-database en .env.test opzetten voor Reviewer

**Status:** Ready for Build
**Grootte:** M (3 gebundelde wijzigingen — past binnen één Builder-sessie)
**Aangemaakt door:** Architect
**Datum:** 2026-04-23

## Doel
De Reviewer kan de backend tegen een lege, disposable test-database draaien en tussen reviews resetten, zonder risico dat productie-leerlingdata muteert.

## Scope

### Wel (Builder bouwt)
- `.gitignore` uitbreiden zodat `.env.test` nooit gecommit wordt.
- `.env.test.example` toevoegen — commitable template met placeholders voor alle env-vars die `server.js` leest, plus een extra `IS_TEST_DATABASE=true` marker.
- `scripts/reset-test-db.js` — Node-script dat met `DELETE FROM` alle data leegmaakt, idempotent, met een guard die weigert te draaien als `IS_TEST_DATABASE !== "true"`.
- `tests/reset-test-db.test.js` — statische test (file-bestaat, `node --check`, guard-regel aanwezig, tabellijst in sync met migrations).
- `docs/testdatabase.md` — handleiding met twee secties: (1) handmatige Supabase-setup voor Martijn, (2) runtime-procedure voor de Reviewer (verwijst naar WORKFLOW.md §Preamble Reviewer).

### Niet (uit scope)
- Geen wijzigingen aan `server.js`. De Reviewer ruilt `.env` ↔ `.env.test` conform WORKFLOW.md — geen env-detectielogica in de app nodig.
- Geen seed-data in de test-database (leeg is leeg).
- Geen CI/CD-integratie.
- Geen automatische migrations vanuit het reset-script. De server's bestaande `runMigrations()` doet dat al bij eerste start; `schema_migrations` blijft daarom met rust.
- Geen nieuw `npm run start:test` script (niet nodig bij de ruil-aanpak uit WORKFLOW.md).

## Handmatige stappen (Martijn — vóór Builder start)
Deze stappen kan een agent niet doen; ze moeten klaar zijn voordat Builder zinvol kan werken of voordat de Reviewer iets kan testen.

**Uitgangspunt:** de test-database krijgt een identiek schema aan productie door een schema-only dump van productie te importeren. We draaien dus **niet** de migrations 001–006 in de test-Supabase — migrations blijven voor voorwaartse wijzigingen in productie.

**Wat je nodig hebt voor je begint:**
- [ ] Een terminal open in de repo-root (`.../toetsapp-backend`). Controle: `ls CLAUDE.md package.json` toont beide bestanden.
- [ ] Je bent ingelogd in het Supabase-dashboard (https://supabase.com/dashboard) met het account dat het productie-project beheert.
- [ ] Een teksteditor om `schema.sql` in te openen (VS Code, TextEdit, Notepad — wat je normaal gebruikt).
- [ ] Tijdsinvestering: eenmalig ~30–45 minuten. Bij herhaling (sectie E): ~10 minuten.

Totale doorlooptijd: sectie A en B wisselen tussen terminal en browser. Houd beide naast elkaar open.

---

### Sectie A — Eenmalige voorbereiding (tooling)

#### A1. Supabase CLI beschikbaar maken
Supabase CLI ondersteunt **geen** globale npm-installatie. Kies één van de volgende routes.

**Route 1 — npx (aanbevolen, geen installatie nodig, werkt op elk OS):**
- **Waar:** terminal in de repo-root.
- **Doen:** niks nu. In alle volgende stappen vervang je `supabase <iets>` door `npx supabase@latest <iets>`.
- **Eerste-keer-test:** `npx supabase@latest --version`. Bij de prompt `Ok to proceed? (y)` typ `y` + Enter.
- **Verwacht:** npx downloadt de CLI de eerste keer (~20–30 sec). Daarna toont hij een versienummer.
- **Nadeel:** elk commando is wat langer en duurt 10–20 sec extra.

**Route 2 — Scoop (Windows):**
- **Waar:** PowerShell.
- **Doen (eenmalig Scoop installeren als je die nog niet hebt):**
  ```
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  irm get.scoop.sh | iex
  ```
- **Doen (Supabase CLI installeren):**
  ```
  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
  scoop install supabase
  ```
- **Controle:** `supabase --version` toont een versienummer.

**Route 3 — Homebrew (macOS/Linux):**
- **Doen:** `brew install supabase/tap/supabase`
- **Controle:** `supabase --version` toont een versienummer.

**Als je per ongeluk al `npm install -g supabase` hebt gedraaid en een foutmelding kreeg:** ruim op met `npm uninstall -g supabase`. Blijft de map `C:\Users\<naam>\AppData\Roaming\npm\node_modules\supabase` bestaan? Verwijder hem handmatig via File Explorer.

**Keuze voor de rest van dit ticket:** we gaan ervan uit dat je Route 1 (npx) gebruikt. Voor Route 2/3 laat je `npx ` en `@latest` simpelweg weg uit elk commando.

#### A2. Inloggen op Supabase vanuit de CLI
- **Waar:** zelfde terminal.
- **Doen:** `npx supabase@latest login` (of `supabase login` bij Route 2/3).
- **Verwacht:** er opent automatisch een browsertab op supabase.com met "Authorize CLI". Klik op **Authorize**. In de terminal verschijnt vervolgens `You are now logged in. Happy coding!`.
- **Controle:** `npx supabase@latest projects list` toont een tabel met minstens één project (je productie-project).
- **Bij fout "browser did not open":** de terminal toont dan een URL en een code — kopieer de URL naar je browser, log in, plak de code terug in de terminal.

#### A3. Productie-project-referentie opzoeken
- **Waar:** browser in het **productie**-Supabase-dashboard.
- **Doen:** linker navigatie → tandwiel (**Project Settings**) → **General**. Onder "Reference ID" staat een string van ~20 tekens (voorbeeld-format: `abcdefghijklmnop`).
- **Verwacht:** de Reference ID is zichtbaar onder de project-naam.
- **Controle:** kopieer de Reference ID naar een kladblok — je hebt hem in A4 nodig.
- **Sneller alternatief:** de Reference ID staat ook in de URL van elk productie-dashboard-paginaadres: `https://supabase.com/dashboard/project/<REFERENCE_ID>/...`.

#### A4. CLI linken aan productie-project
- **Waar:** terminal in de repo-root.
- **Doen:** `npx supabase@latest link --project-ref <REFERENCE_ID>` (vervang `<REFERENCE_ID>` door de string uit A3).
- **Verwacht:** CLI vraagt om het **database-wachtwoord** van productie. Vul in. Daarna: `Finished supabase link.`
- **Controle:** in de repo-root is nu een map `supabase/` aangemaakt met een `.temp`-submap. Dat is normaal.
- **`.gitignore` meteen bijwerken:** open `.gitignore` in je editor en voeg toe (tussen `.claudeignore` en `# Build output`):
  ```
  # Supabase CLI metadata (lokaal, niet delen)
  supabase/
  ```
  Deze regel kan door jou of door Builder (in Wijziging 1) worden gecommit — stem af zodat er geen dubbele wijziging komt.
- **Bij fout "password incorrect":** database-wachtwoord reset je via productie-dashboard → Project Settings → Database → **Reset database password**. Let op: dit breekt bestaande verbindingen tot je `.env` aanpast. Alleen doen als je het huidige wachtwoord echt kwijt bent.

---

### Sectie B — Test-Supabase aanmaken en vullen

#### B1. Nieuw Supabase-project aanmaken
- **Waar:** browser → https://supabase.com/dashboard.
- **Doen:** klik rechtsboven **New project** → vul in:
  - Organization: kies dezelfde als productie (tenzij je bewust scheidt).
  - Name: `toetsapp-test`
  - Database password: genereer een nieuw, sterk wachtwoord. **Bewaar dit meteen in je wachtwoordmanager** — zonder dit wachtwoord kun je `DATABASE_URL` niet samenstellen in stap C3.
  - Region: kies dezelfde als productie (kleinere latency, consistent gedrag).
- **Verwacht:** klik **Create new project**. Er volgt een wachtscherm van ~1–2 minuten terwijl Supabase de database provisioneert.
- **Controle:** zodra het dashboard opent en "Setting up project..." verdwijnt, zie je in de linker navigatie items zoals Table Editor en SQL Editor.

#### B2. Schema-only dump van productie maken
Recente Supabase CLI-versies draaien `db dump` altijd via een Docker-container. Als je geen Docker Desktop wil installeren (aanbevolen — overkill voor één dump), gebruik `pg_dump` direct. Dat is lichter (~50 MB) en toekomstvast voor sectie E.

**Eenmalig `pg_dump` beschikbaar maken (Windows):**

1. Check eerst of je het al hebt: `Get-Command pg_dump`. Zo ja → spring naar het dump-commando hieronder.
2. Download PostgreSQL 17 Windows-installer van https://www.enterprisedb.com/downloads/postgres-postgresql-downloads.
3. In de installer bij "Select Components" **alleen** "Command Line Tools" aanvinken. PostgreSQL Server, pgAdmin 4 en Stack Builder uitvinken.
4. Herstart PowerShell na installatie.
5. Controle: `pg_dump --version` → toont `pg_dump (PostgreSQL) 17.x`. Versie 17 matcht productie.
6. **Als `pg_dump` "not recognized" geeft:** de EDB-installer heeft PATH niet bijgewerkt (komt op Windows regelmatig voor). Twee opties:
   - **Snel (eenmalig):** gebruik het volledige pad bij het commando hieronder: `& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" --schema-only ...`
   - **Duurzaam:** Win-toets → "Edit the system environment variables" → Environment Variables → onder User variables: Path → Edit → New → plak `C:\Program Files\PostgreSQL\17\bin` → OK. Herstart PowerShell, daarna werkt `pg_dump` direct.
7. **Als `pg_dump` hangt of zonder output sluit (vooral in PowerShell):** je mist de Visual C++ runtime. Draai `"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" --version` in **CMD** (niet PowerShell) om de echte foutmelding te zien — meestal `VCRUNTIME140.dll was not found`. Fix: download en installeer de Microsoft Visual C++ Redistributable (x64) via https://aka.ms/vs/17/release/vc_redist.x64.exe (~14 MB, geen herstart nodig).
8. **Tip voor Windows-gebruikers:** draai deze stappen liever in **CMD** dan in PowerShell. PowerShell 5.1 onderdrukt soms popup-errors van console-tools, waardoor diagnose onnodig lastig wordt.

**Dump-commando (aanbevolen — via de Session Pooler, werkt op IPv4-netwerken):**

Supabase's directe `db.<ref>.supabase.co:5432` is alleen bereikbaar via IPv6. Veel Nederlandse ISP's leveren geen werkende IPv6, waardoor directe connecties timeout geven. De **Session Pooler** is IPv4-vriendelijk en geschikt voor pg_dump (Transaction Pooler werkt NIET voor pg_dump — die knipt connecties per statement af).

Pooler-gegevens opzoeken: productie-dashboard → Project Settings → Database → "Connect" blok → tab **Session pooler**. Je ziet host (`aws-X-<regio>.pooler.supabase.com`), port (5432), database (`postgres`), user (`postgres.<PROJECT_REF>`).

Dump in **CMD** op Windows (PowerShell 5.1 onderdrukt popup-errors van console-tools):
```
"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" --schema-only --schema=public --no-owner --no-privileges --file=schema.sql --host=aws-X-<REGIO>.pooler.supabase.com --port=5432 --username=postgres.<PROJECT_REF> --dbname=postgres
```
Op macOS/Linux (wanneer `pg_dump` in PATH zit):
```
pg_dump --schema-only --schema=public --no-owner --no-privileges --file=schema.sql --host=aws-X-<REGIO>.pooler.supabase.com --port=5432 --username=postgres.<PROJECT_REF> --dbname=postgres
```

**Waarom `--schema=public`:** zonder deze flag dumpt pg_dump ook de Supabase-interne schema's (`auth`, `storage`, `realtime`, `graphql`, `extensions`, `pgbouncer`, `vault`). Die bestaan al automatisch in elk nieuw Supabase-project en geven bij import error `schema already exists` plus ontbrekende rol-fouten. Alleen `public` importeren is schoon en voldoende — jouw applicatie-tabellen en -functies zitten allemaal in `public`.

- Vervang `<PROJECT_REF>` (uit A3).
- pg_dump vraagt: `Password:` → typ je productie-database-wachtwoord → Enter. Wordt niet echo'd, niet in shell-history.
- Gebruik `--file=schema.sql`, **niet** `> schema.sql` — anders schrijft PowerShell UTF-16, wat de import in B3 breekt.
- `--no-owner --no-privileges` voorkomt verwijzingen naar productie-rollen die in het test-project niet bestaan.

**Bij fout `password authentication failed for user "postgres"`:**
- Wachtwoord fout getypt — probeer opnieuw.
- Of: je gebruikte een URL-vorm (`postgresql://postgres:<pw>@...`) en je wachtwoord bevat speciale tekens (`@`, `:`, `/`, `?`, `#`, `%`, `&`). Gebruik de splitte vorm hierboven.

**Alternatief — via env-var (voor scripting):**
```
set PGPASSWORD=<nieuw_wachtwoord>
"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" --schema-only --no-owner --no-privileges --file=schema.sql --host=db.<PROJECT_REF>.supabase.co --port=5432 --username=postgres --dbname=postgres
set PGPASSWORD=
```
Sluit CMD na afloop (wachtwoord in env-history).

**Alternatieve routes (minder aanbevolen):**
- Docker Desktop installeren → dan werkt `npx supabase@latest db dump --linked -f schema.sql` wél. Maar 4+ GB, WSL2-vereiste, altijd-aan service. Alleen doen als je Docker sowieso wil.
- Oudere Supabase CLI: `npx supabase@1.127.3 db dump --linked -f schema.sql` omzeilt Docker, maar fragiel — kan breken bij volgende Supabase-server-updates.

**Verwacht:** commando draait 5–15 seconden. Er staat nu een bestand `schema.sql` in de repo-root.
- **Controle 1 (Windows PowerShell):** `Get-Item schema.sql | Select-Object Length` toont een grootte > 1000 bytes (waarschijnlijk 20.000–200.000). Op macOS/Linux: `ls -lh schema.sql`.
- **Controle 2 (belangrijk):** open `schema.sql` in je editor en zoek met Ctrl-F (Cmd-F op Mac):
  - `CREATE TABLE` → moet meerdere keren voorkomen (≥ 10). Als nul: dump is mislukt, stop en meld.
  - `INSERT INTO` → moet **nul** keer voorkomen. Als het wel voorkomt: er is per ongeluk data meegedumpt, niet importeren in test, meld het.
- **Bij fout "flag -f not recognized":** jouw CLI-versie gebruikt andere flags. Run `npx supabase@latest db dump --help` en gebruik de flag die een output-bestand specificeert (vaak `--file` of `-f`).

#### B3. Schema importeren in test-project
- **Waar:** browser in het **test**-dashboard (het nieuwe `toetsapp-test`-project dat je in B1 maakte — controleer linksboven dat je de juiste selectie hebt!).
- **Doen:**
  1. Linker navigatie → **SQL Editor**.
  2. Klik **+ New query** (rechtsboven of midden op de pagina).
  3. Open `schema.sql` in je editor, selecteer alles (Ctrl-A / Cmd-A), kopieer (Ctrl-C).
  4. Plak de inhoud in het SQL Editor-venster.
  5. Klik **Run** (of Ctrl-Enter / Cmd-Enter).
- **Verwacht:** onderin verschijnt "Success. No rows returned" of een rij-aantal. Duurt 2–10 seconden.
- **Controle:** linker navigatie → **Table Editor**. Je moet minstens de volgende tabellen zien: `leraren`, `classes`, `lessons`, `results`, `leerlingen`, `leerdoelen`, `lesson_classes`, en verschillende tabellen die beginnen met `mol_`. Ook `schema_migrations` moet er zijn (leeg, 0 rijen).
- **Bij fout "relation already exists":** je hebt dit schema al eens eerder geïmporteerd. Veilig om te negeren als alle tabellen er staan. Als je twijfelt: verwijder het test-project via Project Settings → General → **Delete project** en begin opnieuw bij B1.
- **Bij fout "permission denied for schema auth" (of vergelijkbaar):** de dump bevat Supabase-interne schema's die je in een nieuw project niet nodig hebt. Zoek in `schema.sql` naar regels met `auth.` of `storage.` en verwijder die blokken tijdelijk, plak de rest. Meld het bij Architect — dan updaten we de documentatie.

#### B4. Controleer dat `exec_sql`-RPC-functie aanwezig is
- **Waar:** browser in test-dashboard → SQL Editor → + New query.
- **Doen:** voer uit:
  ```sql
  SELECT proname FROM pg_proc WHERE proname = 'exec_sql';
  ```
- **Verwacht:** één rij met `proname = exec_sql`.
- **Als er nul rijen zijn:** de dump heeft de functie niet meegenomen. Ga naar het **productie**-dashboard → SQL Editor → **Templates** of **History** → zoek de query die `exec_sql` aanmaakt (begint met `CREATE OR REPLACE FUNCTION exec_sql(...)`). Kopieer die query, plak in **test**-SQL-Editor, klik Run. Herhaal deze controle.
- **Waarom dit belangrijk is:** zonder `exec_sql` faalt `runMigrations()` in `server.js` bij de eerste server-start.

#### B5. `schema_migrations`-tabel bootstrappen
- **Waar:** browser in test-dashboard → SQL Editor → + New query.
- **Doen:** voer uit:
  ```sql
  INSERT INTO schema_migrations (filename) VALUES
    ('001_initial_schema.sql'),
    ('002_add_lesson_classes.sql'),
    ('003_add_lesson_planning.sql'),
    ('004_mol_groep_fase.sql'),
    ('005_mol_groepen_fase_check.sql'),
    ('006_cleanup_null_leraar_id.sql');
  ```
- **Verwacht:** "Success. 6 rows affected."
- **Controle:** voer uit `SELECT * FROM schema_migrations;` → toont precies 6 regels met bovenstaande filenames.
- **Waarom dit belangrijk is:** als deze tabel leeg is, probeert `runMigrations()` alle migrations opnieuw te draaien tegen een al compleet schema. Dat faalt (tabellen bestaan al) of levert conflicterende wijzigingen op.

---

### Sectie C — Keys en `.env.test` invullen

#### C1. API-keys van het test-project kopiëren
- **Waar:** browser in test-dashboard → **Project Settings** (tandwiel) → **API**.
- **Doen:** kopieer twee waardes:
  - **Project URL** (format: `https://<project-ref>.supabase.co`)
  - **anon public** key (de onderste van de twee keys; lange string beginnend met `sb_` of `eyJ...`)
- **Let op:** de key-naamgeving in Supabase wisselt soms (`anon` vs `sb_secret`). Kies de key die overeenkomt met wat er in productie-`.env` staat voor `SUPABASE_ANON_KEY` qua format.
- **Niet de `service_role`-key gebruiken** — die heeft admin-rechten en is onnodig voor de test-opstelling.

#### C2. Database-connection-string van het test-project kopiëren
- **Waar:** browser in test-dashboard → **Project Settings** → **Database** → **Connection string** → tab **URI**.
- **Doen:** klik "Copy" naast de URI. Format: `postgresql://postgres:[YOUR-PASSWORD]@db.<project-ref>.supabase.co:5432/postgres`.
- **Belangrijk:** vervang `[YOUR-PASSWORD]` in de gekopieerde string door het wachtwoord dat je in B1 hebt opgeslagen. Zonder wachtwoord werkt de connection string niet.
- **Controle:** de string mag **geen** `[YOUR-PASSWORD]` meer bevatten nadat je hem in `.env.test` hebt gezet.

#### C3. `.env.test` lokaal aanmaken
- **Waar:** repo-root, in je editor.
- **Voorwaarde:** `.env.test.example` bestaat. Die levert Builder in Wijziging 1. Als je dit ticket start terwijl Builder nog niet heeft geleverd: sla sectie C over tot Builder klaar is. Sectie A en B kun je wel alvast doen.
- **Doen:**
  1. Kopieer `.env.test.example` naar `.env.test`: `cp .env.test.example .env.test`
  2. Open `.env.test` in je editor en vul in:

     | Variabele | Waarde |
     |---|---|
     | `SUPABASE_URL` | Project URL uit C1 |
     | `SUPABASE_ANON_KEY` | anon public key uit C1 |
     | `DATABASE_URL` | connection string uit C2 (mét wachtwoord) |
     | `ANTHROPIC_API_KEY` | kopie uit productie-`.env`, óf een test-variant als je die hebt |
     | `JWT_SECRET` | kopie uit productie-`.env`, óf een willekeurige string van ≥32 tekens |
     | `TEACHER_TOKEN` | kopie uit productie-`.env`, óf een willekeurige string |
     | `PORT` | `8080` |
     | `IS_TEST_DATABASE` | `true` — **moet letterlijk deze waarde zijn** |
- **Controle 1:** `cat .env.test | grep -c '='` geeft `8` (precies 8 gevulde regels).
- **Controle 2:** `grep '^SUPABASE_URL=' .env.test` toont een URL die **niet** gelijk is aan de productie-`SUPABASE_URL` in `.env`. Als ze gelijk zijn: C1 is op het verkeerde dashboard gedaan, begin C1 opnieuw.
- **Controle 3:** `grep '^IS_TEST_DATABASE=true$' .env.test` geeft één regel terug. Exacte match is noodzakelijk — "True" of "TRUE" werkt niet.

---

### Sectie D — Veiligheidscontroles

#### D1. `.env.test` is niet in git
- **Doen:** `git status` en `git check-ignore .env.test`
- **Verwacht:** `git status` toont `.env.test` **niet** als untracked file. `git check-ignore` geeft exit 0 en print `.env.test`.
- **Bij fout:** Builder's `.gitignore`-wijziging uit Wijziging 1 is niet (correct) opgeleverd. Meld terug aan Reviewer of Architect.

#### D2. `IS_TEST_DATABASE` staat niet in productie-`.env`
- **Doen:** `grep IS_TEST_DATABASE .env`
- **Verwacht:** geen output (exit 1). Als er wel output is: verwijder die regel uit productie-`.env` onmiddellijk. De productie-guard in `reset-test-db.js` werkt op de afwezigheid van deze variabele in productie — staat hij er wel, dan is de guard kapot.

#### D3. `schema.sql` is niet per ongeluk gecommit
- **Doen:** `git status schema.sql`
- **Verwacht:** óf "untracked" (dan handmatig verwijderen of aan `.gitignore` toevoegen), óf "ignored". Niet "new file" in staging.
- **Aanbeveling:** voeg `schema.sql` toe aan `.gitignore` of verwijder het lokaal (`rm schema.sql`) zodra de import in B3 geslaagd is. Het bestand bevat geen secrets, maar hoort niet in git.

---

### Sectie E — Herhaling bij schema-wijzigingen in productie

Wanneer productie een schema-wijziging krijgt (nieuwe migration of handmatige wijziging in productie-SQL-Editor), raakt de test-database out of sync. Om weer in sync te komen:

1. **Herdump productie:** herhaal B2 (`supabase db dump -f schema.sql`).
2. **Test-project leegmaken:** twee opties:
   - Soft: test-dashboard → SQL Editor → `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` (verwijdert alle tabellen in `public` — alleen doen als je zeker weet dat je in het test-project zit!).
   - Hard: test-dashboard → Project Settings → General → **Delete project**. Maak een nieuw project en begin bij B1.
3. **Importeren:** herhaal B3, B4, B5.
4. **`.env.test` controleren:** als je een nieuw test-project hebt gemaakt, herhaal C1 en C2 (URL + keys veranderen). Anders ongewijzigd.

Deze herhaal-procedure staat ook in `docs/testdatabase.md` (opgeleverd in Builder-wijziging 3).

## Agent-stappen (Builder bouwt — 3 wijzigingen)

**Wijziging 1 — .gitignore + .env.test.example (XS, ~12 regels)**
- Voeg `.env.test` en `.env.test.local` toe aan `.gitignore`.
- Maak `.env.test.example` met 8 env-vars: de 7 uit `.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `JWT_SECRET`, `TEACHER_TOKEN`, `PORT`) plus `IS_TEST_DATABASE=true`. Alle met dummy-placeholders (`# vul in`) behalve `IS_TEST_DATABASE`, die staat letterlijk op `true`. Korte comment-regel bovenaan: "LET OP: IS_TEST_DATABASE hoort ALLEEN in .env.test, nooit in productie-.env."

**Wijziging 2 — reset-test-db.js + test (TDD, ~40-50 regels script)**
- Test eerst (rood): `tests/reset-test-db.test.js` faalt omdat script ontbreekt.
- Script leest `.env.test` expliciet via `dotenv.config({ path: '.env.test' })`.
- **Productie-guard:** als `process.env.IS_TEST_DATABASE !== "true"` → `console.error('[reset-test-db] IS_TEST_DATABASE is niet "true" — weigeren te draaien (productie-bescherming).')` + `process.exit(1)`.
- Gebruik **`pg.Client`** (al in dependencies) met `DATABASE_URL`, niet de Supabase JS-client — die vereist een WHERE-clause bij `.delete()`, wat we willen vermijden.
- Eén transactie met `SET CONSTRAINTS ALL DEFERRED` + `DELETE FROM` per tabel. `schema_migrations` wordt overgeslagen.
- Idempotentie volgt automatisch uit `DELETE FROM` op lege tabel.
- Test bevat: file-bestaat, `node --check`, regex-check op de `IS_TEST_DATABASE`-guard, en een lijst-in-sync-check tussen de DELETE-statements in het script en de `CREATE TABLE`-namen in de migrations.

**Wijziging 3 — docs/testdatabase.md (S, pure documentatie, ~70 regels)**
- Sectie A: **Eerste setup** — Supabase CLI installeren, login/link, test-project aanmaken. Concreet met commando's.
- Sectie B: **Schema dumpen en importeren** — `supabase db dump -f schema.sql`, sanity-check op inhoud, plakken in test-SQL-Editor, verificatie van `exec_sql`, bootstrap van `schema_migrations`. Uitleggen waarom deze stappen in deze volgorde nodig zijn, zodat Martijn het bij een toekomstige schema-wijziging zelf kan herhalen.
- Sectie C: **`.env.test` invullen** — welke 8 vars, waar ze vandaan komen, expliciete waarschuwing dat `IS_TEST_DATABASE` niet in productie mag.
- Sectie D: **Reviewer-run** (`cp .env .env.backup && cp .env.test .env && node scripts/reset-test-db.js && npm start`, plus herstel). Verwijzing naar WORKFLOW.md §Preamble Reviewer voor de volledige review-procedure.
- Sectie E: **Bij schema-wijzigingen in productie** — korte herhaal-checklist (stap 4–7 uit dit ticket) zodat test-DB in sync blijft.

## Acceptatiecriteria

Elke regel is verifieerbaar door de Reviewer, zonder oordeel.

1. [ ] `.gitignore` sluit `.env.test` uit — `git check-ignore .env.test` geeft exit 0 en print `.env.test`.
2. [ ] `.env.test.example` bestaat in repo-root en bevat precies 8 env-var-namen: de 7 uit productie-`.env` plus `IS_TEST_DATABASE=true`. Geen echte secrets.
3. [ ] `node --check scripts/reset-test-db.js` slaagt (exit 0).
4. [ ] `node scripts/reset-test-db.js` faalt hard (exit ≠ 0) als `IS_TEST_DATABASE` niet de waarde `"true"` heeft — te testen door in `.env.test` tijdelijk `IS_TEST_DATABASE=false` te zetten (of de regel te verwijderen). Foutmelding op stderr verwijst naar de productie-bescherming.
5. [ ] `node scripts/reset-test-db.js` slaagt (exit 0) met een geldige `.env.test` die naar de test-Supabase wijst en `IS_TEST_DATABASE=true` heeft, óók als alle tabellen al leeg zijn (idempotentie).
6. [ ] Na het script zijn de volgende tabellen leeg: `leraren`, `classes`, `lessons`, `results`, `leerlingen`, `leerdoelen`, `lesson_classes`, en alle `mol_*`-tabellen uit migrations 004–006. `schema_migrations` is ongewijzigd.
7. [ ] Nieuwe test `tests/reset-test-db.test.js` is groen zonder database-verbinding nodig (puur statisch).
8. [ ] `npm test` is volledig groen (inclusief `lint:html`).
9. [ ] Met `.env.test` actief als `.env` (conform WORKFLOW.md-procedure) start de server en geeft `GET /api/health` een 200 met `{status:"ok"}`.
10. [ ] `docs/testdatabase.md` bestaat en bevat zowel de Supabase-setupstappen (incl. waarschuwing over `IS_TEST_DATABASE`) als de Reviewer-run-procedure.

## Bestanden die geraakt worden
- `.gitignore` — 1–2 regels toegevoegd onder `# Environment variables`
- `.env.test.example` — nieuw, ~12 regels (8 env-vars + comment)
- `scripts/reset-test-db.js` — nieuw, geschat 40–50 regels
- `tests/reset-test-db.test.js` — nieuw, geschat 30–40 regels
- `docs/testdatabase.md` — nieuw, ~40 regels

Server.js wordt niet aangepast.

## Tests
- Nieuw: `tests/reset-test-db.test.js` — statische checks (zie AC-7). Moet in elk geval de `IS_TEST_DATABASE`-guard-regel verifiëren via regex op de script-inhoud, zodat toekomstige refactors de guard niet stilletjes kunnen slopen.
- Bestaand: `tests/migrations.test.js` moet groen blijven; er wordt niets aan migrations of `runMigrations()` gewijzigd.
- Edge case: tabellijst-in-sync-check valt om zodra een toekomstige migration een nieuwe tabel toevoegt zonder dat het reset-script wordt bijgewerkt — bedoeld als vangnet.

## Mockup
N/A — pure backend-/tooling-wijziging.

## Verificatie door Reviewer (per acceptatiecriterium)

| AC | Soort check | Commando / API-call | Verwacht |
|---|---|---|---|
| 1 | shell | `git check-ignore .env.test; echo $?` | exit 0 + `.env.test` op stdout |
| 2 | file | `cat .env.test.example` | 8 regels `KEY=<placeholder>` incl. `IS_TEST_DATABASE=true`, geen productie-secret |
| 3 | shell | `node --check scripts/reset-test-db.js; echo $?` | exit 0 |
| 4 | shell | Zet tijdelijk `IS_TEST_DATABASE=false` in `.env.test`, run `node scripts/reset-test-db.js; echo $?` | exit ≠ 0 + guard-foutmelding op stderr |
| 5 | shell | Met correcte `.env.test` (`IS_TEST_DATABASE=true`): `node scripts/reset-test-db.js && node scripts/reset-test-db.js; echo $?` | beide keren exit 0 |
| 6 | API | Na reset: `curl http://localhost:8080/api/leerlingen` (en vergelijkbaar voor `/api/klassen`, `/api/lessons`) met server op `.env.test` | `[]` of 200 met lege lijst |
| 7 | shell | `npx jest tests/reset-test-db.test.js` | exit 0, alle tests groen |
| 8 | shell | `npm test` | exit 0 |
| 9 | API | `cp .env .env.backup && cp .env.test .env && npm start &` + `curl http://localhost:8080/api/health` | 200, `{status:"ok"}` |
| 10 | file | `ls docs/testdatabase.md && head -80 docs/testdatabase.md` | bestand aanwezig, secties A t/m E zichtbaar, `IS_TEST_DATABASE`-waarschuwing in sectie C, dump/import-procedure in sectie B |

## Technische notities
- **Waarom een `IS_TEST_DATABASE`-env-var en geen hostname-check:** voorkomt dat de productie-Supabase-subdomein in de commit-history terechtkomt. De guard werkt op een positieve marker die alleen in test-omgevingen staat — "afwezig = productie" is veiliger dan "matcht patroon = productie".
- **Waarom schema-dump i.p.v. migrations draaien op test:** niet alle schema-wijzigingen in productie zijn via `/migrations` aangebracht. Migrations-only zou de test-DB níet identiek aan productie maken. Dump-en-import is een eenmalige actie per sync-moment en dekt álle schema-wijzigingen.
- **Waarom Supabase CLI voor de dump:** gebruikt intern de juiste pg_dump-versie (geen versie-mismatch met Supabase's Postgres). Installatie via `npm install -g supabase` past bij onze Node.js-stack. Eén commando, schema-only default. `pg_dump` direct werkt ook, maar vereist dat Martijn de juiste postgresql-client-versie zelf installeert en onderhoudt.
- **Bekend risico: tabellijst in reset-script is afgeleid van `/migrations`.** Omdat productie tabellen kan bevatten die niet in migrations staan (reden dat we nu dumpen), kan het reset-script die "ghost tabellen" niet leegmaken. Drie opties voor de toekomst, bewust buiten scope van dit ticket gehouden om AC's en Builder-werk ongewijzigd te laten: (a) handmatig de DELETE-lijst in `scripts/reset-test-db.js` uitbreiden na een schema-dump; (b) vervolgticket om de ontbrekende tabellen alsnog als migrations toe te voegen zodat migrations weer "single source of truth" zijn; (c) vervolgticket om het reset-script de tabellijst dynamisch uit `information_schema.tables` te laten lezen. Optie (b) is het meest in lijn met Simon Willison-principes en heeft de voorkeur als vervolgwerk.
- **Waarom `schema_migrations` handmatig vullen na dump:** de schema-dump bevat de tabel-structuur van `schema_migrations`, maar niet de data (6 regels die aangeven welke migrations al zijn gedraaid in productie). Zonder die data probeert `runMigrations()` op de test-DB alle migrations opnieuw te draaien — die falen of zijn redundant. Handmatige INSERT in stap 7 lost dit op.
- **Waarom `pg.Client` en niet Supabase JS-client voor de reset:** de Supabase JS-client blokkeert `DELETE` zonder WHERE. `pg` is al in `dependencies` en geeft directe SQL-controle. Geen nieuwe dependency.
- **Waarom geen `TRUNCATE`:** `TRUNCATE` negeert FK-checks op een manier die cascade-gedrag anders maakt dan `DELETE`; Martijn heeft expliciet `DELETE FROM` gevraagd als veiliger bij FK's.
- **Waarom `schema_migrations` ongemoeid blijven in het reset-script:** anders zou een reset ook de migratie-status wissen, waarna `runMigrations()` alles opnieuw draait — onnodig traag en potentieel foutgevoelig bij idempotency-gaten in oudere migrations.
- **Waarom geen wijziging aan `server.js`:** de ruil-procedure in WORKFLOW.md (regels 157–188) maakt app-code-wijzigingen overbodig. Past bij "klein, expliciet" uit Simon Willison.

## Architect self-check
- [x] Klein genoeg? Ja — 3 wijzigingen, grootste is ~50 regels (het script zelf), geen wijziging aan `server.js`.
- [x] Eén probleem? Ja — testdatabase beschikbaar maken voor Reviewer. Alles daaronder hangt daaraan.
- [x] Acceptatiecriteria testbaar zonder menselijk oordeel? Ja — elke AC is een concreet shell- of API-commando.
- [x] Raakt dit server.js? Nee.
