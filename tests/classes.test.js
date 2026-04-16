const jwt = require('jsonwebtoken');

// ── Mock Supabase ────────────────────────────────────────────
const mockOrder = jest.fn();
const mockEq = jest.fn(() => ({ order: mockOrder }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));

// ── Mock Anthropic ───────────────────────────────────────────
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn(() => ({}));
});

const request = require('supertest');
const app = require('../server');

const JWT_SECRET = 'stanislascollege_mol_secret_2025';
const token = jwt.sign({ id: 'leraar-1', naam: 'Test' }, JWT_SECRET);

describe('GET /api/classes', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with an array of classes', async () => {
    const fakeClasses = [
      { id: '1', name: '3V Economie', leraar_id: 'leraar-1' },
      { id: '2', name: '4H Wiskunde', leraar_id: 'leraar-1' },
    ];
    mockOrder.mockResolvedValue({ data: fakeClasses, error: null });

    const res = await request(app)
      .get('/api/classes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toEqual(fakeClasses);
    expect(mockFrom).toHaveBeenCalledWith('classes');
  });

  it('returns 500 when supabase errors', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'DB down' } });

    const res = await request(app)
      .get('/api/classes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'DB down' });
  });
});
