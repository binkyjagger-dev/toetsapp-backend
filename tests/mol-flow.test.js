const jwt = require('jsonwebtoken');

// ── Per-table chain mock ─────────────────────────────────────
let sessiesResolve;
let groepenResolve;
let leerlingenResolve;
let antwoordenResolve;
let groepStemmenResolve;
let briefingKlaarResolve;
let scoresResolve;
let testAntwoordenResolve;
let casesResolve;

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

const sessiesChain       = makeChain(() => sessiesResolve);
const groepenChain       = makeChain(() => groepenResolve);
const leerlingenChain    = makeChain(() => leerlingenResolve);
const antwoordenChain    = makeChain(() => antwoordenResolve);
const groepStemmenChain  = makeChain(() => groepStemmenResolve);
const briefingKlaarChain = makeChain(() => briefingKlaarResolve);
const scoresChain        = makeChain(() => scoresResolve);
const testAntwChain      = makeChain(() => testAntwoordenResolve);
const casesChain         = makeChain(() => casesResolve);
const defaultChain       = makeChain(() => ({ data: [], error: null }));

const mockFrom = jest.fn((table) => {
  if (table === 'mol_sessies')         return sessiesChain;
  if (table === 'mol_groepen')         return groepenChain;
  if (table === 'mol_leerlingen')      return leerlingenChain;
  if (table === 'mol_antwoorden')      return antwoordenChain;
  if (table === 'mol_groep_stemmen')   return groepStemmenChain;
  if (table === 'mol_briefing_klaar')  return briefingKlaarChain;
  if (table === 'mol_scores')          return scoresChain;
  if (table === 'mol_test_antwoorden') return testAntwChain;
  if (table === 'mol_cases')           return casesChain;
  return defaultChain;
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom, rpc: jest.fn(() => Promise.resolve({ data: null, error: null })) }),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({})));

const request = require('supertest');
const app = require('../server');

const JWT_SECRET = 'stanislascollege_mol_secret_2025';
const token1 = jwt.sign({ id: 'leraar-1', naam: 'Leraar 1' }, JWT_SECRET);
const token2 = jwt.sign({ id: 'leraar-2', naam: 'Leraar 2' }, JWT_SECRET);

// ═══════════════════════════════════════════════════════════════
// BLOK 1 — Sessie-eigenaarschap
// ═══════════════════════════════════════════════════════════════
describe('Mol — sessie-eigenaarschap', () => {
  afterEach(() => jest.clearAllMocks());

  it('GET /api/mol/sessies toont alleen eigen sessies', async () => {
    sessiesResolve = {
      data: [{ id: 'sessie-A', leraar_id: 'leraar-1', les_naam: 'Les A' }],
      error: null,
    };

    const res = await request(app)
      .get('/api/mol/sessies')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    const ids = (res.body || []).map(s => s.id);
    expect(ids).toContain('sessie-A');
    expect(ids).not.toContain('sessie-B');
  });

  it('GET /api/mol/sessies zonder token geeft 401', async () => {
    const res = await request(app).get('/api/mol/sessies');
    expect(res.status).toBe(401);
  });

  it('POST /api/mol/sessies koppelt leraar_id aan sessie', async () => {
    sessiesResolve = {
      data: [{ id: 'mol_123', leraar_id: 'leraar-1' }],
      error: null,
    };

    const res = await request(app)
      .post('/api/mol/sessies')
      .set('Authorization', `Bearer ${token1}`)
      .send({ les_naam: 'Test les', leerlingen: ['A', 'B'], groep_grootte: 2, n_rondes: 3 });

    expect(res.status).toBe(201);
    expect(res.body.leraar_id).toBe('leraar-1');
  });

  it('twee sessies werken onafhankelijk', async () => {
    sessiesResolve = {
      data: { id: 'sessie-A', status: 'ronde_1', leraar_id: 'leraar-1' },
      error: null,
    };
    groepenResolve = { data: [], error: null };
    leerlingenResolve = { data: [], error: null };
    casesResolve = { data: [], error: null };

    const resA = await request(app)
      .get('/api/mol/sessies/sessie-A/state')
      .set('Authorization', `Bearer ${token1}`);
    expect(resA.status).toBe(200);
    expect(resA.body.status).toBe('ronde_1');

    sessiesResolve = {
      data: { id: 'sessie-B', status: 'briefing', leraar_id: 'leraar-1' },
      error: null,
    };

    const resB = await request(app)
      .get('/api/mol/sessies/sessie-B/state')
      .set('Authorization', `Bearer ${token1}`);
    expect(resB.status).toBe(200);
    expect(resB.body.status).toBe('briefing');
  });
});

