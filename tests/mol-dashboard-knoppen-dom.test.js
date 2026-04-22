/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const ALL_IDS = [
  'dashboard-sessie-naam', 'dashboard-klas-naam', 'dashboard-code',
  'dashboard-stat-online', 'dashboard-stat-groepen', 'dashboard-stat-status',
  'dashboard-groepen-grid', 'btn-toon-spelcodes', 'btn-stop-sessie',
  'btn-terug-dashboard', 'dash-spelcodes-sessienaam', 'dash-spelcodes-code',
  'dash-spelcodes-groepen',
];

global.sessieId = null;
global.sessieCode = null;
global.docentCode = null;
global.sessieState = null;
global.lastRenderedFase = null;
global.lastAutoAdvance = '';
global.docentToken = 'jwt-test';
global.speler = null;
global.setupData = {};
global.groepsindeling = [];
global.pollTimer = null;
global.heartbeatTimer = null;
global.hergebruikGroepen = [];
global.hergebruikSessieId = null;
global.hergebruikDocentCode = null;
global.showScreen = jest.fn();
global.toast = jest.fn();
global.apiFetch = jest.fn();
global.escH = (s) => String(s);
global.stopHeartbeat = jest.fn();
global.confirm = jest.fn(() => true);
global.crypto = { randomUUID: () => 'test-uuid' };

const mockLS = { store: {}, setItem(k, v) { this.store[k] = v; }, getItem(k) { return this.store[k] || null; } };
Object.defineProperty(global, 'localStorage', { value: mockLS, writable: true });

const src = fs.readFileSync(
  path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js'), 'utf8'
);
const indirectEval = eval;
indirectEval(src);

const DASH = {
  sessie: { id: 's1', sessie_code: 'AB7X', les_naam: 'Eco', klas_naam: 'H4A', status: 'ronde_1' },
  groepen: [], stats: { online: 3, aantal_groepen: 2, status_label: 'Actief' },
};

const FULL_STATE = {
  sessie: { les_naam: 'Eco', sessie_code: 'AB7X' },
  leerlingen: [
    { id: 'l1', naam: 'Sara', groep_id: 'g1', speler_code: 'XY12' },
    { id: 'l2', naam: 'Tom', groep_id: 'g1', speler_code: 'ZZ99' },
  ],
  groepen: [{ id: 'g1', naam: 'Groep Rood' }],
};

function setupDOM() {
  document.body.innerHTML = ALL_IDS.map(id => {
    if (id.startsWith('btn-')) return `<button id="${id}"></button>`;
    return `<div id="${id}"></div>`;
  }).join('');
}

beforeEach(() => {
  jest.clearAllMocks();
  global.sessieId = 'test-sid';
  global.apiFetch.mockResolvedValue(DASH);
  global.confirm.mockReturnValue(true);
  setupDOM();
});

describe('dashboard knoppen', () => {
  it('stopSessie — confirm + PATCH + navigatie', async () => {
    global.apiFetch.mockResolvedValue({ ok: true });
    await stopSessie();
    expect(global.confirm).toHaveBeenCalledTimes(1);
    const patchCall = global.apiFetch.mock.calls.find(c => c[1]?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(patchCall[0]).toContain('/status');
    expect(JSON.parse(patchCall[1].body)).toEqual({ status: 'afgelopen' });
    expect(global.showScreen).toHaveBeenCalledWith('screen-sessie-lijst');
  });

  it('stopSessie — confirm false = niks', async () => {
    global.confirm.mockReturnValue(false);
    await stopSessie();
    expect(global.apiFetch).not.toHaveBeenCalled();
  });

  it('stopSessie — fout = toast, blijf op dashboard', async () => {
    global.apiFetch.mockRejectedValue(new Error('500'));
    await stopSessie();
    expect(global.toast).toHaveBeenCalledWith(expect.stringContaining('mislukt'));
    expect(global.showScreen).not.toHaveBeenCalledWith('screen-sessie-lijst');
  });

  it('stopSessie — dubbelklik-bescherming', async () => {
    let resolveFirst;
    global.apiFetch.mockImplementationOnce(() => new Promise(r => { resolveFirst = r; }));
    const p1 = stopSessie();
    const btn = document.getElementById('btn-stop-sessie');
    expect(btn.disabled).toBe(true);
    global.apiFetch.mockResolvedValue({ ok: true });
    await stopSessie();
    expect(global.apiFetch).toHaveBeenCalledTimes(1);
    resolveFirst({ ok: true });
    await p1;
  });

  it('toonSpelcodes — navigatie + data', async () => {
    global.apiFetch.mockResolvedValue(FULL_STATE);
    await toonSpelcodes();
    expect(global.showScreen).toHaveBeenCalledWith('screen-dashboard-spelcodes');
    expect(document.getElementById('dash-spelcodes-code').textContent).toBe('AB7X');
    expect(document.getElementById('dash-spelcodes-groepen').textContent).toContain('Sara');
    expect(document.getElementById('dash-spelcodes-groepen').textContent).toContain('XY12');
  });

  it('terugNaarDashboard herstart dashboard', async () => {
    global.apiFetch.mockResolvedValue(DASH);
    terugNaarDashboard();
    await new Promise(r => setTimeout(r, 10));
    expect(global.showScreen).toHaveBeenCalledWith('screen-docent-dashboard');
  });

  it('event-listener niet dubbel gehangen', async () => {
    global.apiFetch.mockResolvedValue(DASH);
    await renderDocentSessie();
    await renderDocentSessie();
    global.apiFetch.mockResolvedValue({ ok: true });
    const btn = document.getElementById('btn-stop-sessie');
    btn.click();
    await new Promise(r => setTimeout(r, 10));
    const patchCalls = global.apiFetch.mock.calls.filter(c => c[1]?.method === 'PATCH');
    expect(patchCalls.length).toBe(1);
  });
});
