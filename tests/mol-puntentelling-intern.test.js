// Tests voor Fix 2 & 3 — berekenScoresIntern
// Getriggerd via POST /api/mol/test-antwoord (iederKlaar → berekenScoresIntern)

let leerlingenResolve;
let antwoordenResolve;
let groepStemmenResolve;
let testAntwoordenResolve;
let sessiesResolve;
let casesResolve;
let scoresResolve;

function makeChain(getResolve) {
  const c = {
    select:      jest.fn(() => c),
    eq:          jest.fn(() => c),
    update:      jest.fn(() => c),
    upsert:      jest.fn(() => c),
    single:      jest.fn(() => c),
    maybeSingle: jest.fn(() => c),
    then: (resolve, reject) =>
      Promise.resolve(getResolve()).then(resolve, reject),
  };
  return c;
}

const leerlingenChain    = makeChain(() => leerlingenResolve);
const antwoordenChain    = makeChain(() => antwoordenResolve);
const groepStemmenChain  = makeChain(() => groepStemmenResolve);
const testAntwChain      = makeChain(() => testAntwoordenResolve);
const sessiesChain       = makeChain(() => sessiesResolve);
const casesChain         = makeChain(() => casesResolve);
const scoresChain        = makeChain(() => scoresResolve);
const defaultChain       = makeChain(() => ({ data: null, error: null }));

const mockFrom = jest.fn((table) => {
  if (table === 'mol_leerlingen')      return leerlingenChain;
  if (table === 'mol_antwoorden')      return antwoordenChain;
  if (table === 'mol_groep_stemmen')   return groepStemmenChain;
  if (table === 'mol_test_antwoorden') return testAntwChain;
  if (table === 'mol_sessies')         return sessiesChain;
  if (table === 'mol_cases')           return casesChain;
  if (table === 'mol_scores')          return scoresChain;
  return defaultChain;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

const request = require('supertest');
const app     = require('../server');

// ── Helperfunctie: stuur test-antwoord in zodat iederKlaar triggert ──────────
function stuurTestAntwoord(sessie_id = 'sessie-1') {
  return request(app)
    .post('/api/mol/test-antwoord')
    .send({
      sessie_id,
      leerling_id:      'speler-1',
      mol_verdachte_id: 'WRONG',
    });
}

// ── Gedeelde setup ────────────────────────────────────────────────────────────
function basisSetup() {
  // 2 leerlingen: 1 mol + 1 speler, n_rondes = 1
  leerlingenResolve = { data: [
    { id: 'mol-1',    is_mol: true,  groep_id: 'g1' },
    { id: 'speler-1', is_mol: false, groep_id: 'g1' },
  ], error: null };

  // Speler raadt mol NIET → geen mol-bonus (default)
  testAntwoordenResolve = { data: [
    { id: 'test-1', leerling_id: 'speler-1', mol_verdachte_id: 'WRONG' },
    { id: 'test-2', leerling_id: 'mol-1',    mol_verdachte_id: null    },
  ], error: null };

  groepStemmenResolve = { data: [], error: null };
  sessiesResolve      = { data: { id: 'sessie-1', n_rondes: 1 }, error: null };
  scoresResolve       = { data: null, error: null };
}

// ── Fix 2: mc_opties.punten voor individueel antwoord ─────────────────────────
describe('Fix 2 — berekenScoresIntern: mc_opties.punten voor individueel antwoord', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    basisSetup();
    casesResolve = { data: [
      { ronde_nr: 1, mc_opties: [{ id: 'opt-A', punten: 8 }] },
    ], error: null };
  });

  it('Test 1: mc_optie_id gevonden → totaal bevat punten uit optie (8)', async () => {
    antwoordenResolve = { data: [
      { leerling_id: 'speler-1', ronde_nr: 1, mc_optie_id: 'opt-A' },
    ], error: null };

    await stuurTestAntwoord();

    // Zoek de upsert-call voor speler-1
    const calls = scoresChain.upsert.mock.calls;
    const spelerCall = calls.find(c => c[0][0].leerling_id === 'speler-1');
    expect(spelerCall).toBeDefined();
    // Oud: 8 (indiv 8 + groep 0 + mol_geraden 0).
    // Nieuw: 8 (indiv 8 + groep 0 + mol_geraden 0 — TICKET-022, formule
    // ongewijzigd voor deze fixture: geen groepsantwoord, raadt WRONG).
    expect(spelerCall[0][0].totaal).toBe(8);
  });

  it('Test 2: mc_optie_id niet gevonden → individueel = 0', async () => {
    antwoordenResolve = { data: [
      { leerling_id: 'speler-1', ronde_nr: 1, mc_optie_id: 'onbekend' },
    ], error: null };

    await stuurTestAntwoord();

    const calls = scoresChain.upsert.mock.calls;
    const spelerCall = calls.find(c => c[0][0].leerling_id === 'speler-1');
    expect(spelerCall).toBeDefined();
    // Oud: 0. Nieuw: 0 (TICKET-022 — indiv 0 + geen groep + raadt WRONG).
    expect(spelerCall[0][0].totaal).toBe(0);
  });
});

