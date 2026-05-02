/**
 * TICKET-018 — Per-groep moltest-completion en reveal-overgang.
 *
 * bepaalGroepStatus moet, wanneer mol_groepen.fase='test':
 *   - alle leden compleet -> 'reveal'
 *   - deel compleet -> 'test' met wacht_op = niet-klare leden
 * En wanneer mol_groepen.fase='reveal' -> 'reveal' direct.
 *
 * POST /api/mol/sessies/:id/test moet bij completion van een groep
 *   mol_groepen.fase op 'reveal' zetten en scores berekenen.
 */

let sessiesResolve, groepenResolve, leerlingenResolve, briefingKlaarResolve,
    antwoordenResolve, groepStemmenResolve, testAntwResolve,
    casesResolve, scoresResolve;

function makeChain(getResolve) {
  const c = {
    _wantsSingle: false,
    select: jest.fn(() => c),
    update: jest.fn(() => c),
    upsert: jest.fn(() => c),
    insert: jest.fn(() => c),
    delete: jest.fn(() => c),
    eq:     jest.fn(() => c),
    single: jest.fn(() => { c._wantsSingle = true; return c; }),
    maybeSingle: jest.fn(() => { c._wantsSingle = true; return c; }),
    then:   (resolve, reject) => {
      const result = getResolve();
      const wasSingle = c._wantsSingle;
      c._wantsSingle = false;
      if (wasSingle && Array.isArray(result?.data)) {
        return Promise.resolve({ data: result.data[0], error: result.error })
          .then(resolve, reject);
      }
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return c;
}

const sessiesChain       = makeChain(() => sessiesResolve);
const groepenChain       = makeChain(() => groepenResolve);
const leerlingenChain    = makeChain(() => leerlingenResolve);
const briefingKlaarChain = makeChain(() => briefingKlaarResolve);
const antwoordenChain    = makeChain(() => antwoordenResolve);
const groepStemmenChain  = makeChain(() => groepStemmenResolve);
const testAntwChain      = makeChain(() => testAntwResolve);
const casesChain         = makeChain(() => casesResolve);
const scoresChain        = makeChain(() => scoresResolve);
const defaultChain       = makeChain(() => ({ data: [], error: null }));

const mockFrom = jest.fn((table) => {
  if (table === 'mol_sessies')         return sessiesChain;
  if (table === 'mol_groepen')         return groepenChain;
  if (table === 'mol_leerlingen')      return leerlingenChain;
  if (table === 'mol_briefing_klaar')  return briefingKlaarChain;
  if (table === 'mol_antwoorden')      return antwoordenChain;
  if (table === 'mol_groep_stemmen')   return groepStemmenChain;
  if (table === 'mol_test_antwoorden') return testAntwChain;
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

function setBaseState({
  groepFase   = 'test',
  groepRonde  = 3,
  leden       = [
    { id: 'lid1', groep_id: 'gid1', is_groepshoofd: true,  is_mol: false },
    { id: 'lid2', groep_id: 'gid1', is_groepshoofd: false, is_mol: false },
  ],
  testAntw    = [],
  briefingAll = true,
} = {}) {
  sessiesResolve = {
    data: { id: 'sid1', status: 'briefing', huidige_ronde: groepRonde, n_rondes: 3 },
    error: null,
  };
  leerlingenResolve = { data: leden, error: null };
  briefingKlaarResolve = {
    data: briefingAll ? leden.map(l => ({ leerling_id: l.id })) : [],
    error: null,
  };
  antwoordenResolve   = { data: [], error: null };
  groepStemmenResolve = { data: [], error: null };
  testAntwResolve     = { data: testAntw, error: null };
  casesResolve        = { data: [], error: null };
  scoresResolve       = { data: [], error: null };
  groepenResolve      = { data: { fase: groepFase, ronde_nr: groepRonde }, error: null };
}

describe('TICKET-018 — bepaalGroepStatus per-groep moltest', () => {
  afterEach(() => jest.clearAllMocks());

  it('AC1: 1/2 leden ingediend -> fase=test, wacht_op=[lid2]', async () => {
    setBaseState({
      groepFase: 'test',
      testAntw: [{ leerling_id: 'lid1', sessie_id: 'sid1' }],
    });
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.status).toBe(200);
    expect(res.body.fase).toBe('test');
    expect(res.body.wacht_op).toEqual(['lid2']);
  });

  it('AC2: 2/2 leden ingediend, fase=test in DB -> fase=reveal', async () => {
    setBaseState({
      groepFase: 'test',
      testAntw: [
        { leerling_id: 'lid1' },
        { leerling_id: 'lid2' },
      ],
    });
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.body.fase).toBe('reveal');
    expect(res.body.wacht_op).toEqual([]);
  });

  it('AC3: groep.fase=reveal in DB -> reveal, geen testAntw nodig', async () => {
    setBaseState({ groepFase: 'reveal', testAntw: [] });
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.body.fase).toBe('reveal');
    expect(res.body.wacht_op).toEqual([]);
  });

  it('AC4: testAntw van andere groep telt niet mee', async () => {
    setBaseState({
      groepFase: 'test',
      leden: [
        { id: 'lid1', groep_id: 'gid1', is_groepshoofd: true,  is_mol: false },
        { id: 'lid2', groep_id: 'gid1', is_groepshoofd: false, is_mol: false },
        { id: 'lid3', groep_id: 'gid2', is_groepshoofd: true,  is_mol: false },
      ],
      testAntw: [{ leerling_id: 'lid3' }],
    });
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.body.fase).toBe('test');
    expect(res.body.wacht_op.sort()).toEqual(['lid1', 'lid2'].sort());
  });
});

