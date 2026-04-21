/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

global.sessieId = null;
global.sessieCode = null;
global.docentCode = null;
global.sessieState = null;
global.lastRenderedFase = null;
global.lastAutoAdvance = '';
global.docentToken = 'jwt-test-token';
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

beforeEach(() => {
  jest.clearAllMocks();
  global.confirm.mockReturnValue(true);
  global.apiFetch.mockResolvedValue({ ok: true });
  document.body.innerHTML = [
    'sessie-lijst-loading', 'sessie-lijst-wrap', 'sessie-lijst-leeg',
    'dashboard-sessie-naam', 'dashboard-klas-naam', 'dashboard-code',
    'dashboard-stat-online', 'dashboard-stat-groepen', 'dashboard-stat-status',
    'dashboard-groepen-grid',
  ].map(id => `<div id="${id}"></div>`).join('');
});

describe('verwijderSessie (DOM)', () => {
  it('confirm + DELETE-call zonder docent_token', async () => {
    await verwijderSessie('sid-9', 'Test Sessie');
    expect(global.confirm).toHaveBeenCalled();
    const deleteCall = global.apiFetch.mock.calls.find(
      c => c[1] && c[1].method === 'DELETE'
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall[0]).toContain('/api/mol/sessie/sid-9');
    expect(deleteCall[0]).not.toContain('docent_token');
  });

  it('confirm false doet niks', async () => {
    global.confirm.mockReturnValue(false);
    await verwijderSessie('sid-9', 'Test');
    expect(global.apiFetch).not.toHaveBeenCalled();
  });

  it('apiFetch fout toont toast zonder crash', async () => {
    global.apiFetch.mockRejectedValue(new Error('403 geen toegang'));
    await verwijderSessie('sid-9', 'Test');
    expect(global.toast).toHaveBeenCalledWith(expect.stringContaining('mislukt'));
  });

  it('succes toont toast en ververst sessielijst', async () => {
    global.apiFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce([]);
    await verwijderSessie('sid-9', 'Mijn Sessie');
    expect(global.toast).toHaveBeenCalledWith(expect.stringContaining('Mijn Sessie'));
    const secondCall = global.apiFetch.mock.calls[1];
    expect(secondCall[0]).toContain('/api/mol/sessies');
  });
});
