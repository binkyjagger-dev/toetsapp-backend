const jwt = require('jsonwebtoken');

// ── Per-table chain mock ─────────────────────────────────────
// from('lessons')        → lessonsChain
// from('classes')        → classesChain
// from('lesson_classes') → junctionChain
let lessonsResolve;
let classesResolve;
let junctionResolve;

function makeChain(getResolve) {
  const c = {
    select: jest.fn(() => c),
    order:  jest.fn(() => c),
    eq:     jest.fn(() => c),
    insert: jest.fn(() => c),
    delete: jest.fn(() => c),
    update: jest.fn(() => c),
    in:     jest.fn(() => c),
    single: jest.fn(() => c),
    then: (resolve, reject) => Promise.resolve(getResolve()).then(resolve, reject),
  };
  return c;
}

const lessonsChain  = makeChain(() => lessonsResolve);
const classesChain  = makeChain(() => classesResolve);
const junctionChain = makeChain(() => junctionResolve);

const mockFrom = jest.fn((table) => {
  if (table === 'classes')        return classesChain;
  if (table === 'lesson_classes') return junctionChain;
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

describe('Lessen — meerdere klassen (junction table)', () => {
  afterEach(() => jest.clearAllMocks());

  // ── Test 1: POST met class_ids ──────────────────────────────
  it('POST /api/lessons with class_ids returns 201 with both ids', async () => {
    lessonsResolve = {
      data: [{ id: 'les-1', name: 'Les 1', content: 'Inhoud' }],
      error: null,
    };
    junctionResolve = { data: null, error: null };

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: 'les-1', name: 'Les 1', content: 'Inhoud',
        class_ids: ['klas-1', 'klas-2'],
      });

    expect(res.status).toBe(201);
    expect(res.body.class_ids).toEqual(['klas-1', 'klas-2']);
    expect(res.body.class_ids).toHaveLength(2);
  });

  // ── Test 2: GET retourneert class_ids per les ───────────────
  it('GET /api/lessons returns class_ids array per lesson', async () => {
    lessonsResolve = {
      data: [
        { id: 'les-1', name: 'Les A', content: 'x' },
        { id: 'les-2', name: 'Les B', content: 'y' },
      ],
      error: null,
    };
    classesResolve = { data: [], error: null };
    junctionResolve = {
      data: [
        { lesson_id: 'les-1', class_id: 'klas-1' },
        { lesson_id: 'les-1', class_id: 'klas-2' },
      ],
      error: null,
    };

    const res = await request(app)
      .get('/api/lessons')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body[0].class_ids).toEqual(['klas-1', 'klas-2']);
    expect(res.body[1].class_ids).toEqual([]);
  });

  // ── Test 3: GET met class_id filter via junction ────────────
  it('GET /api/lessons?class_id=klas-1 returns only linked lessons', async () => {
    junctionResolve = {
      data: [{ lesson_id: 'les-1', class_id: 'klas-1' }],
      error: null,
    };
    lessonsResolve = {
      data: [{ id: 'les-1', name: 'Les A', content: 'x' }],
      error: null,
    };
    classesResolve = { data: [], error: null };

    const res = await request(app)
      .get('/api/lessons?class_id=klas-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('les-1');
    expect(res.body[0].class_ids).toEqual(['klas-1']);
  });

  // ── Test 4: PATCH vervangt koppelingen ──────────────────────
  it('PATCH /api/lessons/:id replaces class_ids', async () => {
    // delete old junction rows, insert new ones
    junctionResolve = { data: null, error: null };
    lessonsResolve = {
      data: { id: 'les-1', name: 'Les 1', content: 'Inhoud' },
      error: null,
    };

    const res = await request(app)
      .patch('/api/lessons/les-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ class_ids: ['klas-2'] });

    expect(res.status).toBe(200);
    expect(res.body.class_ids).toEqual(['klas-2']);
  });

  // ── Test 5: POST dedupliceert class_ids ─────────────────────
  it('POST /api/lessons deduplicates class_ids', async () => {
    lessonsResolve = {
      data: [{ id: 'les-1', name: 'Les 1', content: 'Inhoud' }],
      error: null,
    };
    junctionResolve = { data: null, error: null };

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: 'les-1', name: 'Les 1', content: 'Inhoud',
        class_ids: ['klas-1', 'klas-1'],
      });

    expect(res.status).toBe(201);
    expect(res.body.class_ids).toEqual(['klas-1']);
    expect(res.body.class_ids).toHaveLength(1);
  });
});