describe('TICKET-018 — POST /sessies/:id/test triggert reveal', () => {
  afterEach(() => jest.clearAllMocks());

  it('AC5: laatste lid -> mol_groepen.update wordt aangeroepen met fase=reveal', async () => {
    sessiesResolve = {
      data: { id: 'sid1', status: 'briefing', huidige_ronde: 3, n_rondes: 3 },
      error: null,
    };
    leerlingenResolve = {
      data: [
        { id: 'lid1', groep_id: 'gid1', is_mol: false },
        { id: 'lid2', groep_id: 'gid1', is_mol: true  },
      ],
      error: null,
    };
    // Na de upsert zijn beide leden ingediend.
    testAntwResolve = {
      data: [
        { leerling_id: 'lid1', verdachte_id: 'lid2' },
        { leerling_id: 'lid2', verdachte_id: 'lid1' },
      ],
      error: null,
    };
    antwoordenResolve   = { data: [], error: null };
    groepStemmenResolve = { data: [], error: null };
    casesResolve        = { data: [], error: null };
    scoresResolve       = { data: [], error: null };
    groepenResolve      = { data: { id: 'gid1', fase: 'test', ronde_nr: 3 }, error: null };

    groepenChain.update.mockClear();

    const res = await request(app)
      .post('/api/mol/sessies/sid1/test')
      .send({ leerling_id: 'lid2', verdachte_id: 'lid1' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(groepenChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ fase: 'reveal' })
    );
  });

  it('AC6: idempotent — groep al reveal, geen nieuwe update', async () => {
    sessiesResolve = {
      data: { id: 'sid1', status: 'briefing', huidige_ronde: 3, n_rondes: 3 },
      error: null,
    };
    leerlingenResolve = {
      data: [
        { id: 'lid1', groep_id: 'gid1', is_mol: false },
        { id: 'lid2', groep_id: 'gid1', is_mol: true  },
      ],
      error: null,
    };
    testAntwResolve = {
      data: [
        { leerling_id: 'lid1', verdachte_id: 'lid2' },
        { leerling_id: 'lid2', verdachte_id: 'lid1' },
      ],
      error: null,
    };
    antwoordenResolve   = { data: [], error: null };
    groepStemmenResolve = { data: [], error: null };
    casesResolve        = { data: [], error: null };
    scoresResolve       = { data: [], error: null };
    groepenResolve      = { data: { id: 'gid1', fase: 'reveal', ronde_nr: 3 }, error: null };

    groepenChain.update.mockClear();

    const res = await request(app)
      .post('/api/mol/sessies/sid1/test')
      .send({ leerling_id: 'lid1', verdachte_id: 'lid2' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Idempotent: groep is al reveal, geen extra update naar fase=reveal.
    const updateCalls = groepenChain.update.mock.calls
      .filter(c => c[0] && c[0].fase === 'reveal');
    expect(updateCalls.length).toBe(0);
  });
});
