const jwt = require('jsonwebtoken');

let sessiesResolve;
let leerlingenResolve;
let groepenResolve;
let casesResolve;
let antwoordenResolve;
let groepStemmenResolve;

function makeChain(getResolve) {
  const c = {
    select: jest.fn(() => c),
    order:  jest.fn(() => c),
    eq:     jest.fn(() => c),
    or:     jest.fn(() => c),
    insert: jest.fn(() => c),
    delete: jest.fn(() => c),
    update: jest.fn(() => c),
    upsert: jest.fn(() => c),
    in:     jest.fn(() => c),
    single: jest.fn(() => c),
    maybeSingle: jest.fn(() => c),
    then: (resolve, reject) => Promise.resolve(getResolve()).then(resolve, reject),
  };
  return c;
}

const sessiesChain      = makeChain(() => sessiesResolve);
const leerlingenChain   = makeChain(() => leerlingenResolve);
const groepenChain      = makeChain(() => groepenResolve);
const casesChain        = makeChain(() => casesResolve);
const antwoordenChain   = makeChain(() => antwoordenResolve);
const groepStemmenChain = makeChain(() => groepStemmenResolve);
const defaultChain      = makeChain(() => ({ data: [], error: null }));

const mockFrom = jest.fn((table) => {
  if (table === 'mol_sessies')       return sessiesChain;
  if (table === 'mol_leerlingen')    return leerlingenChain;
  if (table === 'mol_groepen')       return groepenChain;
  if (table === 'mol_cases')         return casesChain;
  if (table === 'mol_antwoorden')    return antwoordenChain;
  if (table === 'mol_groep_stemmen') return groepStemmenChain;
  return defaultChain;
});

const mockAnthropicCreate = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom, rpc: jest.fn(() => Promise.resolve({ data: null, error: null })) }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: { create: mockAnthropicCreate },
})));

const request = require('supertest');
const app = require('../server');

const JWT_SECRET = 'stanislascollege_mol_secret_2025';
const token = jwt.sign({ id: 'leraar-1', naam: 'Test' }, JWT_SECRET);

