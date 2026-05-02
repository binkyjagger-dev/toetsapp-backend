/**
 * TICKET-017 — POST /api/mol/groep-volgende-fase
 *
 * AC4: endpoint bestaat, valideert input, advance ronde+1 / fase=invoer.
 * AC5: idempotent — tweede call met dezelfde huidige_ronde_nr → advanced=false.
 * AC6: na advance retourneert bepaalGroepStatus fase=invoer, ronde_nr=2.
 * AC7: laatste ronde → fase=test, bepaalGroepStatus retourneert fase=test.
 * AC8: andere groep blijft ongewijzigd.
 */

let sessiesResolve, groepenResolve, leerlingenResolve, briefingKlaarResolve,
    antwoordenResolve, groepStemmenResolve, testAntwResolve;

let groepenUpdatePayload = null;

function makeChain(getResolve, onUpdate) {
  const c = {
    select: jest.fn(() => c),
    update: jest.fn((payload) => { if (onUpdate) onUpdate(payload); return c; }),
    eq:     jest.fn(() => c),
    single: jest.fn(() => c),
    then:   (resolve, reject) =>
              Promise.resolve(getResolve()).then(resolve, reject),
  };
  return c;
}

const sessiesChain       = makeChain(() => sessiesResolve);
const groepenChain       = makeChain(
  () => groepenResolve,
  (payload) => { groepenUpdatePayload = payload; }
);
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

beforeEach(() => {
  groepenUpdatePayload = null;
});

// ===== AC4 + AC6 + AC7: endpoint happy paths =====

describe('POST /api/mol/groep-volgende-fase', () => {
  afterEach(() => jest.clearAllMocks());

  it('AC4a: 200 + advanced=true bij geldige payload (volgende ronde)', async () => {
    sessiesResolve = { data: { n_rondes: 3 }, error: null };
    groepenResolve = { data: { ronde_nr: 1, fase: 'invoer' }, error: null };

    const res = await request(app)
      .post('/api/mol/groep-volgende-fase')
      .send({ sessie_id: 'sid1', groep_id: 'gid1', huidige_ronde_nr: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true, advanced: true, next: 'ronde', ronde_nr: 2,
    });
    expect(groepenUpdatePayload).toEqual({ ronde_nr: 2, fase: 'invoer' });
  });

  it('AC4b: 400 als groep_id ontbreekt', async () => {
    const res = await request(app)
      .post('/api/mol/groep-volgende-fase')
      .send({ sessie_id: 'sid1', huidige_ronde_nr: 1 });
    expect(res.status).toBe(400);
  });

  it('AC4b: 400 als huidige_ronde_nr ontbreekt', async () => {
    const res = await request(app)
      .post('/api/mol/groep-volgende-fase')
      .send({ sessie_id: 'sid1', groep_id: 'gid1' });
    expect(res.status).toBe(400);
  });

  it('AC5: tweede call met dezelfde huidige_ronde_nr → advanced=false', async () => {
    // groep.ronde_nr is al 2 (iemand heeft al geadvanced), client stuurt 1.
    sessiesResolve = { data: { n_rondes: 3 }, error: null };
    groepenResolve = { data: { ronde_nr: 2, fase: 'invoer' }, error: null };

    const res = await request(app)
      .post('/api/mol/groep-volgende-fase')
      .send({ sessie_id: 'sid1', groep_id: 'gid1', huidige_ronde_nr: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, advanced: false });
    expect(groepenUpdatePayload).toBeNull();
  });

  it('AC7: laatste ronde → fase=test, next=test', async () => {
    sessiesResolve = { data: { n_rondes: 1 }, error: null };
    groepenResolve = { data: { ronde_nr: 1, fase: 'invoer' }, error: null };

    const res = await request(app)
      .post('/api/mol/groep-volgende-fase')
      .send({ sessie_id: 'sid1', groep_id: 'gid1', huidige_ronde_nr: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, advanced: true, next: 'test' });
    expect(groepenUpdatePayload).toEqual({ fase: 'test' });
  });
});

// ===== AC6 + AC7 + AC8: bepaalGroepStatus na advance =====

function setStatus({ groepFase, rondeNr, antwoorden = [], stemmen = [] }) {
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
  groepenResolve      = { data: { fase: groepFase, ronde_nr: rondeNr }, error: null };
}

describe('TICKET-017 — bepaalGroepStatus na advance', () => {
  afterEach(() => jest.clearAllMocks());

  it('AC6: groep met fase=invoer en ronde_nr=2, geen antwoorden → invoer, ronde_nr=2, wacht_op=[allen]', async () => {
    setStatus({ groepFase: 'invoer', rondeNr: 2 });
    const res = await request(app)
      .get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.status).toBe(200);
    expect(res.body.fase).toBe('invoer');
    expect(res.body.ronde_nr).toBe(2);
    expect(res.body.wacht_op).toEqual(['lid1', 'lid2']);
  });

  it('AC7: groep met fase=test → fase=test, ronde_nr behouden, wacht_op=alle leden zonder testantwoord', async () => {
    // TICKET-018 wijzigt de fase=test-tak: zonder testAntwoorden in
    // mol_test_antwoorden zijn alle leden nog wachtende. wacht_op
    // wordt daardoor de volledige ledenlijst (was [] vóór TICKET-018).
    setStatus({ groepFase: 'test', rondeNr: 2 });
    const res = await request(app)
      .get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.status).toBe(200);
    expect(res.body.fase).toBe('test');
    expect(res.body.ronde_nr).toBe(2);
    expect(res.body.wacht_op.sort()).toEqual(['lid1', 'lid2'].sort());
  });

  it('AC8: andere groep met fase=invoer en ronde_nr=1 blijft ongewijzigd', async () => {
    setStatus({ groepFase: 'invoer', rondeNr: 1 });
    const res = await request(app)
      .get('/api/mol/sessies/sid1/groep-status?groep_id=gid1');
    expect(res.body.fase).toBe('invoer');
    expect(res.body.ronde_nr).toBe(1);
    expect(res.body.wacht_op).toEqual(['lid1', 'lid2']);
  });
});