// ═══════════════════════════════════════════════════════════════
// BLOK 2 — Fase 2: Briefing
// ═══════════════════════════════════════════════════════════════
describe('Mol — fase 2: briefing (groep-onafhankelijk)', () => {
  afterEach(() => jest.clearAllMocks());

  const groepA = { id: 'groep-A', sessie_id: 'sessie-1', naam: 'Groep A' };
  const groepB = { id: 'groep-B', sessie_id: 'sessie-1', naam: 'Groep B' };
  const groepALeerlingen = [
    { id: 'speler-A1', sessie_id: 'sessie-1', groep_id: 'groep-A', naam: 'A1' },
    { id: 'speler-A2', sessie_id: 'sessie-1', groep_id: 'groep-A', naam: 'A2' },
    { id: 'speler-A3', sessie_id: 'sessie-1', groep_id: 'groep-A', naam: 'A3' },
  ];
  const groepBLeerlingen = [
    { id: 'speler-B1', sessie_id: 'sessie-1', groep_id: 'groep-B', naam: 'B1' },
    { id: 'speler-B2', sessie_id: 'sessie-1', groep_id: 'groep-B', naam: 'B2' },
    { id: 'speler-B3', sessie_id: 'sessie-1', groep_id: 'groep-B', naam: 'B3' },
  ];

  it('speler kan pas Start drukken na groepshoofd-keuze', async () => {
    const res = await request(app)
      .post('/api/mol/sessies/sessie-1/briefing-start')
      .send({ leerling_id: 'speler-A1', groepshoofd_stem: null });

    expect(res.status).toBe(400);
    expect(res.body.error || '').toMatch(/groepshoofd/i);
  });

  it('speler drukt Start na groepshoofd-keuze', async () => {
    briefingKlaarResolve = { data: null, error: null };
    leerlingenResolve = { data: groepALeerlingen[0], error: null };

    const res = await request(app)
      .post('/api/mol/sessies/sessie-1/briefing-start')
      .send({ leerling_id: 'speler-A1', groepshoofd_stem: 'speler-A2' });

    expect(res.status).toBe(200);
  });

  it('groep A wacht als niet alle spelers Start hebben gedrukt', async () => {
    sessiesResolve = { data: { id: 'sessie-1', status: 'briefing' }, error: null };
    groepenResolve = { data: [groepA, groepB], error: null };
    leerlingenResolve = { data: [...groepALeerlingen, ...groepBLeerlingen], error: null };
    briefingKlaarResolve = {
      data: [
        { leerling_id: 'speler-A1' },
        { leerling_id: 'speler-A2' },
      ],
      error: null,
    };

    const res = await request(app)
      .get('/api/mol/sessies/sessie-1/groep-status?groep_id=groep-A')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.fase).toBe('briefing');
    expect(res.body.wacht_op).toContain('speler-A3');
  });

  it('groep A gaat naar ronde_1 als alle eigen spelers Start drukten', async () => {
    sessiesResolve = { data: { id: 'sessie-1', status: 'briefing' }, error: null };
    groepenResolve = { data: [groepA, groepB], error: null };
    leerlingenResolve = { data: [...groepALeerlingen, ...groepBLeerlingen], error: null };
    briefingKlaarResolve = {
      data: [
        { leerling_id: 'speler-A1' },
        { leerling_id: 'speler-A2' },
        { leerling_id: 'speler-A3' },
      ],
      error: null,
    };

    const resA = await request(app)
      .get('/api/mol/sessies/sessie-1/groep-status?groep_id=groep-A')
      .set('Authorization', `Bearer ${token1}`);
    expect(resA.body.fase).toBe('ronde_1');

    const resB = await request(app)
      .get('/api/mol/sessies/sessie-1/groep-status?groep_id=groep-B')
      .set('Authorization', `Bearer ${token1}`);
    expect(resB.body.fase).toBe('briefing');
  });

  it('groepshoofd wordt bepaald door meerderheid', async () => {
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', groep_id: 'groep-A', groepshoofd_stem: 'speler-A2' },
        { id: 'speler-A2', groep_id: 'groep-A', groepshoofd_stem: 'speler-A2' },
        { id: 'speler-A3', groep_id: 'groep-A', groepshoofd_stem: 'speler-A1' },
      ],
      error: null,
    };

    const res = await request(app)
      .post('/api/mol/sessies/sessie-1/bepaal-groepshoofd')
      .send({ groep_id: 'groep-A' });

    expect(res.status).toBe(200);
    expect(res.body.groepshoofd_id).toBe('speler-A2');
  });

  it('bij gelijke stemmen kiest app uit koplopers', async () => {
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', groep_id: 'groep-A', groepshoofd_stem: 'speler-A2' },
        { id: 'speler-A2', groep_id: 'groep-A', groepshoofd_stem: 'speler-A3' },
        { id: 'speler-A3', groep_id: 'groep-A', groepshoofd_stem: 'speler-A1' },
      ],
      error: null,
    };

    const res = await request(app)
      .post('/api/mol/sessies/sessie-1/bepaal-groepshoofd')
      .send({ groep_id: 'groep-A' });

    expect(res.status).toBe(200);
    expect(['speler-A1', 'speler-A2', 'speler-A3']).toContain(res.body.groepshoofd_id);
  });
});

