const jwt = require('jsonwebtoken');

// ── Chainable Supabase mock ─────────────────────────────────
let classesResolve;
let defaultResolve = { data: [], error: null };

function makeChain(getResolve) {
  const c = {
    select: jest.fn(() => c),
    eq:     jest.fn(() => c),
    or:     jest.fn(() => c),
    order:  jest.fn(() => c),
    in:     jest.fn(() => c),
    then: (resolve, reject) => Promise.resolve(getResolve()).then(resolve, reject),
  };
  return c;
}

const classesChain = makeChain(() => classesResolve);
const defaultChain = makeChain(() => defaultResolve);

const mockFrom = jest.fn((table) => {
  if (table === 'classes') return classesChain;
  return defaultChain;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

const request = require('supertest');
const app = require('../server');

const JWT_SECRET = 'stanislascollege_mol_secret_2025';
const token = jwt.sign({ id: 'leraar-1', naam: 'Test Leraar' }, JWT_SECRET);

describe('Auth — beveiligde endpoints', () => {
  afterEach(() => jest.clearAllMocks());

  it('GET /api/lessons zonder token geeft 401', async () => {
    const res = await request(app).get('/api/lessons');
    expect(res.status).toBe(401);
  });

  it('GET /api/classes zonder token geeft 401', async () => {
    const res = await request(app).get('/api/classes');
    expect(res.status).toBe(401);
  });

  it('GET /api/classes met token retourneert eigen klassen', async () => {
    classesResolve = {
      data: [{ id: '1', name: 'Eco 4V', leraar_id: 'leraar-1' }],
      error: null,
    };

    const res = await request(app)
      .get('/api/classes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: '1', name: 'Eco 4V', leraar_id: 'leraar-1' }]);
  });

  it('GET /api/classes met token filtert klassen met leraar_id=null weg', async () => {
    classesResolve = {
      data: [{ id: '2', name: 'Wis 3H', leraar_id: null }],
      error: null,
    };

    const res = await request(app)
      .get('/api/classes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
