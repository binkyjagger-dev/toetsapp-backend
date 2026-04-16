const jwt = require('jsonwebtoken');

// ── Chainable Supabase mock ─────────────────────────────────
let resolveValue;
const chain = {
  select: jest.fn(() => chain),
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
const token = jwt.sign({ id: 'leraar-42', naam: 'Mw. de Vries' }, JWT_SECRET);

describe('POST /api/lessons', () => {
  afterEach(() => jest.clearAllMocks());

  it('does NOT send leerdoelen to Supabase (schema safety)', async () => {
    resolveValue = { data: [{ id: 'les-1', name: 'Les 1' }], error: null };

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: 'les-1', name: 'Les 1', content: 'Inhoud',
        leerdoelen: ['doel-a', 'doel-b'], created_at: '2025-01-01',
      });

    expect(res.status).toBe(200);
    const inserted = chain.insert.mock.calls[0][0][0];
    expect(inserted).not.toHaveProperty('leerdoelen');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 'les-1', content: 'Inhoud' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Velden ontbreken' });
  });

  it('stores leraar_id from JWT token', async () => {
    resolveValue = { data: [{ id: 'les-2', name: 'Les 2', leraar_id: 'leraar-42' }], error: null };

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: 'les-2', name: 'Les 2', content: 'Inhoud', created_at: '2025-01-01' });

    expect(res.status).toBe(200);
    const inserted = chain.insert.mock.calls[0][0][0];
    expect(inserted.leraar_id).toBe('leraar-42');
  });
});