// ═══════════════════════════════════════════════════════════════
// BLOK 3 — Fase 3: Invoer
// ═══════════════════════════════════════════════════════════════
describe('Mol — fase 3: invoer (groep-onafhankelijk)', () => {
  afterEach(() => jest.clearAllMocks());

  it('speler dient antwoord in', async () => {
    antwoordenResolve = { data: null, error: null };

    const res = await request(app)
      .post('/api/mol/sessies/sessie-1/antwoord')
      .send({ leerling_id: 'speler-A1', ronde_nr: 1, antwoord: 'optie-B' });

    expect(res.status).toBe(200);
  });

  it('groep A wacht als niet alle spelers ingediend hebben', async () => {
    sessiesResolve = { data: { id: 'sessie-1', status: 'ronde_1', ronde_fase: 'invoer' }, error: null };
    groepenResolve = { data: [{ id: 'groep-A' }], error: null };
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', groep_id: 'groep-A' },
        { id: 'speler-A2', groep_id: 'groep-A' },
        { id: 'speler-A3', groep_id: 'groep-A' },
      ],
      error: null,
    };
    antwoordenResolve = {
      data: [
        { leerling_id: 'speler-A1', ronde_nr: 1 },
        { leerling_id: 'speler-A2', ronde_nr: 1 },
      ],
      error: null,
    };

    const res = await request(app)
      .get('/api/mol/sessies/sessie-1/groep-status?groep_id=groep-A')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.body.fase).toBe('invoer');
    expect(res.body.wacht_op).toContain('speler-A3');
  });

  it('groep A gaat naar discussie als alle eigen spelers ingediend hebben', async () => {
    sessiesResolve = { data: { id: 'sessie-1', status: 'ronde_1', ronde_fase: 'invoer' }, error: null };
    groepenResolve = { data: [{ id: 'groep-A' }, { id: 'groep-B' }], error: null };
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', groep_id: 'groep-A' },
        { id: 'speler-A2', groep_id: 'groep-A' },
        { id: 'speler-A3', groep_id: 'groep-A' },
        { id: 'speler-B1', groep_id: 'groep-B' },
        { id: 'speler-B2', groep_id: 'groep-B' },
        { id: 'speler-B3', groep_id: 'groep-B' },
      ],
      error: null,
    };
    antwoordenResolve = {
      data: [
        { leerling_id: 'speler-A1', ronde_nr: 1 },
        { leerling_id: 'speler-A2', ronde_nr: 1 },
        { leerling_id: 'speler-A3', ronde_nr: 1 },
      ],
      error: null,
    };

    const resA = await request(app)
      .get('/api/mol/sessies/sessie-1/groep-status?groep_id=groep-A')
      .set('Authorization', `Bearer ${token1}`);
    expect(resA.body.fase).toBe('discussie');

    const resB = await request(app)
      .get('/api/mol/sessies/sessie-1/groep-status?groep_id=groep-B')
      .set('Authorization', `Bearer ${token1}`);
    expect(resB.body.fase).toBe('invoer');
  });
});

