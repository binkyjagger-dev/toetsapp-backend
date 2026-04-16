const jwt = require('jsonwebtoken');

// ── Per-table chain mock ─────────────────────────────────────
// from('lessons') → lessonsChain,  from('classes') → classesChain
let lessonsResolve;
let classesResolve;

function makeChain(getResolve) {
  const c = {
    select: jest.fn(() => c),
    order:  jest.fn(() => c),
    eq:     jest.fn(() => c),
    then: (resolve, reject) => Promise.resolve(getResolve()).then(resolve, reject),
  };
  return c;
}
const lessonsChain = makeChain(() => lessonsResolve);
const classesChain = makeChain(() => classesResolve);

const mockFrom = jest.fn((table) => {
  if (table === 'classes') return classesChain;
  return lessonsChain;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

const request = require('supertest');
const app = require('../server');

const JWT_SECRET = 'stanislascollege_mol_secret_2025';
const token = jwt.sign({ id: 'leraar-1', naam: 'Test' }, JWT_SECRET);

describe('GET /api/lessons — enriched response', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns klassen array [{id, name}] per lesson', async () => {
    lessonsResolve = {
      data: [
        { id: 'les-1', name: 'Les A', class_id: 'klas-A', content: 'x' },
        { id: 'les-2', name: 'Les B', class_id: 'klas-B', content: 'y' },
      ],
      error: null,
    };
    classesResolve = {
      data: [
        { id: 'klas-A', name: 'HAVO 3' },
        { id: 'klas-B', name: 'VWO 4' },
      ],
      error: null,
    };

    const res = await request(app)
      .get('/api/lessons')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].klassen).toEqual([{ id: 'klas-A', name: 'HAVO 3' }]);
    expect(res.body[1].klassen).toEqual([{ id: 'klas-B', name: 'VWO 4' }]);
  });

  it('returns werkvorm field per lesson', async () => {
    lessonsResolve = {
      data: [
        { id: 'les-1', name: 'A', content: 'x', toegestane_lesvormen: ['mol'] },
        { id: 'les-2', name: 'B', content: 'y', toegestane_lesvormen: ['socratisch'] },
      ],
      error: null,
    };
    classesResolve = { data: [], error: null };

    const res = await request(app)
      .get('/api/lessons')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].werkvorm).toBe('mol');
    expect(res.body[1].werkvorm).toBe('socratisch');
  });

  it('returns klassen: [] and werkvorm: null when missing', async () => {
    lessonsResolve = {
      data: [
        { id: 'les-1', name: 'Kaal', content: 'z', class_id: null, toegestane_lesvormen: null },
      ],
      error: null,
    };
    classesResolve = { data: [], error: null };

    const res = await request(app)
      .get('/api/lessons')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].klassen).toEqual([]);
    expect(res.body[0].werkvorm).toBeNull();
  });
});
