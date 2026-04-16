const jwt = require('jsonwebtoken');

// ── Supabase chain mock ──────────────────────────────────────
// Chain: from().update().eq()  (clear)
//        from().update().in()  (link)
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEq, in: mockIn }));
const mockFrom = jest.fn(() => ({ update: mockUpdate }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));

jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

const request = require('supertest');
const app = require('../server');

const JWT_SECRET = 'stanislascollege_mol_secret_2025';
const token = jwt.sign({ id: 'leraar-1', naam: 'Test Leraar' }, JWT_SECRET);

describe('POST /api/leerlingen/koppel-klas', () => {
  afterEach(() => jest.clearAllMocks());

  it('happy path: clears old links then couples 2 students', async () => {
    // Stub: clear succeeds, link succeeds
    mockEq.mockResolvedValue({ error: null });
    mockIn.mockResolvedValue({ error: null });

    const res = await request(app)
      .post('/api/leerlingen/koppel-klas')
      .set('Authorization', `Bearer ${token}`)
      .send({ leerling_ids: ['id1', 'id2'], klas_naam: 'HAVO 3' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, bijgewerkt: 2 });

    // update() called twice: once for clear (klas: null), once for link (klas: "HAVO 3")
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenNthCalledWith(1, { klas: null });
    expect(mockUpdate).toHaveBeenNthCalledWith(2, { klas: 'HAVO 3' });

    // clear used .eq, link used .in
    expect(mockEq).toHaveBeenCalledWith('klas', 'HAVO 3');
    expect(mockIn).toHaveBeenCalledWith('id', ['id1', 'id2']);
  });

  it('returns 400 when leerling_ids is missing', async () => {
    const res = await request(app)
      .post('/api/leerlingen/koppel-klas')
      .set('Authorization', `Bearer ${token}`)
      .send({ klas_naam: 'HAVO 3' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'leerling_ids verplicht' });
  });

  it('returns 500 when supabase link-update fails', async () => {
    // Clear succeeds, but the actual link step fails
    mockEq.mockResolvedValue({ error: null });
    mockIn.mockResolvedValue({ error: { message: 'DB fout' } });

    const res = await request(app)
      .post('/api/leerlingen/koppel-klas')
      .set('Authorization', `Bearer ${token}`)
      .send({ leerling_ids: ['id1'], klas_naam: 'HAVO 3' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'DB fout' });
  });
});