// ═══════════════════════════════════════════════════════════════
// BLOK 4 — Fase 4: Discussie + Groepsantwoord
// ═══════════════════════════════════════════════════════════════
describe('Mol — fase 4: discussie en groepsantwoord', () => {
  afterEach(() => jest.clearAllMocks());

  it('gewone speler ziet eigen antwoord maar niet dat van anderen', async () => {
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', naam: 'A1', groep_id: 'groep-A', is_groepshoofd: true },
        { id: 'speler-A2', naam: 'A2', groep_id: 'groep-A', is_groepshoofd: false },
      ],
      error: null,
    };
    antwoordenResolve = {
      data: [{ leerling_id: 'speler-A2', ronde_nr: 1, antwoord: 'optie-A' }],
      error: null,
    };

    const res = await request(app)
      .get('/api/mol/sessies/sessie-1/discussie-data?leerling_id=speler-A2&groep_id=groep-A')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.eigen_antwoord).toBeDefined();
    expect(res.body.andere_antwoorden || []).toHaveLength(0);
  });

  it('gewone speler ziet naam van groepshoofd', async () => {
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', naam: 'A1', groep_id: 'groep-A', is_groepshoofd: true },
        { id: 'speler-A2', naam: 'A2', groep_id: 'groep-A', is_groepshoofd: false },
      ],
      error: null,
    };
    antwoordenResolve = { data: [], error: null };

    const res = await request(app)
      .get('/api/mol/sessies/sessie-1/discussie-data?leerling_id=speler-A2&groep_id=groep-A')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.body.groepshoofd_naam).toBeDefined();
    expect(res.body.groepshoofd_naam).not.toBe('');
  });

  it('gewone speler kan geen groepsantwoord indienen', async () => {
    leerlingenResolve = {
      data: { id: 'speler-A2', groep_id: 'groep-A', is_groepshoofd: false },
      error: null,
    };

    const res = await request(app)
      .post('/api/mol/sessies/sessie-1/groepsantwoord')
      .send({ leerling_id: 'speler-A2', groep_id: 'groep-A', antwoord: 'optie-B', ronde_nr: 1 });

    expect(res.status).toBe(403);
    expect(res.body.error || '').toMatch(/groepshoofd/i);
  });

  it('groepshoofd kan groepsantwoord indienen', async () => {
    leerlingenResolve = {
      data: { id: 'speler-A1', groep_id: 'groep-A', is_groepshoofd: true },
      error: null,
    };
    groepStemmenResolve = {
      data: [{ groep_id: 'groep-A', ronde_nr: 1, gekozen_argument: 'optie-B' }],
      error: null,
    };

    const res = await request(app)
      .post('/api/mol/sessies/sessie-1/groepsantwoord')
      .send({ leerling_id: 'speler-A1', groep_id: 'groep-A', antwoord: 'optie-B', ronde_nr: 1 });

    expect(res.status).toBe(200);
    expect(res.body.groepsantwoord).toBe('optie-B');
  });

  it('na groepsantwoord gaat groep A naar volgende fase', async () => {
    sessiesResolve = { data: { id: 'sessie-1', status: 'ronde_1', ronde_fase: 'discussie', n_rondes: 3 }, error: null };
    groepenResolve = { data: [{ id: 'groep-A' }, { id: 'groep-B' }], error: null };
    leerlingenResolve = { data: [], error: null };
    groepStemmenResolve = {
      data: [{ groep_id: 'groep-A', ronde_nr: 1 }],
      error: null,
    };

    const resA = await request(app)
      .get('/api/mol/sessies/sessie-1/groep-status?groep_id=groep-A')
      .set('Authorization', `Bearer ${token1}`);
    expect(['resultaat', 'ronde_2']).toContain(resA.body.fase);

    const resB = await request(app)
      .get('/api/mol/sessies/sessie-1/groep-status?groep_id=groep-B')
      .set('Authorization', `Bearer ${token1}`);
    expect(resB.body.fase).toBe('discussie');
  });
});

