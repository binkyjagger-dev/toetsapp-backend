# Wie is de Mol — Technische Architectuuranalyse
**Stanislascollege Leerplatform · Epic Analyse**  
**Versie:** april 2026 · Architect-sessie  
**Gebaseerd op:** codebase-scan (server.js, mol-js/*, mol-lesvorm.html, migrations), mol-leerlingflow.html

---

## Leeswijzer

Dit document bevat vier deliverables:

1. **Technische architectuurbeschrijving** — endpoints, schema, fase-machine, polling, auth
2. **Opgesplitste bouwblokken** — geordende lijst met scope, afhankelijkheden, complexiteit
3. **Onduidelijkheden + beslissingen** — vragen voor de product owner vóór de bouwfase
4. **Risicolog** — technische risico's met kans, impact en mitigatie

---

## Deliverable 1 — Technische architectuurbeschrijving

### 1.1 Wat is er al en wat ontbreekt

#### Bestaande backend-endpoints (server.js)

| Endpoint | Methode | Auth | Status | Opmerking |
|---|---|---|---|---|
| `/api/mol/sessie` (oud) | POST | optional | Gebouwd | Legacy route, wordt niet meer actief gebruikt |
| `/api/mol/sessies` | POST | verifyToken | Gebouwd | Nieuwe route voor sessie aanmaken |
| `/api/mol/sessies` | GET | verifyToken | Gebouwd | Lijst van sessies voor docent |
| `/api/mol/sessies/:id/login` | POST | geen | Gebouwd | Speler inloggen via sessiecode + spelcode |
| `/api/mol/sessies/:id/groep-status` | GET | **verifyToken** | **Bug** | Spelers roepen dit aan zonder JWT → altijd 401 |
| `/api/mol/sessies/:id/dashboard` | GET | verifyToken | Gebouwd | Dashboard data docent |
| `/api/mol/sessies/:id/status` | PATCH | verifyToken | Gebouwd | Sessie stoppen |
| `/api/mol/sessies/:id/briefing-start` | POST | geen | Gebouwd | Stem + briefing-klaar registreren |
| `/api/mol/sessies/:id/bepaal-groepshoofd` | POST | geen | Gebouwd | Groepshoofd berekenen na stemming |
| `/api/mol/sessies/:id/antwoord` | POST | geen | Gebouwd | Individueel antwoord indienen |
| `/api/mol/sessies/:id/discussie-data` | GET | **verifyToken** | **Bug** | Spelers roepen dit aan zonder JWT → altijd 401 |
| `/api/mol/sessies/:id/groepsantwoord` | POST | geen | Gebouwd | Groepshoofd dient groepsantwoord in |
| `/api/mol/sessies/:id/test` | POST | geen | Gebouwd | Mol-test indienen (slaat `verdachte_id` op) |
| `/api/mol/sessies/:id/resultaten` | GET | verifyToken | Gebouwd | Eindstand per groep |
| `/api/mol/sessies/:id/ronde-feedback` | GET | geen | Gebouwd | Feedback na ronde |
| `/api/mol/sessies/:id/genereer-spelcodes` | POST | verifyToken | **Bug** | Wordt aangeroepen vóórdat token gecontroleerd is |
| `/api/mol/sessie/:id` | GET | geen | Gebouwd (oud) | Volledige sessie-state, door speler.js gebruikt |
| `/api/mol/heartbeat` | POST | geen | Gebouwd | Online-status bijhouden |
| `/api/mol/groepshoofd-stem` | POST | geen | Gebouwd | Stem op groepshoofd |
| `/api/mol/bereken-scores` | POST | geen | Gebouwd | Score-berekening |

**Ontbrekende endpoints** (niet in server.js aangetroffen):

| Endpoint | Reden nodig | Prioriteit |
|---|---|---|
| `GET /api/mol/sessies/:id/groep-status` (zonder verifyToken, of met speler-token) | Spelers pollen dit elke 4 seconden | **Blokkerend** |
| `GET /api/mol/sessies/:id/discussie-data` (zonder verifyToken) | Spelers roepen dit aan in discussiefase | **Blokkerend** |

---

### 1.2 Gesignaleerde bugs in de bestaande code

Dit zijn geen scope-uitbreidingen, maar actieve defecten die de epic blokkeren.

#### Bug 1 — Spelcodes verschijnen niet op scherm
**Locatie:** `mol-js/docent-sessie.js::genereerSpelcodesEnToon()`  
**Oorzaak:** Het endpoint `POST /api/mol/sessies/:id/genereer-spelcodes` vereist `verifyToken`. De `apiFetch`-functie in `mol-js/api.js` stuurt de `Authorization`-header ALLEEN mee als `docentToken && docentToken !== 'leraar123'`. Als de docent de pagina opent zonder JWT in de URL (`?leraar=...`), valt `docentToken` terug op de hardcoded string `'leraar123'`. De auth-header wordt dan weggelaten, het endpoint geeft 401 terug, de `catch`-blok toont een toast, en `groepenEl.innerHTML` wordt nooit gevuld.  
**Fix-richting:** De `genereer-spelcodes` route beveiligen via `docentCode` in de body (analoog aan andere niet-JWT routes), of `verifyToken` vervangen door `optionalToken` met fallback-check op `docentCode`.

#### Bug 2 — Speler-polling faalt op groep-status en discussie-data
**Locatie:** `mol-js/speler.js::pollSpelerStatus()` en `renderDiscussiescherm()`  
**Oorzaak:** `GET /api/mol/sessies/:id/groep-status` en `GET /api/mol/sessies/:id/discussie-data` zijn beveiligd met `verifyToken`. Spelers hebben geen JWT-token. De `apiFetch`-aanroep stuurt geen Authorization-header → server antwoordt 401. De `catch` in `pollSpelerStatus` doet `return` (stille fout), de speler blijft hangen op het wacht-scherm.  
**Fix-richting:** Beide endpoints aanpassen naar `geen auth` of een speler-token introduceren (zie sectie 1.6).

#### Bug 3 — Reveal toont altijd "niet geraden"
**Locatie:** `mol-js/reveal.js::renderSpelerReveal()` regel 3  
**Oorzaak:** `reveal.js` zoekt `a.mol_verdachte_id` in `testAntwoorden`. Maar `POST /api/mol/sessies/:id/test` (de nieuwe route die `speler.js::submitTest()` aanroept) slaat het veld op als `verdachte_id` (zonder `mol_`-prefix). Hierdoor is `heeftGeraden` altijd `undefined` (falsy). Elke speler ziet "Jij had de Mol niet geraden", ongeacht of ze goed geraden hebben.  
**Fix-richting:** `reveal.js` aanpassen: `a.mol_verdachte_id || a.verdachte_id` gebruiken.

#### Bug 4 — Scherm 4 (groepshoofd bekendmaking) wordt nooit getoond
**Locatie:** `mol-js/speler.js::pollSpelerStatus()`  
**Oorzaak:** Het HTML-scherm `screen-speler-groepshoofd-bekendmaking` bestaat in `mol-lesvorm.html`, maar `pollSpelerStatus` bevat geen branch die naar dit scherm navigeert. Na de briefing-fase gaat de code direct naar de invoer-fase van ronde 1. De 10-seconden countdown met groepshoofd-bekendmaking wordt nooit getoond.  
**Fix-richting:** Een tussentijdse fase toevoegen (bijv. `bekendmaking`) die het scherm 10 seconden toont alvorens naar `invoer` over te gaan.

#### Bug 5 — Scherm 8 (groepsantwoord bevestiging) wordt niet getoond
**Locatie:** `mol-js/speler.js::renderDiscussiescherm()` en `pollSpelerStatus`  
**Oorzaak:** Na het indienen van het groepsantwoord door het groepshoofd, navigeert `submitGroepsantwoord()` niet naar `screen-speler-groepsantwoord`. De spec vereist een 10-seconden countdown-scherm. Wel bestaat er logica voor `resultaat_5sec` in `renderSpelerRonde()`, maar die toont 5 seconden (niet 10), en wordt alleen gerenderd als `faseSrv === 'resultaat_5sec'` — wat een server-side ronde_fase is, niet een speler-side scherm. De gewone speler ziet helemaal geen bevestiging.  
**Fix-richting:** Na `submitGroepsantwoord()` direct `showScreen('screen-speler-groepsantwoord')` aanroepen en na 10 seconden de poll laten de overgang naar feedback afhandelen.

#### Bug 6 — Twee conflicterende fase-systemen
**Locatie:** `bepaalGroepStatus()` in server.js vs. `mol_groepen.fase` tabel  
**Oorzaak:** Er bestaan twee parallelle manieren om de fase bij te houden:
- **Systeem A:** `mol_sessies.status` + `mol_sessies.ronde_fase` — dit is wat `bepaalGroepStatus()` gebruikt
- **Systeem B:** `mol_groepen.fase` + `mol_groepen.ronde_nr` — toegevoegd via migratie 004, maar nergens bijgewerkt in de code

`bepaalGroepStatus()` leest nooit `mol_groepen.fase`. De dashboard-endpoint leest wél `mol_groepen.fase`, maar die is altijd `'briefing'` (de default) omdat hij nooit wordt bijgewerkt. Het dashboard toont daardoor altijd "Briefing" voor elke groep, ongeacht de werkelijke fase.

**Additioneel:** De CHECK constraint in migratie 005 staat fase-waarden toe (`individueel`, `groep`, `moltest`) die niet overeenkomen met de waarden die `bepaalGroepStatus()` retourneert (`invoer`, `discussie`, `resultaat`, `test`). Als de code ooit `mol_groepen.fase` gaat bijwerken, zou de constraint inserts blokkeren.

#### Bug 7 — Mol-test: veld-mismatch tussen indienen en reveal
**Locatie:** `mol-js/speler.js::submitTest()` vs. oud `POST /api/mol/test-antwoord`  
**Oorzaak:** Er bestaan twee endpoints voor de Mol-test:
- **Oud:** `POST /api/mol/test-antwoord` → slaat `mol_verdachte_id` op
- **Nieuw:** `POST /api/mol/sessies/:id/test` → slaat `verdachte_id` op

`speler.js` gebruikt het nieuwe endpoint. `bereken-scores` en de oud-pad resultaten-endpoint gebruiken `mol_verdachte_id`. Scores worden daardoor niet correct berekend voor sessies die het nieuwe endpoint gebruiken.

---

### 1.3 Ontbrekende frontend-functies

| Scherm | Scherm-ID | Ontbrekende functie | Bestand |
|---|---|---|---|
| 4 — Groepshoofd bekendmaking | `screen-speler-groepshoofd-bekendmaking` | Geen render-functie of navigatie | `speler.js` |
| 8 — Groepsantwoord bevestiging | `screen-speler-groepsantwoord` | Geen render-functie, geen navigatie na submit | `speler.js` |
| 9 — Individuele feedback (navigatie) | `screen-speler-feedback` | `naarVolgendeRondeOfTest()` is een stub (no-op) | `speler.js` |
| 11 — Wacht op Mol-test | `screen-speler-wacht-test` | Geen render-functie; wacht-scherm na test niet getoond | `speler.js` |
| Docent-dashboard: groep-fase | `screen-docent-dashboard` | Groepsstatus toont altijd 'Briefing' (zie bug 6) | `docent-sessie.js` |

---

### 1.4 Database-schema

#### Bestaande tabellen (productie)

```
mol_sessies
  id, les_id, les_naam, les_content, leraar_id,
  n_rondes, groep_grootte, status, sessie_code, docent_code,
  huidige_ronde, ronde_fase, fase_gestart_op, klas_id, klas_naam,
  timer_discussie, timer_stem, created_at

mol_leerlingen
  id, sessie_id, naam, groep_id, groep_naam,
  is_mol, speler_code, online_at,
  groepshoofd_stem, is_groepshoofd

mol_groepen
  id, sessie_id, naam,
  fase (DEFAULT 'briefing'),   ← nooit bijgewerkt
  ronde_nr (DEFAULT 1)          ← nooit bijgewerkt

mol_cases
  id, sessie_id, ronde_nr, vraag, mc_opties (JSONB),
  correct_uitleg, fout_uitleg, vraagtype, context

mol_antwoorden
  id, sessie_id, leerling_id, ronde_nr,
  antwoord, argument, mc_optie_id, submitted_at

mol_groep_stemmen
  id, sessie_id, groep_id, ronde_nr,
  gekozen_leerling_id, gekozen_argument, is_correct,
  punten, max_punten, submitted_at

mol_test_antwoorden
  id, sessie_id, leerling_id,
  verdachte_id,        ← nieuw endpoint
  mol_verdachte_id,    ← oud endpoint
  mol_ronde, mol_argument, submitted_at

mol_briefing_klaar
  id, sessie_id, leerling_id, klaar_op

mol_scores
  id, sessie_id, leerling_id, totaal, ...

mol_groep_votes (aanwezig in sessie/:id query)
  id, sessie_id, groep_id, ronde_nr, ...
```

#### Ontbrekende kolommen / migraties

| Tabel | Wijziging | Reden |
|---|---|---|
| `mol_test_antwoorden` | Kolom `verdachte_id` uniform maken — ofwel migreer `mol_verdachte_id` → `verdachte_id`, ofwel andersom | Veld-mismatch bug 3 + bug 7 |
| `mol_groepen` | CHECK constraint aanpassen: fasen moeten overeenkomen met code-waarden | Migratie 005 blokkeert toekomstige updates |
| `mol_groepen` | Of het systeem B (per-groep fase) verwijderen en alles via systeem A (sessie-level) laten lopen | Bug 6 |

---

### 1.5 Fase-machine

De fase-machine draait volledig server-side in `bepaalGroepStatus()`. De **primaire waarheidsbron** is `mol_sessies.status` + `mol_sessies.ronde_fase`. Per groep wordt de fase afgeleid door te kijken wie al heeft ingediend/gestemd.

```
[setup]
  ↓  alle leerlingen online in hun groep → docent start sessie
[briefing]
  ↓  iedereen heeft groepshoofd_stem opgeslagen EN mol_briefing_klaar
[invoer_ronde_N]
  ↓  iedereen in groep heeft antwoord ingediend
[discussie_ronde_N]
  ↓  groepshoofd heeft groepsantwoord ingediend
[resultaat_ronde_N]      ← 10-sec countdown ontbreekt in frontend
  ↓  knop "Verder" of 10-sec timer
  → als N < n_rondes: terug naar [invoer_ronde_N+1]
  → als N == n_rondes: naar [test]
[test]
  ↓  iedereen heeft Mol-test ingediend
[reveal]
[afgelopen]
```

**Ontbrekende fase-overgangen in de frontend:**
- `briefing → bekendmaking` (10-sec groepshoofd reveal): niet geïmplementeerd
- `discussie → groepsantwoord-bevestiging` (10-sec countdown scherm 8): niet geïmplementeerd
- `resultaat → invoer_ronde_N+1` (automatisch via poll of knop): knop is stub
- `test → wacht-test` (scherm 11): poll navigeert hier niet naar

**Wie triggert fase-overgangen?**

| Overgang | Trigger | Mechanisme |
|---|---|---|
| setup → briefing | Docent | `PATCH /api/mol/sessies/:id/status` |
| briefing → invoer | Server (automatisch) | `bepaalGroepStatus` detecteert alle klaar |
| invoer → discussie | Server (automatisch) | `bepaalGroepStatus` detecteert alle antwoorden |
| discussie → resultaat | Groepshoofd (client) | `POST /api/mol/sessies/:id/groepsantwoord` |
| resultaat → invoer/test | Server of knop | Momenteel: knop is stub, server bepaalt via polling |
| test → reveal | Server (automatisch) | `bepaalGroepStatus` detecteert alle test-antwoorden |
| reveal → afgelopen | Docent | `PATCH /api/mol/sessies/:id/status` |

---

### 1.6 Polling-architectuur

**Huidig mechanisme:**
- Spelers pollen `GET /api/mol/sessie/:id` (oude route) elke 3,5 seconden — retourneert VOLLEDIGE sessie-state (leerlingen, cases, antwoorden, stemmen)
- Spelers pollen `GET /api/mol/sessies/:id/groep-status` elke 3,5 seconden — maar dit **faalt** (zie bug 2)
- Docent-dashboard pollt `GET /api/mol/sessies/:id/dashboard` elke 4 seconden

**Maximale vertraging bij fase-overgang:** 3,5 seconden (één poll-interval) + netwerklatentie (~200ms op Railway). In de praktijk dus ≤ 4 seconden.

**Belasting bij 6 groepen van 5 leerlingen (30 spelers):**
- 30 × 2 polls per 3,5 sec = ~17 requests/sec tijdens actieve spelfase
- Plus 1 docent: totaal ~17,3 req/sec
- Elke `GET /api/mol/sessie/:id`-request doet 10 parallelle Supabase-queries (zie regel 1183-1192)
- Dat is ~170 Supabase-queries per seconde

Dit is zorgwekkend maar acceptabel voor schoolgebruik (1 klas tegelijk). Zie risicolog.

---

### 1.7 Authenticatie-flow

```
Docent:
  index.html → login → JWT-token → URL-param ?leraar=<token>
  mol-lesvorm.html leest token uit URL of localStorage

Speler:
  mol-lesvorm.html?rol=speler
  POST /api/mol/sessies/:id/login (sessiecode + spelcode)
  → geen JWT, geen speler-token
  → alle speler-API-aanroepen: geen Authorization-header
```

**Probleem:** `groep-status` en `discussie-data` vereisen een JWT die spelers niet hebben. Dit moet opgelost worden vóórdat de bouwfase begint.

**Aanbeveling:** Verwijder `verifyToken` van speler-gerichte endpoints en gebruik in plaats daarvan `leerling_id` + `sessie_id` als impliciete identificatie (al aanwezig in query-params). Voor de spelcodes-route: gebruik `docentCode` als bewijs van autorisatie.

---

## Deliverable 2 — Opgesplitste bouwblokken

De bouwblokken zijn geordend van meest-blokkerend naar minst-blokkerend. Elk bouwblok moet volledig af zijn (tests groen, commit) voordat het volgende begint.

---

### Bouwblok 0 — Kritieke bugs (blokkerend voor alles)
**Complexiteit:** Laag  
**Schermen:** Geen nieuwe schermen  
**Afhankelijkheden:** Geen  
**Reden voorrang:** Zonder deze fixes kunnen leerlingen de app letterlijk niet gebruiken.

Scope:
1. `groep-status` en `discussie-data`: verwijder `verifyToken`, gebruik `leerling_id` + `sessie_id` als identificatie
2. `genereer-spelcodes`: vervang `verifyToken` door verificatie via `docentCode` in request body
3. `mol_test_antwoorden`: kies één kolomnaam (`verdachte_id`) en migreer consistent — pas `reveal.js` en `bereken-scores` aan
4. `mol_groepen` CHECK constraint (migratie 005): aanpassen naar waarden die de code daadwerkelijk gebruikt, OF migratie 005 intrekken en systeem B verwijderen

**Acceptatiecriteria:**
- Docent ziet spelcodes op het scherm na sessie aanmaken
- Leerling-poll retourneert groep-status zonder 401
- Reveal toont correct of speler de Mol heeft geraden

---

### Bouwblok 1 — Briefing-fase completeren
**Complexiteit:** Laag  
**Schermen:** 2, 3, 4  
**Afhankelijkheden:** Bouwblok 0  

Scope:
1. Scherm 4 (groepshoofd bekendmaking): render-functie schrijven, `pollSpelerStatus` branch toevoegen die na de briefing-fase 10 seconden het scherm toont alvorens naar invoer te gaan
2. Fase-overgang `briefing → bekendmaking → invoer` correct tracken: client-side timer van 10 seconden, daarna automatisch poll naar invoer

**Acceptatiecriteria:**
- Na stemmen zien alle groepsleden het groepshoofd-scherm met naam en 10-sec countdown
- Na 10 seconden verschijnt automatisch de eerste ronde

---

### Bouwblok 2 — Ronde-cyclus voltooien
**Complexiteit:** Middel  
**Schermen:** 5, 6, 7a, 7b, 8, 9  
**Afhankelijkheden:** Bouwblok 1  

Scope:
1. Scherm 8 (groepsantwoord bevestiging): na `submitGroepsantwoord()` navigeer direct naar `screen-speler-groepsantwoord`, toon groepsantwoord + 10-sec countdown, daarna naar feedback
2. `naarVolgendeRondeOfTest()` stub vervangen: na feedback-scherm, als server-fase `resultaat` retourneert, laat knop actief zijn die navigeert naar volgende ronde of mol-test
3. Scherm 6 (wacht na indienen): polling-update zodat groepsgenoot-status correct wordt getoond

**Acceptatiecriteria:**
- Gewone speler en groepshoofd zien allebei scherm 8 na groepsantwoord
- Feedback-scherm toont "Verder naar ronde X" of "Naar Mol-test" afhankelijk van positie
- Ronde herhaalt correct voor N rondes

---

### Bouwblok 3 — Finale-fase completeren
**Complexiteit:** Laag  
**Schermen:** 10, 11, 12  
**Afhankelijkheden:** Bouwblok 2  

Scope:
1. Scherm 11 (wacht op Mol-test): `pollSpelerStatus` branch toevoegen die na test-indienen `screen-speler-wacht-test` toont en blijft pollen tot reveal
2. `submitTest()` aanpassen: verwijder de vereiste voor een tekst-argument (20+ tekens) als dit niet in de spec staat (zie Deliverable 3, punt 5)
3. Reveal-screen: controleer of `renderSpelerReveal` correct werkt na bug 3-fix

**Acceptatiecriteria:**
- Na Mol-test ziet speler het wacht-scherm met status van groepsgenoten
- Reveal toont correct de Mol-naam en of speler goed geraden heeft
- Eindstand toont alle spelers gesorteerd

---

### Bouwblok 4 — Docent-dashboard
**Complexiteit:** Middel  
**Schermen:** Docent-dashboard  
**Afhankelijkheden:** Bouwblok 0 (fase-systeem fix)  

Scope:
1. Dashboard groepskaarten: actuele fase per groep tonen (gebruik `bepaalGroepStatus` als helper of retourneer fase in dashboard-endpoint)
2. Dashboard toont ronde_nr per groep
3. "Sessie stoppen" toets: zet status op `afgelopen`, alle clients detecteren dit via poll en tonen eindscherm
4. Spelcodes-knop in dashboard werkt na bug 1-fix

**Acceptatiecriteria:**
- Docent ziet per groep: naam, huidige fase, ronde-nummer, online-status per speler, groepshoofd
- "Sessie stoppen" werkt end-to-end: clients navigeren naar reveal

---

### Bouwblok 5 — Sessie-herstel na page refresh
**Complexiteit:** Middel  
**Schermen:** 1 (login), alle speler-schermen  
**Afhankelijkheden:** Bouwblok 2  

Scope:
1. Na page refresh: lees `speler_id` en `sessie_id` uit... (zie Deliverable 3, punt 1 — beslissing nodig)
2. `initSpelerFlow()` aanroepen als `speler` herstelbaar is
3. `pollSpelerStatus()` detecteert huidige fase en navigeert direct naar juiste scherm

**Acceptatiecriteria:**
- Speler die de browser ververst keert automatisch terug naar het scherm waar hij was
- Speler die de app sluit en herstart kan opnieuw inloggen en zit in de juiste fase

---

### Bouwblok 6 — Fase-systeem opruimen (technische schuld)
**Complexiteit:** Laag  
**Schermen:** Geen  
**Afhankelijkheden:** Bouwblok 4  

Scope:
1. Kies één fase-systeem: ofwel systeem A (sessie-level, al dominant) ofwel systeem B (per-groep, in mol_groepen)
2. Verwijder het ongebruikte systeem inclusief dode code
3. Pas migratie 005 aan zodat constraint klopt
4. Documenteer het gekozen systeem in CLAUDE.md

**Acceptatiecriteria:**
- Er is één enkel fase-systeem
- Geen dode code rond `mol_groepen.fase`
- Dashboard-endpoint en `bepaalGroepStatus` gebruiken dezelfde bron

---

### Parallel of sequentieel?

```
Bouwblok 0 (bugs) 
  → Bouwblok 1 (briefing)
     → Bouwblok 2 (ronde-cyclus)
        → Bouwblok 3 (finale)
  → Bouwblok 4 (dashboard)    ← parallel met blok 1-3 mogelijk
     → Bouwblok 6 (opruimen)
  → Bouwblok 5 (sessie-herstel) ← na blok 2
```

Bouwblok 4 (dashboard) kan parallel met blokken 1-3 worden gebouwd door een tweede builder, mits bouwblok 0 gereed is.

---

## Deliverable 3 — Onduidelijkheden en beslissingen nodig

Elke vraag hieronder blokkeert één of meer bouwblokken. Beslissingen die de builder direct nodig heeft zijn gemarkeerd als **BLOKKEREND**.

---

**Vraag 1 — Sessie-herstel na page refresh** ✅ BESLOTEN (april 2026)

**Beslissing:** Speler die offline gaat (langer dan 60 seconden) moet **opnieuw inloggen** met dezelfde sessiecode + spelcode. De groepssessie valt dan uit en wordt door de docent herstart. Er is geen automatisch herstel van scherm-positie nodig — de docent-herstart zet de groep terug naar een bekende staat.

**Implicatie voor de builder:** Huidige `localStorage`-aanroepen in `spelerAanmelden()` mogen blijven staan als tijdelijke workaround voor dezelfde browsersessie (tab niet gesloten), maar dit wordt als technische schuld gedocumenteerd. Bouwblok 5 (herstel) vervalt grotendeels — de docent-herstart knop (bouwblok 4) is de echte oplossing.

---

**Vraag 2 — Offline groepslid tijdens discussie** ✅ BESLOTEN (april 2026)

**Beslissing:** Speler wordt na **60 seconden** zonder heartbeat als offline gezien. De groepssessie valt dan uit en de docent moet de groep handmatig opnieuw opstarten via het dashboard. Speler herlogt in met dezelfde codes.

**Implicaties voor de builder:**
- Timeout aanpassen van 90 → 60 seconden in `bepaalGroepStatus` en dashboard-endpoint
- Dashboard toont offline-spelers in real-time (al gedeeltelijk aanwezig)
- Docent-dashboard: "Groep opnieuw starten"-knop per groepkaart toevoegen
  - Deze knop wist de antwoorden van de huidige ronde voor die groep
  - Zet `mol_groepen.fase` (of sessie-fase voor die groep) terug naar `invoer`
- Dit endpoint is nieuw: `POST /api/mol/sessies/:id/groep-herstart` met body `{ groep_id }`

---

**Vraag 3 — Gelijkspel bij groepshoofd-stemming** ✅ Al opgelost in code

`POST /api/mol/sessies/:id/bepaal-groepshoofd` (regel 1931) lost gelijkspel op via willekeurige keuze: `koplopers[Math.floor(Math.random() * koplopers.length)]`. Dit is afdoende.

---

**Vraag 4 — Definitie van "online"** ✅ BESLOTEN (april 2026)

**Beslissing:** Timeout = **90 seconden** (huidige implementatie is correct, niet aanpassen). Speler die langer dan 90 seconden geen heartbeat stuurt, telt als offline. De groepssessie valt dan uit en de docent herstart de groep.

- `bepaalGroepStatus` en dashboard-endpoint: huidige 90.000 ms timeout blijft
- Docent-dashboard: "groep opnieuw starten"-knop toevoegen (wist antwoorden huidige ronde, zet fase terug naar invoer)
- Speler die terugkomt: herlogt in met dezelfde codes (werkt al)

---

**Vraag 5 — Puntensysteem en Mol-test** ✅ BESLOTEN (april 2026)

**Beslissing Mol-test:** Alleen de naam van de verdachte — geen tekst-argument, geen ronde-keuze.
- `speler.js::submitTest()`: verwijder de ≥20-tekens validatie op het argument-veld
- `mol-lesvorm.html`: verwijder `test-argument-tekst` textarea en ronde-keuze knoppen uit `screen-speler-test`
- Backend `POST /api/mol/sessies/:id/test`: `argument`-veld was al optioneel, geen wijziging nodig

**Beslissing puntentelling:** zie vraag 6 hieronder.

---

**Vraag 5b — Puntensysteem en Mol-test (historisch)** ✅ BESLOTEN

De `submitTest()` functie in `speler.js` vereist een tekst-argument van minimaal 20 tekens. De leerlingflow-spec toont alleen een radio-lijst zonder tekstveld. Daarnaast selecteert de test een `ronde_nr` (welke ronde was verdacht) — ook niet in de spec.

Vraag: Moet de Mol-test alleen de naam van de verdachte bevatten (spec), of ook een onderbouwing en rondenummer (huidige code)?

**Implicatie:** Als de spec leidend is, moet `submitTest()` worden vereenvoudigd (verwijder tekst-vereiste en ronde-keuze). Dit is een scope-wijziging die de builder expliciet nodig heeft.

---

**Vraag 6 — Puntentelling: individueel vs. groep** ✅ BESLOTEN (april 2026)

**Beslissing — gewone spelers (niet de Mol):**
- Individueel antwoord per ronde: het aantal punten dat de leraar heeft toegewezen aan die antwoordoptie
- Groepsantwoord per ronde: aantal punten van die optie × 2
- Mol correct geraden in de test: 50 punten te verdelen; formule `(1 / aantal_spelers_dat_goed_raadde) × 50`
  - Voorbeeld: 1 van 4 raadt goed → 50 pt. 3 van 4 → elk ~16,7 pt.

**Beslissing — de Mol:**
- Individueel antwoord per ronde: zelfde als gewone speler (punten van eigen optie)
- Groepsantwoord per ronde: `(max_punten_van_ronde − ingediende_punten_groepsantwoord) × 2`
  - De Mol verdient meer als de groep een slechter antwoord kiest
- Mol-test: `(1 − (aantal_correct_geraden / aantal_niet_mol_spelers)) × 50`
  - Voorbeeld: 0 van 4 raden goed → 50 pt. 1 van 4 raadt goed → 37,5 pt.

**Implicaties voor de builder:**
- `mol_groep_stemmen` moet `max_punten` per ronde opslaan (= de puntwaarde van de beste MC-optie)
- `mol_cases.mc_opties` bevat al een puntwaarde per optie — die is leidend
- `bereken-scores` aanroepen: automatisch na elke ronde (na groepsantwoord) én na de Mol-test
- `mol_scores` slaat het lopende totaal op per leerling

---

**Vraag 7 — Reveal-timing** ⚠️ Beslissing nodig voor bouwblok 4

De spec zegt dat de reveal automatisch start "zodra iedereen klaar is met de Mol-test". De huidige code zet de sessie op `reveal` zodra `bepaalGroepStatus` detecteert dat iedereen gestemd heeft. Dit is server-automatisch.

Vraag: Wil de docent de reveal handmatig starten (via dashboard-knop), of automatisch zodra alle tests zijn ingediend?

**Implicatie:** Automatisch is al geïmplementeerd. Handmatig vereist een extra dashboard-knop.

---

**Vraag 8 — Meerdere sessies tegelijk** Informatief, geen blokkade

`GET /api/mol/sessies` retourneert alle sessies voor een leraar, gesorteerd op aanmaakdatum. Meerdere actieve sessies zijn technisch mogelijk maar niet uitgetest. De docent-UI toont een sessielijst en kan één sessie tegelijk openen. Geen blokkade voor de bouwfase.

---

**Vraag 9 — Krijgt de Mol ook punten?** Beslissing nodig voor bouwblok 3

In de huidige reveal-logica wordt de winnaar bepaald op basis van:
1. Heeft de speler de Mol correct geraden?
2. Van die spelers: wie heeft de meeste punten?

De Mol zelf krijgt blijkbaar geen punten (of anders: de Mol staat buiten de winnaarsbepaling). Dit is nergens expliciet gedocumenteerd.

---

## Deliverable 4 — Risicolog

### Risico 1 — Polling-load bij grote klassen

**Beschrijving:** 30 spelers × 2 polls per 3,5 sec = ~17 API-requests/sec. Elke `GET /api/mol/sessie/:id` doet 10 parallelle Supabase-queries. Dit is ~170 Supabase-queries/sec bij één actieve sessie.

**Kans:** Laag (schoolgebruik, 1 klas tegelijk)  
**Impact:** Middel (Railway en Supabase free-tier hebben rate limits; bij hogere belasting: time-outs)  
**Mitigatie:**
- Niet oplossen nu: voor de pilot (1 klas) is dit ruimschoots acceptabel.
- Als de school meerdere klassen tegelijk wil: overweeg de volledige sessie-state te cachen (30 seconden Redis-cache op Railway) of de `GET /api/mol/sessie/:id` op te splitsen in een lichtere poll-endpoint die alleen fase + ronde_nr retourneert.
- Drempelwaarde: monitor Railway-logs. Als latentie boven 800ms komt, is optimalisatie nodig.

---

### Risico 2 — Race conditions bij fase-overgang

**Beschrijving:** Als twee leerlingen tegelijk het laatste antwoord van hun groep indienen, kan `bepaalGroepStatus` twee keer `discussie` retourneren en kan de discussie-fase twee keer worden getriggerd. Hetzelfde geldt voor de groepshoofd-stemming.

**Kans:** Laag (bij 4 seconden poll is de kans op exacte gelijktijdigheid klein)  
**Impact:** Laag (Supabase-`upsert` met vaste ID maakt dubbelingen idempotent)  
**Mitigatie:**
- De huidige `upsert`-aanpak met deterministische IDs (`antw_${sessie_id}_r${ronde_nr}_${leerling_id}`) beschermt al tegen dubbele inserts.
- Fase-overgangen zijn read-only in de client (server berekent fase altijd opnieuw). Er is geen write-race op de fase zelf.
- Risico is acceptabel voor de huidige implementatie.

---

### Risico 3 — AI-afhankelijkheid (Anthropic API)

**Beschrijving:** Vraag- en feedbackgeneratie via Anthropic Claude. Als de API traag is (>5 sec) of faalt, kunnen nieuwe sessies niet worden aangemaakt en wordt geen feedback getoond.

**Kans:** Middel (API-uitval komt voor, typisch <1% van requests)  
**Impact:** Hoog (docent kan niet starten als vragen niet genereren)  
**Mitigatie:**
- De huidige code heeft al een `try/catch` bij genereer-cases. Controleer of de foutmelding leesbaar is voor de docent.
- Voeg een retry-mechanisme toe (1 retry na 3 sec) in `genereer-cases`.
- Voor feedbackgeneratie: zorg dat de feedback-endpoint een fallback retourneert (bijv. de `correct_uitleg` als statische feedback) als de AI-aanroep faalt.
- Overweeg vragen pre-te genereren en op te slaan bij sessie-aanmaken, zodat de speelfase niet AI-afhankelijk is.

---

### Risico 4 — JWT via URL-parameter

**Beschrijving:** De leraar-JWT wordt als URL-parameter `?leraar=<token>` meegegeven vanuit `index.html`. URL-parameters zijn zichtbaar in browser-history, server-logs (Railway), en kunnen per ongeluk worden gedeeld.

**Kans:** Laag (interne school-app, beperkte gebruikersgroep)  
**Impact:** Middel (token geeft toegang tot alle sessies van deze leraar)  
**Mitigatie:**
- Niet blokkend voor de bouwfase. Document dit als bekende technische schuld.
- Korte-termijn mitigatie: sla het token op in `sessionStorage` (niet localStorage) en verwijder het uit de URL via `history.replaceState()` direct na het uitlezen.
- Lange-termijn: overweeg een aparte docent-login in `mol-lesvorm.html` met een eigen token-flow.

---

### Risico 5 — Offline-afhandeling

**Beschrijving:** De app vereist een actieve internetverbinding voor alle functionaliteit (polling, indienen, feedback). Er is geen offline-modus.

**Kans:** Middel (schoolnetwerken zijn soms onbetrouwbaar)  
**Impact:** Hoog (speler kan niet indienen → groep hangt)  
**Mitigatie:**
- De `catch`-blok in `pollSpelerStatus` doet al `return` bij netwerkfout (stille fout). De app blijft op het laatste scherm staan.
- Minimale garantie: antwoord-indienen retryable maken. Bij netwerk-fout tijdens `submitAntwoord()`: wacht 3 sec en retry automatisch.
- Docent-override (zie Vraag 2) mitigeert het ergste scenario.

---

### Risico 6 — Twee API-versies (technische schuld)

**Beschrijving:** Er bestaan twee families van endpoints: de oude (`/api/mol/sessie/:id`, `/api/mol/groepshoofd-stem`) en de nieuwe (`/api/mol/sessies/:id/groepsantwoord`, etc.). Sommige frontend-code gebruikt de oude, sommige de nieuwe.

**Kans:** Hoog (al aanwezig)  
**Impact:** Middel (verwarring bij onderhoud, dubbele testoppervlak)  
**Mitigatie:**
- Documenteer welke endpoints deprecated zijn en welke de nieuwe standaard zijn.
- Migreer frontend-aanroepen stap voor stap naar de nieuwe routes.
- Verwijder oude routes pas na volledige migratie (en update tests).

---

## Samenvatting voor de bouwfase

**Volgorde van aanpak:**

1. **Bouwblok 0** (bugs fixen) — vóór alles, door één builder, ~4-6 kleine commits
2. **Bouwblok 1** (briefing) + **Bouwblok 4** (dashboard) — parallel mogelijk
3. **Bouwblok 2** (ronde-cyclus) — grootste bouwblok, splits in ≥3 sessies
4. **Bouwblok 3** (finale) — na bouwblok 2
5. **Bouwblok 5** (herstel) — na beslissing over vraag 1
6. **Bouwblok 6** (opruimen) — als laatste

**Beslissingen die vóór builderfase genomen moeten worden:**

| Vraag | Beslissing | Status |
|---|---|---|
| 1 — Sessie-herstel | Herlogin met zelfde codes; docent herstart groep | ✅ Besloten |
| 2 — Offline groepslid | 60-sec timeout; docent-herstart knop per groep | ✅ Besloten |
| 4 — Definitie "online" | 90 seconden (huidige implementatie correct) | ✅ Besloten |
| 5 — Mol-test velden | Alleen naam verdachte; verwijder tekst + ronde-keuze | ✅ Besloten |
| 6 — Puntentelling | Zie uitgewerkte formules hierboven | ✅ Besloten |
| 7 — Reveal-timing | Automatisch (al geïmplementeerd) | ✅ Besloten |

**Alle beslissingen zijn genomen. De bouwfase kan starten met Bouwblok 0.**

---

*Document gegenereerd door Architect-sessie april 2026. Niet aanpassen zonder nieuwe Architect-sessie.*
