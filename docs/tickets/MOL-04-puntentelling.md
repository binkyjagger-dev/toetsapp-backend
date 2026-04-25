# MOL-04 — Puntentelling implementeren

**Epic:** Wie is de Mol  
**Rol:** Builder  
**Afhankelijkheid:** MOL-03 moet volledig af zijn  
**Geschatte omvang:** 3 wijzigingen × (test + fix + commit) = ~9 commits  
**Referentie:** `docs/mol-architect-analyse.md` sectie Deliverable 3 — Vraag 6 (puntentelling besloten)

---

## Context

Punten worden nu nergens berekend tijdens het spel. `mol_scores` is altijd leeg. Scherm 9 toont "0 punten". Dit ticket implementeert de volledige puntentelling zoals besloten:

**Gewone spelers:**
- Individueel antwoord: punten van de gekozen MC-optie (`mc_opties[].punten`)
- Groepsantwoord: punten van de gekozen optie × 2
- Mol-test (correct geraden): `(1 / aantal_correct_geraden) × 50`

**De Mol:**
- Individueel antwoord: punten van de gekozen MC-optie
- Groepsantwoord: `(max_punten_ronde − ingediende_punten_groepsantwoord) × 2`
- Mol-test (niet ontmaskerd): `(1 − (aantal_correct_geraden / aantal_niet_mol_spelers)) × 50`

**Timing:** punten worden berekend en opgeslagen **na elke ronde** (zodra het groepsantwoord is ingediend). Scherm 9 toont de punten van déze ronde (niet het lopende totaal).

---

## Scope van dit ticket: 3 fixes

---

### Fix 1 — bereken-scores aanroepen na groepsantwoord

**Bestand:** `server.js`  
**Locatie:** `POST /api/mol/sessies/:id/groepsantwoord` (regel ~1993)  

**Lees vóór je schrijft:** de volledige handler van dit endpoint.

Na het opslaan van het groepsantwoord moet de server direct de scores voor deze ronde berekenen. Maak hiervoor een interne helper-functie `berekenScoresVoorRonde(sessie_id, groep_id, ronde_nr)`.

**Stap 1 — Test schrijven** (`tests/mol-puntentelling.test.js`):
```javascript
// Test: na groepsantwoord worden mol_scores rijen aangemaakt voor de groep
// Test: gewone speler krijgt juiste punten (individueel + groep × 2)
// Test: mol krijgt juiste punten (individueel + gemist groepspotentieel × 2)
// Test: bij gelijkspel (meerdere opties met max punten) wordt max correct bepaald
```

**Stap 2 — Schrijf `berekenScoresVoorRonde(sessie_id, groep_id, ronde_nr)`:**

De functie:
1. Haalt op: `mol_leerlingen` van de groep, `mol_antwoorden` van deze ronde, `mol_cases` van deze ronde, het ingediende `mol_groep_stemmen` record
2. Bepaalt `max_punten` = hoogste puntwaarde onder `mc_opties` van de case
3. Bepaalt `ingediende_punten` = puntwaarde van de gekozen optie in `mol_groep_stemmen`
4. Slaat `max_punten` op in `mol_groep_stemmen` (voeg kolom toe als die ontbreekt — zie sectie database)
5. Per leerling: berekent en upsert een rij in `mol_scores`:

```javascript
// Structuur van een mol_scores rij voor één ronde:
{
  id: `score_${sessie_id}_r${ronde_nr}_${leerling_id}`,
  sessie_id,
  leerling_id,
  ronde_nr,
  individueel:  puntenVanEigenAntwoord,
  groep:        isGroep ? ingediendePunten * 2 : 0,        // voor speler
  mol_groep:    isMol ? (maxPunten - ingediendePunten) * 2 : 0,  // voor mol
  totaal_ronde: som van bovenstaande
}
```

Maximale omvang: 25 regels. Als je meer nodig hebt: splits op.

**Stap 3 — Roep de helper aan** aan het einde van de `groepsantwoord` handler:
```javascript
await berekenScoresVoorRonde(req.params.id, groep_id, ronde_nr);
```

**Commit:** `MOL-04: berekenScoresVoorRonde — berekent individueel + groepspunten na ronde`

---

### Fix 2 — Mol-test punten berekenen na test-indienen

**Bestand:** `server.js`  
**Locatie:** `POST /api/mol/sessies/:id/test` (regel ~2014)  
**Timing:** na het indienen van de LAATSTE test-antwoord (wanneer alle leerlingen in de groep klaar zijn)

**Lees vóór je schrijft:** de volledige handler van het test-endpoint, en de functie `bepaalGroepStatus()` — kijk hoe "iedereen klaar" wordt gedetecteerd.

**Schrijf `berekenMolTestPunten(sessie_id, groep_id)`:**

