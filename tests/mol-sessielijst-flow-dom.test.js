/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const DASHBOARD_IDS = [
  'dashboard-sessie-naam', 'dashboard-klas-naam', 'dashboard-code',
  'dashboard-stat-online', 'dashboard-stat-groepen', 'dashboard-stat-status',
  'dashboard-groepen-grid',
];

global.sessieId = null;
global.sessieCode = null;
global.docentCode = null;
global.sessieState = null;
global.lastRenderedFase = null;
global.lastAutoAdvance = '';
global.docentToken = '';
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

const mockLocalStorage = { store: {}, setItem(k, v) { this.store[k] = v; }, getItem(k) { return this.store[k] || null; } };
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage, writable: true });

const src = fs.readFileSync(
  path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js'), 'utf8'
);
const indirectEval = eval;
indirectEval(src);

const DASHBOARD_RESPONSE = {
  sessie: { id: 's1', sessie_code: 'AB7X', les_naam: 'Eco', klas_naam: 'H4A', status: 'ronde_1' },
  groepen: [],
  stats: { online: 3, aantal_groepen: 2, status_label: 'Actief' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLocalStorage.store = {};
  global.sessieId = null;
  global.docentCode = null;
  global.sessieCode = null;
  document.body.innerHTML = DASHBOARD_IDS.map(id => `<div id="${id}"></div>`).join('');
  global.apiFetch.mockResolvedValue(DASHBOARD_RESPONSE);
});

describe('sessielijst-flow — openSessie en startSessie', () => {
  it('openSessie navigeert naar dashboard', async () => {
    openSessie('sid-1', 'dc-1', 'AB7X');
    await new Promise(r => setTimeout(r, 10));
    expect(global.sessieId).toBe('sid-1');
    expect(global.docentCode).toBe('dc-1');
    expect(global.sessieCode).toBe('AB7X');
    expect(global.showScreen).toHaveBeenCalledWith('screen-docent-dashboard');
    expect(global.showScreen).not.toHaveBeenCalledWith('screen-spelcodes');
  });

  it('startSessie navigeert naar dashboard', async () => {
    startSessie('sid-2', 'dc-2', 'CD9Y');
    await new Promise(r => setTimeout(r, 10));
    expect(global.sessieId).toBe('sid-2');
    expect(global.showScreen).toHaveBeenCalledWith('screen-docent-dashboard');
    expect(global.showScreen).not.toHaveBeenCalledWith('screen-spelcodes');
  });

  it('laadDocentSessie gaat nog steeds naar spelcodes', async () => {
    global.sessieId = 'sid-3';
    global.apiFetch.mockResolvedValue({ spelcodes: [] });
    await laadDocentSessie();
    expect(global.showScreen).toHaveBeenCalledWith('screen-spelcodes');
  });

  it('startSessie doet geen PATCH — alleen state + renderDocentSessie', async () => {
    startSessie('sid-4', 'dc-4', 'EF1Z');
    await new Promise(r => setTimeout(r, 10));
    const patchCalls = global.apiFetch.mock.calls.filter(
      c => c[1] && c[1].method === 'PATCH'
    );
    expect(patchCalls.length).toBe(0);
  });
});