// ── Fix 3: proportionele Mol-test bonus ──────────────────────────────────────────────────
describe('Fix 3 — berekenScoresIntern: proportionele Mol-test bonus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    antwoordenResolve = { data: [], error: null };
    groepStemmenResolve = { data: [], error: null };
    sessiesResolve = { data: { id: 'sessie-1', n_rondes: 1 }, error: null };
    casesResolve   = { data: [], error: null };
    scoresResolve  = { data: null, error: null };
  });

  it('Test 3: 2 spelers raden mol correct -> elk 25 punten (50/2)', async () => {
    leerlingenResolve = { data: [
      { id: 'mol-1',    is_mol: true,  groep_id: 'g1' },
      { id: 'speler-1', is_mol: false, groep_id: 'g1' },
      { id: 'speler-2', is_mol: false, groep_id: 'g1' },
    ], error: null };
    testAntwoordenResolve = { data: [
      { id: 't1', leerling_id: 'speler-1', mol_verdachte_id: 'mol-1' },
      { id: 't2', leerling_id: 'speler-2', mol_verdachte_id: 'mol-1' },
      { id: 't3', leerling_id: 'mol-1',    mol_verdachte_id: null    },
    ], error: null };

    await request(app)
      .post('/api/mol/test-antwoord')
      .send({ sessie_id: 'sessie-1', leerling_id: 'speler-1', mol_verdachte_id: 'mol-1' });

    const calls = scoresChain.upsert.mock.calls;
    const s1 = calls.find(c => c[0][0].leerling_id === 'speler-1');
    const s2 = calls.find(c => c[0][0].leerling_id === 'speler-2');
    // Oud: 25 (round(1/2 * 50)). Nieuw: 10 (TICKET-022 —
    // detectivePot/raders = (10+10*1)/2 = 10).
    expect(s1[0][0].totaal).toBe(10);
    expect(s2[0][0].totaal).toBe(10);
  });

  it('Test 4: 0 spelers raden mol correct -> bonus = 0 (geen deling door nul)', async () => {
    leerlingenResolve = { data: [
      { id: 'mol-1',    is_mol: true,  groep_id: 'g1' },
      { id: 'speler-1', is_mol: false, groep_id: 'g1' },
    ], error: null };
    testAntwoordenResolve = { data: [
      { id: 't1', leerling_id: 'speler-1', mol_verdachte_id: 'WRONG' },
      { id: 't2', leerling_id: 'mol-1',    mol_verdachte_id: null    },
    ], error: null };

    await stuurTestAntwoord();

    const calls = scoresChain.upsert.mock.calls;
    const s1 = calls.find(c => c[0][0].leerling_id === 'speler-1');
    // Oud: 0. Nieuw: 0 (TICKET-022 — speler raadt WRONG, geen indiv,
    // geen groep → mol_geraden 0).
    expect(s1[0][0].totaal).toBe(0);
  });

  it('Test 5: Mol krijgt 50 pts als 0 spelers hem raden', async () => {
    leerlingenResolve = { data: [
      { id: 'mol-1',    is_mol: true,  groep_id: 'g1' },
      { id: 'speler-1', is_mol: false, groep_id: 'g1' },
    ], error: null };
    testAntwoordenResolve = { data: [
      { id: 't1', leerling_id: 'speler-1', mol_verdachte_id: 'WRONG' },
      { id: 't2', leerling_id: 'mol-1',    mol_verdachte_id: null    },
    ], error: null };

    await stuurTestAntwoord();

    const calls = scoresChain.upsert.mock.calls;
    const molCall = calls.find(c => c[0][0].leerling_id === 'mol-1');
    // Oud: 50 (round(1*50)). Nieuw: 30 (TICKET-022 —
    // indiv 0 + rolbonus 10 + sabotage 0 (cases leeg) +
    // niet_ontmaskerd round((1-0/1) * (10+10*1)) = 20 → totaal 30).
    expect(molCall[0][0].totaal).toBe(30);
  });

  it('Test 6: Mol krijgt 0 pts als alle niet-mol spelers hem raden', async () => {
    leerlingenResolve = { data: [
      { id: 'mol-1',    is_mol: true,  groep_id: 'g1' },
      { id: 'speler-1', is_mol: false, groep_id: 'g1' },
    ], error: null };
    testAntwoordenResolve = { data: [
      { id: 't1', leerling_id: 'speler-1', mol_verdachte_id: 'mol-1' },
      { id: 't2', leerling_id: 'mol-1',    mol_verdachte_id: null    },
    ], error: null };

    await request(app)
      .post('/api/mol/test-antwoord')
      .send({ sessie_id: 'sessie-1', leerling_id: 'speler-1', mol_verdachte_id: 'mol-1' });

    const calls = scoresChain.upsert.mock.calls;
    const molCall = calls.find(c => c[0][0].leerling_id === 'mol-1');
    // Oud: 0 (round((1-1/1)*50)=0). Nieuw: 10 (TICKET-022 —
    // indiv 0 + rolbonus 10 + sabotage 0 +
    // niet_ontmaskerd round((1-1/1) * 20) = 0 → totaal 10).
    expect(molCall[0][0].totaal).toBe(10);
  });
});