De functie:
1. Haalt op: `mol_leerlingen` van de groep, `mol_test_antwoorden` van de groep
2. Bepaalt `mol_id` = de leerling waarvoor `is_mol === true`
3. Bepaalt `aantal_correct_geraden` = aantal niet-mol spelers waarvan `verdachte_id === mol_id`
4. Bepaalt `niet_mol_count` = groepsgrootte − 1

Speler-punten (per leerling die correct geraden heeft):
```javascript
const spelerBonus = Math.round((1 / aantal_correct_geraden) * 50);
```

Mol-punten:
```javascript
const molBonus = Math.round((1 - (aantal_correct_geraden / niet_mol_count)) * 50);
```

Upsert voor elke leerling een rij in `mol_scores`:
```javascript
{
  id: `score_${sessie_id}_test_${leerling_id}`,
  sessie_id,
  leerling_id,
  ronde_nr: 99,          // conventie: ronde 99 = test-punten
  mol_test: bonusPunten,
  totaal_ronde: bonusPunten
}
```

Aanroep aan het einde van het test-endpoint, maar alleen als iedereen klaar is:
```javascript
const groepStatus = await bepaalGroepStatus(req.params.id, groep_id);
if (groepStatus.fase === 'reveal') {
  await berekenMolTestPunten(req.params.id, groep_id);
}
```

**TDD** (voeg toe aan `tests/mol-puntentelling.test.js`):
```javascript
// Test: speler die mol correct raadt krijgt 50 / aantal_correct pt
// Test: mol krijgt 50 pt als 0 spelers correct geraden hebben
// Test: mol krijgt 0 pt als alle spelers correct geraden hebben
// Test: bij 0 correct geraden wordt er niet gedeeld door 0
```

**Commit:** `MOL-04: berekenMolTestPunten — berekent bonus na Mol-test`

---

### Fix 3 — Scherm 9 toont punten van déze ronde

**Bestand:** `netlify-deploy/mol-js/speler.js`  
**Locatie:** `renderFeedbackScherm()`  
**Probleem:** de functie toont `data.eigen_score || 0`. Het `ronde-feedback` endpoint (`GET /api/mol/sessies/:id/ronde-feedback`) geeft dit al terug, maar het endpoint moet nu de ronde-specifieke score retourneren vanuit `mol_scores`.

**Lees vóór je schrijft:**
1. De volledige handler van `GET /api/mol/sessies/:id/ronde-feedback` in `server.js`
2. De volledige functie `renderFeedbackScherm()` in `speler.js`

**Wijziging server.js — ronde-feedback endpoint:** voeg de score van déze ronde toe aan de response:

```javascript
const { data: rondeScore } = await supabase
  .from('mol_scores')
  .select('totaal_ronde')
  .eq('sessie_id', req.params.id)
  .eq('leerling_id', leerling_id)
  .eq('ronde_nr', r)
  .maybeSingle();

// Voeg toe aan de response:
eigen_score: rondeScore?.totaal_ronde || 0,
```

**Geen wijziging nodig in `renderFeedbackScherm()`** — die gebruikt `data.eigen_score` al correct.

**TDD:**
```javascript
// tests/mol-ronde-feedback-score.test.js
// Test: ronde-feedback endpoint retourneert eigen_score van de juiste ronde
// Test: eigen_score is 0 als mol_scores nog geen rij heeft voor deze ronde
```

**Database:** controleer of `mol_scores` de kolommen `ronde_nr`, `individueel`, `groep`, `mol_groep`, `mol_test`, `totaal_ronde` heeft. Als niet: schrijf een migratie `007_mol_scores_kolommen.sql`.

**Commit:** `MOL-04: ronde-feedback retourneert eigen_score van déze ronde`

---

## Database-wijzigingen

Controleer of deze kolommen bestaan. Als niet: schrijf migraties in `/migrations/`.

| Tabel | Kolom | Type | Reden |
|---|---|---|---|
| `mol_groep_stemmen` | `max_punten` | INT | Mol-bonus berekening vereist max punten van de ronde |
| `mol_scores` | `ronde_nr` | INT | Onderscheid per ronde + test-punten |
| `mol_scores` | `individueel` | INT | Uitsplitsing puntsoorten |
| `mol_scores` | `groep` | INT | Uitsplitsing puntsoorten |
| `mol_scores` | `mol_groep` | INT | Mol-specifieke groepspunten |
| `mol_scores` | `mol_test` | INT | Test-bonus |
| `mol_scores` | `totaal_ronde` | INT | Som van alle punten deze ronde |

Migraties aanmaken als losse SQL-bestanden, nog NIET uitvoeren. Martijn draait deze handmatig via Supabase SQL Editor.

---

## Afronden

```
node --check server.js
npm test  → alle tests groen
git log --oneline -8
```

**Volgende ticket:** MOL-05 — Finale completeren

---

## Buiten scope

- Scherm 12 eindstand (totaal over alle rondes) → MOL-05
- Docent-dashboard → MOL-06
- Bestaande `bereken-scores` endpoint (`POST /api/mol/bereken-scores`) niet aanpassen — die wordt in MOL-07 opgeruimd
