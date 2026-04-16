const jwt = require('jsonwebtoken');

// ── Chainable Supabase mock ─────────────────────────────────
// Supports: .select().eq().order().order()...  (GET)
//           .insert([...]).select()             (POST)
let resolveValue;
const chain = {
  select: jest.fn(() => chain),
  eq:     jest.fn(() => chain),
  order:  jest.fn(() => chain),
  insert: jest.fn(() => chain),
  then: (resolve, reject) => Promise.resolve(resolveValue).then(resolve, reject),
};
const mockFrom = jest.fn(() => chain);

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

const request = require('supertest');
const app = require('../server');

const JWT_SECRET = 'stanislascollege_mol_secret_2025';
const tokenA = jwt.sign({ id: 'leraar-A', naam: 'Leraar A' }, JWT_SECRET);
const tokenB = jwt.sign({ id: 'leraar-B', naam: 'Leraar B' }, JWT_SECRET);

describe('GET /api/leerdoelen', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns leerdoelen belonging to leraar A', async () => {
    const doelen = [
      { id: 1, lesdoel: 'Vraag en aanbod', leraar_id: 'leraar-A' },
      { id: 2, lesdoel: 'Marktevenwicht',  leraar_id: 'leraar-A' },
    ];
    resolveValue = { data: doelen, error: null };

    const res = await request(app)
      .get('/api/leerdoelen')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(doelen);
    expect(chain.eq).toHaveBeenCalledWith('leraar_id', 'leraar-A');
  });

  it('returns empty array for leraar B with no leerdoelen', async () => {
    resolveValue = { data: [], error: null };

    const res = await request(app)
      .get('/api/leerdoelen')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(chain.eq).toHaveBeenCalledWith('leraar_id', 'leraar-B');
  });
});

describe('POST /api/leerdoelen', () => {
  afterEach(() => jest.clearAllMocks());

  it('stores leraar_id from token in insert', async () => {
    const created = { id: 99, lesdoel: 'BBP berekenen', leraar_id: 'leraar-A' };
    resolveValue = { data: [created], error: null };

    const res = await request(app)
      .post('/api/leerdoelen')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ niveau: 'havo-4', type: 'kennen', lesdoel: 'BBP berekenen' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);

    const inserted = chain.insert.mock.calls[0][0][0];
    expect(inserted.leraar_id).toBe('leraar-A');
    expect(inserted.lesdoel).toBe('BBP berekenen');
  });
});
