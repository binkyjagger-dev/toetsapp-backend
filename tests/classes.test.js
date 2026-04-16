// ── Mock Supabase ────────────────────────────────────────────
const mockOrder = jest.fn();
const mockSelect = jest.fn(() => ({ order: mockOrder }));
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

describe('GET /api/classes', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with an array of classes', async () => {
    const fakeClasses = [
      { id: '1', name: '3V Economie' },
      { id: '2', name: '4H Wiskunde' },
    ];
    mockOrder.mockResolvedValue({ data: fakeClasses, error: null });

    const res = await request(app).get('/api/classes');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toEqual(fakeClasses);
    expect(mockFrom).toHaveBeenCalledWith('classes');
  });

  it('returns 500 when supabase errors', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'DB down' } });

    const res = await request(app).get('/api/classes');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'DB down' });
  });
});
