/**
 * TICKET-013 — groep start ronde 1 automatisch na bekendmaking-countdown
 *
 * Test 1: POST /api/mol/groep-ronde-start happy path
 * Test 2: POST /api/mol/groep-ronde-start zonder groep_id -> 400
 * Test 3: bepaalGroepStatus retourneert fase 'invoer' als mol_groepen.fase='invoer'
 * Test 4: bepaalGroepStatus retourneert fase 'ronde_1' als mol_groepen.fase='briefing'
 */

// --- Per-table chain mock (patroon uit mol-flow.test.js) ---
let sessiesResolve;
let groepenResolve;
let leerlingenResolve;
let briefingKlaarResolve;
let antwoordenResolve;
let groepStemmenResolve;
let testAntwResolve;

function makeChain(getResolve) {
  const c = {
    select:      jest.fn(() => c),
    update:      jest.fn(() => c),
    eq:          jest.fn(() => c),
    single:      jest.fn(() => c),
    then: (resolve, reject) =>
      Promise.resolve(getResolve()).then(resolve, reject),
  };
  return c;
}

const sessiesChain        = makeChain(() => sessiesResolve);
const groepenChain        = makeChain(() => groepenResolve);
const leerlingenChain     = makeChain(() => leerlingenResolve);
const briefingKlaarChain  = makeChain(() => briefingKlaarResolve);
const antwoordenChain     = makeChain(() => antwoordenResolve);
const groepStemmenChain   = makeChain(() => groepStemmenResolve);
const testAntwChain       = makeChain(() => testAntwResolve);
const defaultChain        = makeChain(() => ({ data: [], error: null }));

const mockFrom = jest.fn((table) => {
  if (table === 'mol_sessies')          return sessiesChain;
  if (table === 'mol_groepen')          return groepenChain;
  if (table === 'mol_leerlingen')       return leerlingenChain;
  if (table === 'mol_briefing_klaar')   return briefingKlaarChain;
  if (table === 'mol_antwoorden')       return antwoordenChain;
  if (table === 'mol_groep_stemmen')    return groepStemmenChain;
  if (table === 'mol_test_antwoorden')  return testAntwChain;
  return defaultChain;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

const request = require('supertest');
const app     = require('../server');

// Helperfunctie: stel alle briefing-state in voor bepaalGroepStatus-tests
function setBriefingState(groepFase) {
  sessiesResolve       = { data: { id: 'sid1', status: 'briefing', huidige_ronde: null }, error: null };
  leerlingenResolve    = { data: [{ id: 'lid1', groep_id: 'gid1' }], error: null };
  briefingKlaarResolve = { data: [{ leerling_id: 'lid1' }], error: null };
  antwoordenResolve    = { data: [], error: null };
  groepStemmenResolve  = { data: [], error: null };
  testAntwResolve      = { data: [], error: null };
  groepenResolve       = { data: { fase: groepFase, ronde_nr: 1 }, error: null };
}

// ===== Test 1 + 2: nieuw endpoint =====

describe('POST /api/mol/groep-ronde-start', () => {
  afterEach(() => jest.clearAllMocks());

  it('happy path: geeft { ok: true } bij geldig sessie_id en groep_id', async () => {
    groepenResolve = { error: null };
    const res = await request(app)
      .post('/api/mol/groep-ronde-start')
      .send({ sessie_id: 'sid1', groep_id: 'gid1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('geeft HTTP 400 als groep_id ontbreekt', async () => {
    const res = await request(app)
      .post('/api/mol/groep-ronde-start')
      .send({ sessie_id: 'sid1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('groep_id');
  });
});

// ===== Test 3 + 4: bepaalGroepStatus leest mol_groepen.fase =====

describe('GET /api/mol/sessies/:id/groep-status — mol_groepen.fase (TICKET-013)', () => {
  afterEach(() => jest.clearAllMocks());

  it('retourneert fase invoer als groep.fase=invoer en alle leden klaar zijn', async () => {
    setBriefingState('invoer');
    const res = await request(app)
      .get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.status).toBe(200);
    expect(res.body.fase).toBe('invoer');
    expect(res.body.ronde_nr).toBe(1);
  });

  it('retourneert fase ronde_1 als groep.fase=briefing en alle leden klaar zijn', async () => {
    setBriefingState('briefing');
    const res = await request(app)
      .get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.status).toBe(200);
    expect(res.body.fase).toBe('ronde_1');
  });
});
