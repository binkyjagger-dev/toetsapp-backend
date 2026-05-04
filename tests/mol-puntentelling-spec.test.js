/**
 * TICKET-022 — Nieuwe puntenverdeling-spec.
 *
 * Spec: zie tickets/TICKET-022.md "Achtergrond".
 * Constants: lib/scoreConfig.js
 *
 * Patroon (kopie van mol-puntentelling-intern.test.js):
 * berekenScoresIntern wordt getriggerd via POST /api/mol/test-antwoord
 * zodra alle niet-mollen een test-antwoord hebben ingeleverd. Score-output
 * leest uit de mock van mol_scores.upsert.
 */

const SCORE = require('../lib/scoreConfig');

let leerlingenResolve, antwoordenResolve, groepStemmenResolve,
    testAntwResolve, sessieResolve, casesResolve;

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

const leerlingenChain   = makeChain(() => leerlingenResolve);
const antwoordenChain   = makeChain(() => antwoordenResolve);
const groepStemmenChain = makeChain(() => groepStemmenResolve);
const testAntwChain     = makeChain(() => testAntwResolve);
const sessieChain       = makeChain(() => sessieResolve);
const casesChain        = makeChain(() => casesResolve);
const scoresChain       = makeChain(() => ({ data: null, error: null }));
const defaultChain      = makeChain(() => ({ data: null, error: null }));