// ═══════════════════════════════════════════════════════════════
// BLOK 5 — Fase 5: Mol-test
// ═══════════════════════════════════════════════════════════════
describe('Mol — fase 5: mol-test (groep-onafhankelijk)', () => {
  afterEach(() => jest.clearAllMocks());

  it('gewone speler wijst één verdachte aan voor hele sessie', async () => {
    testAntwoordenResolve = { data: null, error: null };

    const res = await request(app)
      .post('/api/mol/sessies/sessie-1/test')
      .send({ leerling_id: 'speler-A2', verdachte_id: 'speler-A1' });

    expect(res.status).toBe(200);
  });

  it('Mol krijgt andere testvragen', async () => {
    leerlingenResolve = {
      data: { id: 'speler-A1', is_mol: true },
      error: null,
    };

    const res = await request(app)
      .get('/api/mol/sessies/sessie-1/test-vragen?leerling_id=speler-A1')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.is_mol).toBe(true);
    expect(Array.isArray(res.body.vragen)).toBe(true);
    expect(res.body.vragen.length).toBeGreaterThan(0);
  });

  it('groep A wacht als niet alle spelers test ingediend hebben', async () => {
    sessiesResolve = { data: { id: 'sessie-1', status: 'test' }, error: null };
    groepenResolve = { data: [{ id: 'groep-A' }], error: null };
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', groep_id: 'groep-A' },
        { id: 'speler-A2', groep_id: 'groep-A' },
        { id: 'speler-A3', groep_id: 'groep-A' },
      ],
      error: null,
    };
    testAntwoordenResolve = {
      data: [
        { leerling_id: 'speler-A2' },
        { leerling_id: 'speler-A3' },
      ],
      error: null,
    };

    const res = await request(app)
      .get('/api/mol/sessies/sessie-1/groep-status?groep_id=groep-A')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.body.fase).toBe('test');
    expect(res.body.wacht_op).toContain('speler-A1');
  });

  it('groep A gaat naar reveal als alle eigen spelers test ingediend hebben', async () => {
    sessiesResolve = { data: { id: 'sessie-1', status: 'test' }, error: null };
    groepenResolve = { data: [{ id: 'groep-A' }, { id: 'groep-B' }], error: null };
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', groep_id: 'groep-A' },
        { id: 'speler-A2', groep_id: 'groep-A' },
        { id: 'speler-A3', groep_id: 'groep-A' },
        { id: 'speler-B1', groep_id: 'groep-B' },
        { id: 'speler-B2', groep_id: 'groep-B' },
      ],
      error: null,
    };
    testAntwoordenResolve = {
      data: [
        { leerling_id: 'speler-A1' },
        { leerling_id: 'speler-A2' },
        { leerling_id: 'speler-A3' },
      ],
      error: null,
    };

    const resA = await request(app)
      .get('/api/mol/sessies/sessie-1/groep-status?groep_id=groep-A')
      .set('Authorization', `Bearer ${token1}`);
    expect(resA.body.fase).toBe('reveal');

    const resB = await request(app)
      .get('/api/mol/sessies/sessie-1/groep-status?groep_id=groep-B')
      .set('Authorization', `Bearer ${token1}`);
    expect(resB.body.fase).toBe('test');
  });
});

// ═══════════════════════════════════════════════════════════════
// BLOK 6 — Fase 6: Reveal
// ═══════════════════════════════════════════════════════════════
describe('Mol — fase 6: reveal (groep-onafhankelijk)', () => {
  afterEach(() => jest.clearAllMocks());

  it('groep A ziet reveal onafhankelijk van groep B', async () => {
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', groep_id: 'groep-A', is_mol: true },
        { id: 'speler-A2', groep_id: 'groep-A', is_mol: false },
        { id: 'speler-A3', groep_id: 'groep-A', is_mol: false },
      ],
      error: null,
    };
    scoresResolve = {
      data: [
        { leerling_id: 'speler-A2', totaal: 80 },
        { leerling_id: 'speler-A3', totaal: 60 },
      ],
      error: null,
    };

    const res = await request(app)
      .get('/api/mol/sessies/sessie-1/resultaten?groep_id=groep-A')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.mol_id).toBe('speler-A1');
    expect(Array.isArray(res.body.scores)).toBe(true);
  });

  it('winnaar is speler met meeste punten die Mol correct raadde', async () => {
    leerlingenResolve = {
      data: [
        { id: 'speler-A1', groep_id: 'groep-A', is_mol: true },
        { id: 'speler-A2', groep_id: 'groep-A', is_mol: false },
        { id: 'speler-A3', groep_id: 'groep-A', is_mol: false },
      ],
      error: null,
    };
    testAntwoordenResolve = {
      data: [
        { leerling_id: 'speler-A2', verdachte_id: 'speler-A1' },
        { leerling_id: 'speler-A3', verdachte_id: 'speler-A1' },
      ],
      error: null,
    };
    scoresResolve = {
      data: [
        { leerling_id: 'speler-A2', totaal: 80 },
        { leerling_id: 'speler-A3', totaal: 60 },
      ],
      error: null,
    };

    const res = await request(app)
      .get('/api/mol/sessies/sessie-1/resultaten?groep_id=groep-A')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.body.winnaar_id).toBe('speler-A2');
  });

  it('groep B ziet nog geen reveal', async () => {
    sessiesResolve = { data: { id: 'sessie-1', status: 'test' }, error: null };
    groepenResolve = { data: [{ id: 'groep-B' }], error: null };
    leerlingenResolve = {
      data: [
        { id: 'speler-B1', groep_id: 'groep-B' },
        { id: 'speler-B2', groep_id: 'groep-B' },
      ],
      error: null,
    };
    testAntwoordenResolve = { data: [], error: null };

    const res = await request(app)
      .get('/api/mol/sessies/sessie-1/groep-status?groep_id=groep-B')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.body.fase).not.toBe('reveal');
  });
});
