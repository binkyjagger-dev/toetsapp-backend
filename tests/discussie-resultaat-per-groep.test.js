/**
 * TICKET-015 — Discussie en resultaat starten per groep tijdens briefing-status.
 *
 * bepaalGroepStatus moet, wanneer sessie.status='briefing' en
 * groep.fase='invoer', dezelfde fase-afleiding doen als de ronde-tak:
 * antwoorden compleet -> 'discussie', stem aanwezig -> 'resultaat'.
 */

let sessiesResolve, groepenResolve, leerlingenResolve, briefingKlaarResolve,
    antwoordenResolve, groepStemmenResolve, testAntwResolve;

function makeChain(getResolve) {
  const c = {
    select: jest.fn(() => c),
    update: jest.fn(() => c),
    eq:     jest.fn(() => c),
    single: jest.fn(() => c),
    then:   (resolve, reject) =>
              Promise.resolve(getResolve()).then(resolve, reject),
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
const defaultChain       = makeChain(() => ({ data: [], error: null }));

const mockFrom = jest.fn((table) => {
  if (table === 'mol_sessies')         return sessiesChain;
  if (table === 'mol_groepen')         return groepenChain;
  if (table === 'mol_leerlingen')      return leerlingenChain;
  if (table === 'mol_briefing_klaar')  return briefingKlaarChain;
  if (table === 'mol_antwoorden')      return antwoordenChain;
  if (table === 'mol_groep_stemmen')   return groepStemmenChain;
  if (table === 'mol_test_antwoorden') return testAntwChain;
  return defaultChain;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

const request = require('supertest');
const app     = require('../server');

// Helper: standaard groep van 2 leerlingen, beide briefing-klaar.
function setBaseState({ groepFase = 'invoer', antwoorden = [], stemmen = [] } = {}) {
  sessiesResolve = {
    data: { id: 'sid1', status: 'briefing', huidige_ronde: null, n_rondes: 3 },
    error: null,
  };
  leerlingenResolve = {
    data: [
      { id: 'lid1', groep_id: 'gid1', is_groepshoofd: true  },
      { id: 'lid2', groep_id: 'gid1', is_groepshoofd: false },
    ],
    error: null,
  };
  briefingKlaarResolve = {
    data: [{ leerling_id: 'lid1' }, { leerling_id: 'lid2' }],
    error: null,
  };
  antwoordenResolve   = { data: antwoorden, error: null };
  groepStemmenResolve = { data: stemmen,    error: null };
  testAntwResolve     = { data: [],         error: null };
  groepenResolve      = { data: { fase: groepFase, ronde_nr: 1 }, error: null };
}

describe('TICKET-015 — bepaalGroepStatus tijdens sessie.status=briefing', () => {
  afterEach(() => jest.clearAllMocks());

  it('AC1: alle leden ingediend, geen stem -> discussie + wacht_op=[groepshoofd]', async () => {
    setBaseState({
      groepFase:  'invoer',
      antwoorden: [
        { leerling_id: 'lid1', ronde_nr: 1 },
        { leerling_id: 'lid2', ronde_nr: 1 },
      ],
      stemmen: [],
    });
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.status).toBe(200);
    expect(res.body.fase).toBe('discussie');
    expect(res.body.ronde_nr).toBe(1);
    expect(res.body.wacht_op).toEqual(['lid1']);
  });

  it('AC2: een lid heeft nog niet ingediend -> invoer + wacht_op met dat id', async () => {
    setBaseState({
      groepFase:  'invoer',
      antwoorden: [{ leerling_id: 'lid1', ronde_nr: 1 }],
    });
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.body.fase).toBe('invoer');
    expect(res.body.wacht_op).toEqual(['lid2']);
  });

  it('AC3: stem aanwezig -> resultaat + wacht_op=[]', async () => {
    setBaseState({
      groepFase:  'invoer',
      antwoorden: [
        { leerling_id: 'lid1', ronde_nr: 1 },
        { leerling_id: 'lid2', ronde_nr: 1 },
      ],
      stemmen: [{ groep_id: 'gid1', ronde_nr: 1 }],
    });
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.body.fase).toBe('resultaat');
    expect(res.body.wacht_op).toEqual([]);
  });

  it('AC5a: groep.fase=briefing en allen klaar -> ronde_1 (ongewijzigd)', async () => {
    setBaseState({ groepFase: 'briefing' });
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.body.fase).toBe('ronde_1');
  });

  it('AC5b: groep.fase=briefing en niet allen klaar -> briefing met wacht_op', async () => {
    setBaseState({ groepFase: 'briefing' });
    briefingKlaarResolve = { data: [{ leerling_id: 'lid1' }], error: null };
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.body.fase).toBe('briefing');
    expect(res.body.wacht_op).toEqual(['lid2']);
  });

  it('AC4: stem voor andere groep telt niet mee voor deze groep', async () => {
    // Antwoorden compleet, maar stem hoort bij groep "gid_X" (niet gid1)
    setBaseState({
      groepFase:  'invoer',
      antwoorden: [
        { leerling_id: 'lid1', ronde_nr: 1 },
        { leerling_id: 'lid2', ronde_nr: 1 },
      ],
      stemmen: [{ groep_id: 'gid_X', ronde_nr: 1 }],
    });
    const res = await request(app).get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.body.fase).toBe('discussie');
  });
});
