const jwt = require('jsonwebtoken');

let classesResolve;

function makeChain(getResolve) {
  const c = {
    select: jest.fn(() => c),
    eq:     jest.fn(() => c),
    order:  jest.fn(() => c),
    then: (resolve, reject) => Promise.resolve(getResolve()).then(resolve, reject),
  };
  return c;
}

const classesChain = makeChain(() => classesResolve);
const defaultChain = makeChain(() => ({ data: [], error: null }));

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

describe('GET /api/classes/public — onbeveiligd', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 without token', async () => {
    classesResolve = {
      data: [{ id: 'k1', name: 'HAVO 3', leraar_id: 'l1' }],
      error: null,
    };

    const res = await request(app).get('/api/classes/public');

    expect(res.status).toBe(200);
  });

  it('response contains only id and name, not leraar_id', async () => {
    classesResolve = {
      data: [{ id: 'k1', name: 'HAVO 3' }],
      error: null,
    };

    const res = await request(app).get('/api/classes/public');

    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).not.toHaveProperty('leraar_id');
  });

  it('GET /api/classes without token remains 401', async () => {
    const res = await request(app).get('/api/classes');

    expect(res.status).toBe(401);
  });
});
