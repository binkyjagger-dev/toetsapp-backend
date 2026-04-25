// Tests voor Fix 1 — POST /api/mol/sessies/:id/groepsantwoord
// Verwacht: endpoint slaat punten + max_punten op in mol_groep_stemmen

let leerlingenResolve;
let groepStemmenResolve;
let casesResolve;

function makeChain(getResolve) {
  const c = {
    select:      jest.fn(() => c),
    eq:          jest.fn(() => c),
    update:      jest.fn(() => c),
    upsert:      jest.fn(() => c),
    maybeSingle: jest.fn(() => c),
    then: (resolve, reject) =>
      Promise.resolve(getResolve()).then(resolve, reject),
  };
  return c;
}

const leerlingenChain   = makeChain(() => leerlingenResolve);
const groepStemmenChain = makeChain(() => groepStemmenResolve);
const casesChain        = makeChain(() => casesResolve);
const defaultChain      = makeChain(() => ({ data: null, error: null }));

const mockFrom = jest.fn((table) => {
  if (table === 'mol_leerlingen')    return leerlingenChain;
  if (table === 'mol_groep_stemmen') return groepStemmenChain;
  if (table === 'mol_cases')         return casesChain;
  return defaultChain;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

const request = require('supertest');
const app     = require('../server');

describe('Fix 1 — POST /api/mol/sessies/:id/groepsantwoord slaat punten op', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    leerlingenResolve   = { data: { id: 'l1', is_groepshoofd: true }, error: null };
    groepStemmenResolve = { data: null, error: null };
  });

  it('slaat punten en max_punten op via update na upsert', async () => {
    casesResolve = {
      data: {
        mc_opties: [
          { id: 'opt-A', tekst: 'Antwoord A', punten: 5 },
          { id: 'opt-B', tekst: 'Antwoord B', punten: 10 },
        ],
      },
      error: null,
    };

    const res = await request(app)
      .post('/api/mol/sessies/sessie-1/groepsantwoord')
      .send({ leerling_id: 'l1', groep_id: 'g1', antwoord: 'opt-A', ronde_nr: 1 });

    expect(res.status).toBe(200);
    expect(groepStemmenChain.update).toHaveBeenCalledWith({
      punten: 5, max_punten: 10,
    });
  });

  it('punten = 0 als antwoord niet overeenkomt met een bekende optie', async () => {
    casesResolve = {
      data: {
        mc_opties: [
          { id: 'opt-A', tekst: 'Antwoord A', punten: 8 },
        ],
      },
      error: null,
    };

    const res = await request(app)
      .post('/api/mol/sessies/sessie-1/groepsantwoord')
      .send({ leerling_id: 'l1', groep_id: 'g1', antwoord: 'onbekend', ronde_nr: 1 });

    expect(res.status).toBe(200);
    expect(groepStemmenChain.update).toHaveBeenCalledWith({
      punten: 0, max_punten: 8,
    });
  });
});