describe('Mol — nieuwe schermen en endpoints', () => {
  afterEach(() => jest.clearAllMocks());

  // ── Test 1: Login met sessie_code + speler_code ──
  it('POST /api/mol/sessies/:id/login met geldige codes', async () => {
    sessiesResolve = { data: { id: 'sessie-1', sessie_code: 'ABCD' }, error: null };
    leerlingenResolve = {
      data: { id: 'speler-1', naam: 'Anna', groep_id: 'groep-A', speler_code: 'XY12' },
      error: null,
    };

    const res = await request(app)
      .post('/api/mol/sessies/sessie-1/login')
      .send({ sessiecode: 'ABCD', spelcode: 'XY12' });

    expect(res.status).toBe(200);
    expect(res.body.naam).toBe('Anna');
    expect(res.body.groep_id).toBe('groep-A');
  });

  // ── Test 2: Login met foute spelcode ──
  it('POST /api/mol/sessies/:id/login met foute spelcode geeft 404', async () => {
    sessiesResolve = { data: { id: 'sessie-1', sessie_code: 'ABCD' }, error: null };
    leerlingenResolve = { data: null, error: null };

    const res = await request(app)
      .post('/api/mol/sessies/sessie-1/login')
      .send({ sessiecode: 'ABCD', spelcode: 'FOUT' });

    expect(res.status).toBe(404);
    expect((res.body.error || '').toLowerCase()).toMatch(/spelcode/);
  });

  // ── Test 3: POST sessie met mc_opties incl. feedback en punten ──
  it('POST /api/mol/sessies slaat opties met feedback op', async () => {
    sessiesResolve = {
      data: { id: 'mol_123', leraar_id: 'leraar-1', sessie_code: 'WXYZ' },
      error: null,
    };
    casesResolve = {
      data: [{
        id: 'case_1', ronde_nr: 1, vraag: 'Wat is X?',
        mc_opties: [
          { tekst: 'A', punten: 10, feedback: 'Goed!', correct: true },
          { tekst: 'B', punten: 0,  feedback: 'Fout!', correct: false },
        ],
      }],
      error: null,
    };

    const res = await request(app)
      .post('/api/mol/sessies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        naam: 'Sessie A',
        les_naam: 'Les A',
        vragen: [{
          vraag: 'Wat is X?',
          opties: [
            { tekst: 'A', punten: 10, feedback: 'Goed!', correct: true },
            { tekst: 'B', punten: 0,  feedback: 'Fout!', correct: false },
          ],
        }],
      });

    expect(res.status).toBe(201);
    const eersteVraag = (res.body.vragen || [])[0];
    expect(eersteVraag).toBeDefined();
    const eersteOptie = (eersteVraag.opties || [])[0];
    expect(eersteOptie).toBeDefined();
    expect(eersteOptie.feedback).toBe('Goed!');
    expect(eersteOptie.punten).toBe(10);
  });

  // ── Test 4: GET state toont opties zonder feedback/punten ──
  it('GET /api/mol/sessies/:id/state strips feedback en punten', async () => {
    sessiesResolve = {
      data: {
        id: 'sessie-1',
        status: 'ronde_1',
        vragen: [{
          vraag: 'Wat is X?',
          mc_opties: [
            { tekst: 'A', punten: 10, feedback: 'Goed!', correct: true },
            { tekst: 'B', punten: 0,  feedback: 'Fout!', correct: false },
          ],
        }],
      },
      error: null,
    };
    casesResolve = {
      data: [{
        ronde_nr: 1, vraag: 'Wat is X?',
        mc_opties: [
          { tekst: 'A', punten: 10, feedback: 'Goed!', correct: true },
          { tekst: 'B', punten: 0,  feedback: 'Fout!', correct: false },
        ],
      }],
      error: null,
    };

    const res = await request(app)
      .get('/api/mol/sessies/sessie-1/state')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const allOpties = [
      ...(res.body.vragen?.[0]?.mc_opties || []),
      ...(res.body.cases?.[0]?.mc_opties || []),
      ...(res.body.vragen?.[0]?.opties || []),
    ];
    expect(allOpties.length).toBeGreaterThan(0);
    allOpties.forEach(o => {
      expect(o.tekst).toBeDefined();
      expect(o.feedback).toBeUndefined();
      expect(o.punten).toBeUndefined();
    });
  });

  // ── Test 5: ronde-feedback na resultaat-fase ──
  it('GET /api/mol/sessies/:id/ronde-feedback bij fase resultaat', async () => {
    sessiesResolve = { data: { id: 'sessie-1', status: 'ronde_1', ronde_fase: 'discussie' }, error: null };
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', groep_id: 'groep-A', naam: 'A1' },
        { id: 'speler-A2', groep_id: 'groep-A', naam: 'A2' },
      ],
      error: null,
    };
    casesResolve = {
      data: [{
        ronde_nr: 1, vraag: 'Wat is X?',
        mc_opties: [
          { id: 'opt-a', tekst: 'A', punten: 10, feedback: 'Juist omdat X', correct: true },
          { id: 'opt-b', tekst: 'B', punten: 0,  feedback: 'Onjuist: Y',    correct: false },
        ],
      }],
      error: null,
    };
    antwoordenResolve = {
      data: [{ leerling_id: 'speler-A1', ronde_nr: 1, mc_optie_id: 'opt-a' }],
      error: null,
    };
    groepStemmenResolve = {
      data: [{ groep_id: 'groep-A', ronde_nr: 1, gekozen_argument: 'opt-a', punten: 10 }],
      error: null,
    };

    const res = await request(app)
      .get('/api/mol/sessies/sessie-1/ronde-feedback?leerling_id=speler-A1&groep_id=groep-A&ronde_nr=1');

    expect(res.status).toBe(200);
    expect(res.body.vraag_tekst).toBeDefined();
    expect(Array.isArray(res.body.opties)).toBe(true);
    const eerste = res.body.opties[0];
    expect(eerste.feedback).toBeDefined();
    expect(eerste.punten).toBeDefined();
    expect(eerste.correct).toBeDefined();
    expect(eerste.is_eigen_antwoord).toBeDefined();
    expect(eerste.is_groepsantwoord).toBeDefined();
    expect(res.body.eigen_score).toBeDefined();
  });

  // ── Test 6: ronde-feedback bij andere fase → 403 ──
  it('GET /api/mol/sessies/:id/ronde-feedback bij actieve fase geeft 403', async () => {
    sessiesResolve = { data: { id: 'sessie-1', status: 'ronde_1', ronde_fase: 'invoer' }, error: null };
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', groep_id: 'groep-A' },
        { id: 'speler-A2', groep_id: 'groep-A' },
      ],
      error: null,
    };
    antwoordenResolve = { data: [], error: null };
    groepStemmenResolve = { data: [], error: null };

    const res = await request(app)
      .get('/api/mol/sessies/sessie-1/ronde-feedback?leerling_id=speler-A1&groep_id=groep-A&ronde_nr=1');

    expect(res.status).toBe(403);
  });

  // ── Test 7: genereer-feedback via AI ──
  it('POST /api/mol/genereer-feedback retourneert feedback', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Dit antwoord is juist omdat vraag en aanbod elkaar in evenwicht brengen via de prijs.' }],
    });

    const res = await request(app)
      .post('/api/mol/genereer-feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vraag: 'Wat is marktevenwicht?',
        optie: 'De prijs waar vraag en aanbod gelijk zijn',
        correct: true,
        les_content: 'Economie H1',
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.feedback).toBe('string');
    expect(res.body.feedback.length).toBeGreaterThanOrEqual(20);
  });

  // ── Test 8: mol-voorstel ──
  it('GET /api/mol/sessies/:id/mol-voorstel per groep', async () => {
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', groep_id: 'groep-A', naam: 'A1' },
        { id: 'speler-A2', groep_id: 'groep-A', naam: 'A2' },
        { id: 'speler-A3', groep_id: 'groep-A', naam: 'A3' },
      ],
      error: null,
    };

    const res = await request(app)
      .get('/api/mol/sessies/sessie-1/mol-voorstel?groep_id=groep-A')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(['speler-A1', 'speler-A2', 'speler-A3']).toContain(res.body.voorstel_id);
  });

  // ── Test 9: spelcodes genereren ──
  it('POST /api/mol/sessies/:id/genereer-spelcodes', async () => {
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', naam: 'Anna' },
        { id: 'speler-A2', naam: 'Bob' },
        { id: 'speler-A3', naam: 'Cara' },
      ],
      error: null,
    };

    const res = await request(app)
      .post('/api/mol/sessies/sessie-1/genereer-spelcodes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.spelcodes)).toBe(true);
    expect(res.body.spelcodes.length).toBe(3);
    const codes = res.body.spelcodes.map(s => s.spelcode);
    expect(new Set(codes).size).toBe(3);
    codes.forEach(c => expect(c).toHaveLength(4));
    res.body.spelcodes.forEach(s => {
      expect(s.leerling_id).toBeDefined();
      expect(s.naam).toBeDefined();
    });
  });
});
