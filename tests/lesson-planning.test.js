const jwt = require('jsonwebtoken');

// ── Per-table chain mock ─────────────────────────────────────
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
    upsert: jest.fn(() => c),
    single: jest.fn(() => c),
    in:     jest.fn(() => c),
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

describe('Les plannen in klasoverzicht', () => {
  afterEach(() => jest.clearAllMocks());

  // ── Test 1: POST met lesson_date ────────────────────────────
  it('POST /api/lesson_classes creates a planning row', async () => {
    junctionResolve = {
      data: { lesson_id: 'les-1', class_id: 'klas-1', lesson_date: '2025-04-20', feedback: null },
      error: null,
    };

    const res = await request(app)
      .post('/api/lesson_classes')
      .set('Authorization', `Bearer ${token}`)
      .send({ lesson_id: 'les-1', class_id: 'klas-1', lesson_date: '2025-04-20' });

    expect(res.status).toBe(201);
    expect(res.body.lesson_id).toBe('les-1');
    expect(res.body.class_id).toBe('klas-1');
    expect(res.body.lesson_date).toBe('2025-04-20');
    expect(res.body.feedback).toBeNull();
  });

  // ── Test 2: POST zonder lesson_date ─────────────────────────
  it('POST /api/lesson_classes without lesson_date sets null', async () => {
    junctionResolve = {
      data: { lesson_id: 'les-1', class_id: 'klas-1', lesson_date: null, feedback: null },
      error: null,
    };

    const res = await request(app)
      .post('/api/lesson_classes')
      .set('Authorization', `Bearer ${token}`)
      .send({ lesson_id: 'les-1', class_id: 'klas-1' });

    expect(res.status).toBe(201);
    expect(res.body.lesson_date).toBeNull();
  });

  // ── Test 3: POST duplicate geeft 409 ───────────────────────
  it('POST /api/lesson_classes duplicate returns 409', async () => {
    junctionResolve = {
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    };

    const res = await request(app)
      .post('/api/lesson_classes')
      .set('Authorization', `Bearer ${token}`)
      .send({ lesson_id: 'les-1', class_id: 'klas-1' });

    expect(res.status).toBe(409);
  });

  // ── Test 4: PATCH feedback ──────────────────────────────────
  it('PATCH /api/lesson_classes updates feedback', async () => {
    junctionResolve = {
      data: { lesson_id: 'les-1', class_id: 'klas-1', lesson_date: '2025-04-20', feedback: 'Top: goede vragen. Tip: meer tijd.' },
      error: null,
    };

    const res = await request(app)
      .patch('/api/lesson_classes/les-1/klas-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ feedback: 'Top: goede vragen. Tip: meer tijd.' });

    expect(res.status).toBe(200);
    expect(res.body.feedback).toBe('Top: goede vragen. Tip: meer tijd.');
  });

  // ── Test 5: PATCH lesson_date ───────────────────────────────
  it('PATCH /api/lesson_classes updates lesson_date', async () => {
    junctionResolve = {
      data: { lesson_id: 'les-1', class_id: 'klas-1', lesson_date: '2025-05-01', feedback: null },
      error: null,
    };

    const res = await request(app)
      .patch('/api/lesson_classes/les-1/klas-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ lesson_date: '2025-05-01' });

    expect(res.status).toBe(200);
    expect(res.body.lesson_date).toBe('2025-05-01');
  });

  // ── Test 6: GET enriched met lesson_date + feedback ─────────
  it('GET /api/lessons?class_id includes lesson_date and feedback', async () => {
    junctionResolve = {
      data: [
        { lesson_id: 'les-1', class_id: 'klas-1', lesson_date: '2025-04-20', feedback: 'Goed gedaan' },
      ],
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
    expect(res.body[0].lesson_date).toBe('2025-04-20');
    expect(res.body[0].feedback).toBe('Goed gedaan');
  });
});
