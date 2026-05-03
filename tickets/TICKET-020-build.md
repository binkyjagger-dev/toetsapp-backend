# TICKET-020 — Build-handoff

**Ticket:** TICKET-020 — Fix mol_test_antwoorden upsert
**Datum:** 2026-05-02
**Builder:** Cowork sessie B

## Bestanden gewijzigd

| Bestand | Mutatie | Toelichting |
|---|---|---|
| `server.js` (regel 2113-2121) | 8+/5- | DB-mapping `verdachte_id` → `mol_verdachte_id` + `.error`-check op upsert |
| `tests/mol-test-upsert-veld.test.js` | nieuw, 92 regels | TDD-tests voor AC1 + AC2 |

## Wijzigingen — citaat van exact gewijzigde regels

**Wijziging 1 + 2** (server.js:2113-2121, één diff-blok):

Vóór:
```js
    const { leerling_id, verdachte_id } = req.body;
    await supabase.from('mol_test_antwoorden').upsert([{
      id: `test_${sid}_${leerling_id}`,
      sessie_id: sid, leerling_id,
      verdachte_id, submitted_at: Date.now(),
    }]);
    // Per-groep completion-check: ...
```

Na:
```js
    const { leerling_id, verdachte_id } = req.body;
    const { error: insertErr } = await supabase
      .from('mol_test_antwoorden').upsert([{
        id: `test_${sid}_${leerling_id}`,
        sessie_id: sid, leerling_id,
        mol_verdachte_id: verdachte_id,
        submitted_at: Date.now(),
      }]);
    if (insertErr) return res.status(500).json({ error: insertErr.message });
    // Per-groep completion-check: ...
```

Uitleg per stap:
1. **Mapping:** body-parameter `verdachte_id` (frontend ongewijzigd) wordt nu naar DB-kolom `mol_verdachte_id` geschreven — de echte kolomnaam in `mol_test_antwoorden`.
2. **Error-check:** upsert-result wordt gedestructureerd; bij fout returnt het endpoint nu `500` met de DB-message i.p.v. stille `200/{ok:true}`.

## Test-output (laatste npm test run)

```
Test Suites: 1 failed, 96 passed, 97 total
Tests:       511 passed, 511 total
Snapshots:   0 total
Time:        32.284 s
```

- Nieuwe suite `tests/mol-test-upsert-veld.test.js`: **2/2 groen**.
- Alle in AC4 genoemde suites groen:
  - `mol-groep-test-reveal.test.js` ✓
  - `mol-puntentelling-intern.test.js` ✓
  - `mol-test-scherm.test.js` ✓
  - `mol-frontend-flow.test.js` ✓
  - `mol-feedback-flow.test.js` ✓
- `npm run lint:html`: **OK** (geen inline scripts).
- **Pre-existing failure** (NIET door dit ticket): `tests/api-health.test.js` faalt op zowel `main` als deze branch met `supabaseUrl is required` — die suite mockt Supabase niet. Geverifieerd door `git stash && npx jest tests/api-health.test.js` op stock main.

## Self-check tegen acceptatiecriteria

- ✓ **AC1** — schrijfkant gebruikt `mol_verdachte_id`. Geverifieerd via spy op `mol_test_antwoorden.upsert`: arg bevat `mol_verdachte_id: 'lid_mol'` en géén `verdachte_id`-key.
- ✓ **AC2** — error-propagation. Bij `upsertResult.error` retourneert endpoint `500` met `error: <message>`.
- ⏳ **AC3** — happy path eindigt in reveal. Verificatie via curl/DB door Reviewer (zie sectie hieronder). Logica zelf ongewijzigd; mocked test in `mol-groep-test-reveal.test.js (AC5)` blijft groen.
- ✓ **AC4** — bestaande tests groen (zie test-output).
- ✓ **AC5** — leesfallback `(t.verdachte_id || t.mol_verdachte_id)` op regel 1614, 1650, 2152 ongemoeid; werkt nu als no-op die altijd `mol_verdachte_id` pakt.
- ✓ **AC6** — `git diff --stat`: 1 file gewijzigd (`server.js`, 13 regels diff = 8+/5-) + 1 nieuwe testfile. Wijziging in `server.js` < 10 netto regels.

## Opgemerkt, niet opgepakt

