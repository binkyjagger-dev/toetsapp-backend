let sessiesResolve, groepenResolve, leerlingenResolve, antwoordenResolve,
    groepStemmenResolve, briefingKlaarResolve, scoresResolve,
    testAntwoordenResolve, casesResolve;

function makeChain(getResolve) {
  const c = {
    select: jest.fn(() => c),
    update: jest.fn(() => c),
    eq:     jest.fn(() => c),
    single: jest.fn(() => c),
    maybeSingle: jest.fn(() => c),
    then:   (resolve, reject) =>
              Promise.resolve(getResolve()).then(resolve, reject),
  };
  return c;
}

const sessiesChain       = makeChain(() => sessiesResolve);
const groepenChain       = makeChain(() => groepenResolve);
const leerlingenChain    = makeChain(() => leerlingenResolve);
const antwoordenChain    = makeChain(() => antwoordenResolve);
const groepStemmenChain  = makeChain(() => groepStemmenResolve);
const briefingKlaarChain = makeChain(() => briefingKlaarResolve);
const scoresChain        = makeChain(() => scoresResolve);
const testAntwChain      = makeChain(() => testAntwoordenResolve);
const casesChain         = makeChain(() => casesResolve);
const defaultChain       = makeChain(() => ({ data: [], error: null }));

const mockFrom = jest.fn((table) => {
  if (table === 'mol_sessies')         return sessiesChain;
  if (table === 'mol_groepen')         return groepenChain;
  if (table === 'mol_leerlingen')      return leerlingenChain;
  if (table === 'mol_antwoorden')      return antwoordenChain;
  if (table === 'mol_groep_stemmen')   return groepStemmenChain;
  if (table === 'mol_briefing_klaar')  return briefingKlaarChain;
  if (table === 'mol_scores')          return scoresChain;
  if (table === 'mol_test_antwoorden') return testAntwChain;
  if (table === 'mol_cases')           return casesChain;
  return defaultChain;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

const request = require('supertest');
const app     = require('../server');

function setBaseState({ rondeNr = 1, vraagtype = 'mc', antwoordRondeNr = null } = {}) {
  sessiesResolve    = { data: { id: 'sid1', status: 'briefing', n_rondes: 3 }, error: null };
  groepenResolve    = { data: { id: 'gid1', ronde_nr: rondeNr }, error: null };
  leerlingenResolve = { data: [
    { id: 'lid1', naam: 'A1', groep_id: 'gid1', is_groepshoofd: true  },
    { id: 'lid2', naam: 'A2', groep_id: 'gid1', is_groepshoofd: false },
  ], error: null };
  antwoordenResolve = { data: [
    { leerling_id: 'lid2', ronde_nr: antwoordRondeNr ?? rondeNr, antwoord: 'optieX', mc_optie_id: 'optieX' },
  ], error: null };
  casesResolve = { data: [
    { sessie_id: 'sid1', ronde_nr: 1, vraag: 'Vraag 1?', vraagtype,
      mc_opties: vraagtype === 'mc'
        ? [{ id: 'A', tekst: 'Optie A', correct: false }, { id: 'B', tekst: 'Optie B', correct: true }]
        : [] },
    { sessie_id: 'sid1', ronde_nr: 2, vraag: 'Vraag 2?', vraagtype: 'mc',
      mc_opties: [{ id: 'X', tekst: 'Optie X', correct: false }] },
  ], error: null };
  groepStemmenResolve  = { data: [], error: null };
  briefingKlaarResolve = { data: [], error: null };
  scoresResolve        = { data: [], error: null };
  testAntwoordenResolve = { data: [], error: null };
}

describe('TICKET-016 — /discussie-data retourneert vraag en opties', () => {
  afterEach(() => jest.clearAllMocks());

  it('AC1 + AC3: vraag_tekst en ronde_nr komen uit mol_cases en mol_groepen', async () => {
    setBaseState({ rondeNr: 1 });
    const res = await request(app)
      .get('/api/mol/sessies/sid1/discussie-data?leerling_id=lid2&groep_id=gid1');
    expect(res.status).toBe(200);
    expect(res.body.vraag_tekst).toBe('Vraag 1?');
    expect(res.body.ronde_nr).toBe(1);
  });

  it('AC2: opties zonder correct-veld', async () => {
    setBaseState({ rondeNr: 1 });
    const res = await request(app)
      .get('/api/mol/sessies/sid1/discussie-data?leerling_id=lid2&groep_id=gid1');
    expect(res.body.opties).toEqual([
      { id: 'A', tekst: 'Optie A' },
      { id: 'B', tekst: 'Optie B' },
    ]);
    res.body.opties.forEach(o => expect(o).not.toHaveProperty('correct'));
  });

  it('AC4: eigen_antwoord komt uit huidige ronde (niet ronde 1)', async () => {
    sessiesResolve    = { data: { id: 'sid1', status: 'briefing', n_rondes: 3 }, error: null };
    groepenResolve    = { data: { id: 'gid1', ronde_nr: 2 }, error: null };
    leerlingenResolve = { data: [
      { id: 'lid2', naam: 'A2', groep_id: 'gid1', is_groepshoofd: false },
    ], error: null };
    antwoordenResolve = { data: [
      { leerling_id: 'lid2', ronde_nr: 1, antwoord: 'oudR1' },
      { leerling_id: 'lid2', ronde_nr: 2, antwoord: 'nieuwR2' },
    ], error: null };
    casesResolve = { data: [
      { sessie_id: 'sid1', ronde_nr: 1, vraag: 'Vraag 1?', vraagtype: 'mc', mc_opties: [] },
      { sessie_id: 'sid1', ronde_nr: 2, vraag: 'Vraag 2?', vraagtype: 'mc', mc_opties: [] },
    ], error: null };
    groepStemmenResolve = { data: [], error: null };

    const res = await request(app)
      .get('/api/mol/sessies/sid1/discussie-data?leerling_id=lid2&groep_id=gid1');
    expect(res.body.ronde_nr).toBe(2);
    expect(res.body.vraag_tekst).toBe('Vraag 2?');
    expect(res.body.eigen_antwoord?.antwoord).toBe('nieuwR2');
  });

  it('AC5: open-vraag retourneert opties=[] en vraagtype=open', async () => {
    setBaseState({ rondeNr: 1, vraagtype: 'open' });
    const res = await request(app)
      .get('/api/mol/sessies/sid1/discussie-data?leerling_id=lid2&groep_id=gid1');
    expect(res.body.vraagtype).toBe('open');
    expect(res.body.opties).toEqual([]);
    expect(res.status).toBe(200);
  });

  it('AC6: bestaande velden blijven aanwezig en correct', async () => {
    setBaseState({ rondeNr: 1 });
    const res = await request(app)
      .get('/api/mol/sessies/sid1/discussie-data?leerling_id=lid2&groep_id=gid1');
    expect(res.body.eigen_antwoord).toBeDefined();
    expect(res.body.andere_antwoorden).toEqual([]);
    expect(res.body.groepshoofd_naam).toBe('A1');
    expect(res.body.is_groepshoofd).toBe(false);
  });
});
