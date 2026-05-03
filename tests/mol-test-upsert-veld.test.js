/**
 * TICKET-020 — POST /api/mol/sessies/:id/test
 *
 * De DB-tabel mol_test_antwoorden heeft kolom mol_verdachte_id, niet
 * verdachte_id. Het endpoint moet de body-parameter verdachte_id mappen
 * naar DB-veld mol_verdachte_id en upsert-errors propageren als 500.
 */

let leerlingenResolve, groepenResolve, testAntwResolve;

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

const leerlingenChain = makeChain(() => leerlingenResolve);
const groepenChain    = makeChain(() => groepenResolve);
const testAntwChain   = makeChain(() => testAntwResolve);
const defaultChain    = makeChain(() => ({ data: [], error: null }));

const mockFrom = jest.fn((table) => {
  if (table === 'mol_leerlingen')      return leerlingenChain;
  if (table === 'mol_groepen')         return groepenChain;
  if (table === 'mol_test_antwoorden') return testAntwChain;
  return defaultChain;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

const request = require('supertest');
const app     = require('../server');

describe('TICKET-020 — POST /sessies/:id/test mapt naar mol_verdachte_id', () => {
  beforeEach(() => {
    leerlingenResolve = {
      data: [{ id: 'lid1', groep_id: 'gid1', is_mol: false }],
      error: null,
    };
    groepenResolve = { data: { fase: 'test' }, error: null };
    testAntwResolve = { error: null };
    jest.clearAllMocks();
  });

  it('AC1: upsert ontvangt mol_verdachte_id (niet verdachte_id)', async () => {
    const res = await request(app)
      .post('/api/mol/sessies/sid1/test')
      .send({ leerling_id: 'lid1', verdachte_id: 'lid_mol' });

    expect(res.status).toBe(200);
    expect(testAntwChain.upsert).toHaveBeenCalled();
    const upsertArg = testAntwChain.upsert.mock.calls[0][0];
    expect(Array.isArray(upsertArg)).toBe(true);
    expect(upsertArg[0]).toHaveProperty('mol_verdachte_id', 'lid_mol');
    expect(upsertArg[0]).not.toHaveProperty('verdachte_id');
  });

  it('AC2: upsert error -> 500 met message', async () => {
    testAntwResolve = {
      error: { message: 'column "verdachte_id" does not exist' },
    };
    const res = await request(app)
      .post('/api/mol/sessies/sid1/test')
      .send({ leerling_id: 'lid1', verdachte_id: 'lid_mol' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/column/);
  });
});