const mockFrom = jest.fn((table) => {
  if (table === 'mol_leerlingen')      return leerlingenChain;
  if (table === 'mol_antwoorden')      return antwoordenChain;
  if (table === 'mol_groep_stemmen')   return groepStemmenChain;
  if (table === 'mol_test_antwoorden') return testAntwChain;
  if (table === 'mol_sessies')         return sessieChain;
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

function findScore(leerlingId) {
  const calls = scoresChain.upsert.mock.calls;
  const c = calls.find(call => call[0][0].leerling_id === leerlingId);
  return c ? c[0][0] : null;
}

// Klassieke fixture: 1 mol + 4 niet-mollen, n_rondes=3.
// MC: 'a' = 10pt (max), 'b' = 0pt.
// Niet-mollen: r1+r2 alle 'a'; r3 -> n1='b' (fout), n2-n4='a'.
// Mol: 'b' elke ronde (sabotage).
// Groepsstemmen: r1 correct, r2 fout, r3 correct.
// Test: n1 raadt mol correct ('m'), n2-n4 raden 'n1' (fout), mol stemt null.
function fixtureKlassiek() {
  sessieResolve = { data: { id: 'sid', n_rondes: 3 }, error: null };
  leerlingenResolve = { data: [
    { id: 'm',  is_mol: true,  groep_id: 'g' },
    { id: 'n1', is_mol: false, groep_id: 'g' },
    { id: 'n2', is_mol: false, groep_id: 'g' },
    { id: 'n3', is_mol: false, groep_id: 'g' },
    { id: 'n4', is_mol: false, groep_id: 'g' },
  ], error: null };
  casesResolve = { data: [1, 2, 3].map(r => ({
    sessie_id: 'sid', ronde_nr: r,
    mc_opties: [
      { id: 'a', punten: 10 },
      { id: 'b', punten: 0  },
    ],
  })), error: null };
  antwoordenResolve = { data: [
    { leerling_id: 'm',  ronde_nr: 1, mc_optie_id: 'b' },
    { leerling_id: 'n1', ronde_nr: 1, mc_optie_id: 'a' },
    { leerling_id: 'n2', ronde_nr: 1, mc_optie_id: 'a' },
    { leerling_id: 'n3', ronde_nr: 1, mc_optie_id: 'a' },
    { leerling_id: 'n4', ronde_nr: 1, mc_optie_id: 'a' },
    { leerling_id: 'm',  ronde_nr: 2, mc_optie_id: 'b' },
    { leerling_id: 'n1', ronde_nr: 2, mc_optie_id: 'a' },
    { leerling_id: 'n2', ronde_nr: 2, mc_optie_id: 'a' },
    { leerling_id: 'n3', ronde_nr: 2, mc_optie_id: 'a' },
    { leerling_id: 'n4', ronde_nr: 2, mc_optie_id: 'a' },
    { leerling_id: 'm',  ronde_nr: 3, mc_optie_id: 'b' },
    { leerling_id: 'n1', ronde_nr: 3, mc_optie_id: 'b' }, // fout
    { leerling_id: 'n2', ronde_nr: 3, mc_optie_id: 'a' },
    { leerling_id: 'n3', ronde_nr: 3, mc_optie_id: 'a' },
    { leerling_id: 'n4', ronde_nr: 3, mc_optie_id: 'a' },
  ], error: null };
  groepStemmenResolve = { data: [
    { groep_id: 'g', ronde_nr: 1, is_correct: true  },
    { groep_id: 'g', ronde_nr: 2, is_correct: false },
    { groep_id: 'g', ronde_nr: 3, is_correct: true  },
  ], error: null };
  testAntwResolve = { data: [
    { leerling_id: 'n1', mol_verdachte_id: 'm'  },
    { leerling_id: 'n2', mol_verdachte_id: 'n1' },
    { leerling_id: 'n3', mol_verdachte_id: 'n1' },
    { leerling_id: 'n4', mol_verdachte_id: 'n1' },
    { leerling_id: 'm',  mol_verdachte_id: null },
  ], error: null };
}

function trigger() {
  return request(app)
    .post('/api/mol/test-antwoord')
    .send({ sessie_id: 'sid', leerling_id: 'n1', mol_verdachte_id: 'm' });
}

describe('TICKET-022 — score-berekening volgens nieuwe spec', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // AC8 — config-import
  it('AC8: scoreConfig levert juiste defaults', () => {
    expect(SCORE.MC_MAX).toBe(10);
    expect(SCORE.GROEP_CORRECT).toBe(5);
    expect(SCORE.GROEP_FOUT).toBe(-2);
    expect(SCORE.MOL_ROLBONUS).toBe(10);
    expect(SCORE.SABOTAGE_PER_FOUT).toBe(3);
    expect(SCORE.DETECTIVE_BASIS).toBe(10);
    expect(SCORE.DETECTIVE_PER_RONDE).toBe(10);
  });

  // AC1
  it('AC1: niet-mol groep-bonus +5 correct, -2 fout', async () => {
    fixtureKlassiek();
    await trigger();
    const s = findScore('n1');
    expect(s).not.toBeNull();
    expect(s.opbouw.ronde_1_groep).toBe(5);
    expect(s.opbouw.ronde_2_groep).toBe(-2);
    expect(s.opbouw.ronde_3_groep).toBe(5);
  });

  // AC2 — detectivePot = 10 + 10*3 = 40, 1 rader -> 40/1 = 40
  it('AC2: rader-bonus = detectivePot/raders, niet-raders krijgen 0', async () => {
    fixtureKlassiek();
    await trigger();
    expect(findScore('n1').opbouw.mol_geraden).toBe(40);
    expect(findScore('n2').opbouw.mol_geraden).toBe(0);
    expect(findScore('n3').opbouw.mol_geraden).toBe(0);
    expect(findScore('n4').opbouw.mol_geraden).toBe(0);
  });

  // AC3 — mol koos 'b' (0 pts) elke ronde
  it('AC3: mol indivPunten per ronde = optie.punten', async () => {
    fixtureKlassiek();
    await trigger();
    const sM = findScore('m');
    expect(sM.opbouw.ronde_1_individueel).toBe(0);
    expect(sM.opbouw.ronde_2_individueel).toBe(0);
    expect(sM.opbouw.ronde_3_individueel).toBe(0);
  });

  // AC4
  it('AC4: mol rolbonus = MOL_ROLBONUS', async () => {
    fixtureKlassiek();
    await trigger();
    expect(findScore('m').opbouw.mol_rolbonus).toBe(10);
  });

  // AC5 — r1+r2: 0 fout (alle niet-mollen 'a'); r3: n1='b' -> 1 fout * 3 = 3
  it('AC5: sabotage = 3 * foutePerRonde, ongeacht groepsantwoord', async () => {
    fixtureKlassiek();
    await trigger();
    const sM = findScore('m');
    expect(sM.opbouw.ronde_1_sabotage).toBe(0);
    expect(sM.opbouw.ronde_2_sabotage).toBe(0);
    expect(sM.opbouw.ronde_3_sabotage).toBe(3);
  });

  // AC6 — (1 - 1/4) * 40 = 30
  it('AC6: niet-ontmaskerd = (1 - raders/nietMol) * pot', async () => {
    fixtureKlassiek();
    await trigger();
    expect(findScore('m').opbouw.niet_ontmaskerd).toBe(30);
  });

  // AC7 — n1 totaal: 0 indiv + 3 * (-2) groep + 0 rader = -6 → clamp 0
  it('AC7: eindclamp op 0 voor sterk negatief totaal', async () => {
    sessieResolve = { data: { id: 'sid', n_rondes: 3 }, error: null };
    leerlingenResolve = { data: [
      { id: 'm',  is_mol: true,  groep_id: 'g' },
      { id: 'n1', is_mol: false, groep_id: 'g' },
    ], error: null };
    casesResolve = { data: [1, 2, 3].map(r => ({
      sessie_id: 'sid', ronde_nr: r,
      mc_opties: [{ id: 'a', punten: 10 }, { id: 'b', punten: 0 }],
    })), error: null };
    antwoordenResolve = { data: [
      { leerling_id: 'n1', ronde_nr: 1, mc_optie_id: 'b' },
      { leerling_id: 'n1', ronde_nr: 2, mc_optie_id: 'b' },
      { leerling_id: 'n1', ronde_nr: 3, mc_optie_id: 'b' },
      { leerling_id: 'm',  ronde_nr: 1, mc_optie_id: 'b' },
      { leerling_id: 'm',  ronde_nr: 2, mc_optie_id: 'b' },
      { leerling_id: 'm',  ronde_nr: 3, mc_optie_id: 'b' },
    ], error: null };
    groepStemmenResolve = { data: [
      { groep_id: 'g', ronde_nr: 1, is_correct: false },
      { groep_id: 'g', ronde_nr: 2, is_correct: false },
      { groep_id: 'g', ronde_nr: 3, is_correct: false },
    ], error: null };
    testAntwResolve = { data: [
      { leerling_id: 'n1', mol_verdachte_id: 'WRONG' },
      { leerling_id: 'm',  mol_verdachte_id: null },
    ], error: null };

    await trigger();
    expect(findScore('n1').totaal).toBe(0);
  });

  // Edge — 0 raders: pot blijft volledig naar mol
  it('Edge: 0 raders -> mol krijgt volledige pot', async () => {
    fixtureKlassiek();
    testAntwResolve = { data: [
      { leerling_id: 'n1', mol_verdachte_id: 'WRONG' },
      { leerling_id: 'n2', mol_verdachte_id: 'WRONG' },
      { leerling_id: 'n3', mol_verdachte_id: 'WRONG' },
      { leerling_id: 'n4', mol_verdachte_id: 'WRONG' },
      { leerling_id: 'm',  mol_verdachte_id: null    },
    ], error: null };
    await trigger();
    // (1 - 0/4) * 40 = 40
    expect(findScore('m').opbouw.niet_ontmaskerd).toBe(40);
    expect(findScore('n1').opbouw.mol_geraden).toBe(0);
  });

  // Edge — alle raders correct: niet_ontmaskerd = 0, elke rader pot/4 = 10
  it('Edge: alle raders correct -> niet_ontmaskerd = 0', async () => {
    fixtureKlassiek();
    testAntwResolve = { data: [
      { leerling_id: 'n1', mol_verdachte_id: 'm' },
      { leerling_id: 'n2', mol_verdachte_id: 'm' },
      { leerling_id: 'n3', mol_verdachte_id: 'm' },
      { leerling_id: 'n4', mol_verdachte_id: 'm' },
      { leerling_id: 'm',  mol_verdachte_id: null },
    ], error: null };
    await trigger();
    expect(findScore('m').opbouw.niet_ontmaskerd).toBe(0);
    expect(findScore('n1').opbouw.mol_geraden).toBe(10);
  });

  // Edge — 1-ronde sessie: pot = 10 + 10*1 = 20
  it('Edge: 1-ronde sessie -> detectivePot = 20', async () => {
    sessieResolve = { data: { id: 'sid', n_rondes: 1 }, error: null };
    leerlingenResolve = { data: [
      { id: 'm',  is_mol: true,  groep_id: 'g' },
      { id: 'n1', is_mol: false, groep_id: 'g' },
      { id: 'n2', is_mol: false, groep_id: 'g' },
      { id: 'n3', is_mol: false, groep_id: 'g' },
      { id: 'n4', is_mol: false, groep_id: 'g' },
    ], error: null };
    casesResolve = { data: [{
      sessie_id: 'sid', ronde_nr: 1,
      mc_opties: [{ id: 'a', punten: 10 }, { id: 'b', punten: 0 }],
    }], error: null };
    antwoordenResolve = { data: [
      { leerling_id: 'm',  ronde_nr: 1, mc_optie_id: 'b' },
      { leerling_id: 'n1', ronde_nr: 1, mc_optie_id: 'a' },
      { leerling_id: 'n2', ronde_nr: 1, mc_optie_id: 'a' },
      { leerling_id: 'n3', ronde_nr: 1, mc_optie_id: 'a' },
      { leerling_id: 'n4', ronde_nr: 1, mc_optie_id: 'a' },
    ], error: null };
    groepStemmenResolve = { data: [
      { groep_id: 'g', ronde_nr: 1, is_correct: true },
    ], error: null };
    testAntwResolve = { data: [
      { leerling_id: 'n1', mol_verdachte_id: 'm' },
      { leerling_id: 'n2', mol_verdachte_id: 'WRONG' },
      { leerling_id: 'n3', mol_verdachte_id: 'WRONG' },
      { leerling_id: 'n4', mol_verdachte_id: 'WRONG' },
      { leerling_id: 'm',  mol_verdachte_id: null    },
    ], error: null };
    await trigger();
    // pot = 20, 1 rader -> 20/1 = 20
    expect(findScore('n1').opbouw.mol_geraden).toBe(20);
    // niet_ontmaskerd = (1 - 1/4) * 20 = 15
    expect(findScore('m').opbouw.niet_ontmaskerd).toBe(15);
  });
});