- `tests/api-health.test.js` faalt pre-existing wegens ontbrekende Supabase-env-mocks. Buiten scope; mogelijk eigen ticket.
- Leesfallbacks `(t.verdachte_id || t.mol_verdachte_id)` zijn nu permanent no-ops (eerste operand altijd `undefined`). Cleanup-ticket conform architect-richtlijn buiten scope.
- Andere queries in dit endpoint (de `select`-calls) hebben nog geen `.error`-check. Algemener patroon, buiten scope.

## Commit-instructie voor Martijn (uitvoeren in de terminal)

1. Open een terminal in de projectmap (`~/projects/toetsapp-backend`).
2. Voer letterlijk uit:
   ```
   git add server.js tests/mol-test-upsert-veld.test.js tickets/TICKET-020.md tickets/TICKET-020-build.md
   git commit -m "TICKET-020: fix mol_test_antwoorden upsert naar mol_verdachte_id + error-check"
   ```
3. Verwacht: je ziet `4 files changed` (of 3 als TICKET-020.md al gecommit is).
4. Bij fout: stuur de exacte foutmelding naar de Architect.

## Reminder voor Martijn — handmatige DB-cleanup

Eerdere debug-sessie heeft een `_diag`-rij in productie achtergelaten. Verwijder die in **Supabase dashboard** → SQL editor:
```sql
DELETE FROM mol_test_antwoorden WHERE leerling_id LIKE '%_diag';
```
Verwacht: `1 row deleted` (of meer als er meerdere diag-rijen waren).

## Deploy en test dan het volgende (Reviewer-stappen):

Volg `WORKFLOW.md` § Preamble Reviewer Deel 2. Variabelen `$SESSIE_ID`, `$GROEP_A`, `$LID_1`, `$LID_MOL`, `$RAILWAY` (test-URL) bekend uit ticket-setup met **2 leerlingen × 1 groep × 1 ronde**, doorlopen tot `mol_groepen.fase = 'test'`.

**Maak schoon vóór de test:**
```sql
DELETE FROM mol_test_antwoorden WHERE sessie_id = '$SESSIE_ID';
```

**AC1 + AC3 — happy path eindigt in reveal:**
```bash
curl -X POST $RAILWAY/api/mol/sessies/$SESSIE_ID/test \
  -H "Content-Type: application/json" \
  -d "{\"leerling_id\":\"$LID_1\",\"verdachte_id\":\"$LID_MOL\"}"
# Verwacht: 200, {"ok":true}

curl -X POST $RAILWAY/api/mol/sessies/$SESSIE_ID/test \
  -H "Content-Type: application/json" \
  -d "{\"leerling_id\":\"$LID_MOL\",\"verdachte_id\":\"$LID_1\"}"
# Verwacht: 200, {"ok":true}
```

DB-checks (Supabase dashboard / CLI):
```sql
SELECT leerling_id, mol_verdachte_id FROM mol_test_antwoorden WHERE sessie_id = '$SESSIE_ID';
-- Verwacht: 2 rijen, mol_verdachte_id-kolom gevuld

SELECT fase FROM mol_groepen WHERE id = '$GROEP_A';
-- Verwacht: 'reveal'

SELECT count(*) FROM mol_scores WHERE sessie_id = '$SESSIE_ID';
-- Verwacht: 2
```

API-check:
```bash
curl "$RAILWAY/api/mol/sessies/$SESSIE_ID/groep-status?groep_id=$GROEP_A"
# Verwacht: {"fase":"reveal","ronde_nr":1,"wacht_op":[]}
```

**AC2 — error-propagation:**
```bash
curl -X POST $RAILWAY/api/mol/sessies/SESSIE_BOGUS/test \
  -H "Content-Type: application/json" \
  -d "{\"leerling_id\":\"BOGUS\",\"verdachte_id\":\"X\"}"
# Verwacht: 500, body {"error":"<DB-message>"}
```

**AC4 — npm test:**
```bash
npm test
```
Verwacht: alle suites groen (incl. `mol-test-upsert-veld`). Zie pre-existing-failure note over `api-health.test.js`.

**AC6 — diff-omvang:**
```bash
git diff --stat main..HEAD
```
Verwacht: alleen `server.js` + `tests/mol-test-upsert-veld.test.js` (en optioneel ticket-MD's).

**Browser-eindcheck:** speler 1 en 2 doen moltest in browser. Verwacht: binnen 5s springen beide schermen naar `screen-speler-reveal` met Mol-naam, eindstand en feedback-knop (TICKET-019).
