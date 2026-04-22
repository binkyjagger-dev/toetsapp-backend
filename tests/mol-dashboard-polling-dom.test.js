/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

jest.useFakeTimers();

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

const mockLocalStorage = { store: {}, setItem(k, v) { this.store[k] = v; }, getItem(k) { return this.store[k] || null; } };
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage, writable: true });

const src = fs.readFileSync(
  path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js'), 'utf8'
);
const indirectEval = eval;
indirectEval(src);

const HAPPY = {
  sessie: { id: 's1', sessie_code: 'AB7X', les_naam: 'Eco', klas_naam: 'H4A', status: 'ronde_1' },
  groepen: [], stats: { online: 3, aantal_groepen: 2, status_label: 'Actief' },
};

function flushPromises() {
  return new Promise(jest.requireActual('timers').setImmediate);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  stopDashboardPolling();
  global.sessieId = 'test-sid';
  global.apiFetch.mockResolvedValue(HAPPY);
  document.body.innerHTML = DASHBOARD_IDS.map(id => `<div id="${id}"></div>`).join('');
});

describe('dashboard polling', () => {
  it('eerste render start polling', async () => {
    await renderDocentSessie();
    expect(global.apiFetch).toHaveBeenCalledTimes(1);
    global.apiFetch.mockResolvedValue(HAPPY);
    jest.advanceTimersByTime(4000);
    await flushPromises();
    expect(global.apiFetch).toHaveBeenCalledTimes(2);
  });

  it('polling tick doet fetch', async () => {
    await renderDocentSessie();
    global.apiFetch.mockResolvedValue(HAPPY);
    jest.advanceTimersByTime(4000);
    await flushPromises();
    expect(global.apiFetch).toHaveBeenCalledTimes(2);
  });

  it('tab verborgen = geen fetch', async () => {
    await renderDocentSessie();
    const count = global.apiFetch.mock.calls.length;
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
    jest.advanceTimersByTime(4000);
    await flushPromises();
    expect(global.apiFetch).toHaveBeenCalledTimes(count);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
  });

  it('tab terug zichtbaar = fetch weer', async () => {
    await renderDocentSessie();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
    jest.advanceTimersByTime(4000);
    await flushPromises();
    const countHidden = global.apiFetch.mock.calls.length;
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    global.apiFetch.mockResolvedValue(HAPPY);
    jest.advanceTimersByTime(4000);
    await flushPromises();
    expect(global.apiFetch).toHaveBeenCalledTimes(countHidden + 1);
  });

  it('stopDashboardPolling stopt fetches', async () => {
    await renderDocentSessie();
    stopDashboardPolling();
    const count = global.apiFetch.mock.calls.length;
    jest.advanceTimersByTime(8000);
    await flushPromises();
    expect(global.apiFetch).toHaveBeenCalledTimes(count);
  });

  it('dubbele start = één interval', async () => {
    await renderDocentSessie();
    startDashboardPolling();
    const count = global.apiFetch.mock.calls.length;
    global.apiFetch.mockResolvedValue(HAPPY);
    jest.advanceTimersByTime(4000);
    await flushPromises();
    expect(global.apiFetch).toHaveBeenCalledTimes(count + 1);
  });

  it('3 fouten = één toast', async () => {
    await renderDocentSessie();
    global.toast.mockClear();
    global.apiFetch.mockRejectedValue(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(4000);
      await flushPromises();
    }
    const hapertCalls = global.toast.mock.calls.filter(c => c[0] === 'Verbinding hapert');
    expect(hapertCalls.length).toBe(1);
  });

  it('initial fetch faalt = geen polling', async () => {
    global.apiFetch.mockRejectedValue(new Error('down'));
    await renderDocentSessie();
    expect(global.toast).toHaveBeenCalledWith('Netwerkfout');
    expect(global.showScreen).toHaveBeenCalledWith('screen-sessie-lijst');
    const count = global.apiFetch.mock.calls.length;
    jest.advanceTimersByTime(8000);
    await flushPromises();
    expect(global.apiFetch).toHaveBeenCalledTimes(count);
  });

  it('stopPolling reset fout-counter', async () => {
    await renderDocentSessie();
    global.apiFetch.mockRejectedValue(new Error('x'));
    jest.advanceTimersByTime(4000);
    await flushPromises();
    jest.advanceTimersByTime(4000);
    await flushPromises();
    stopDashboardPolling();
    startDashboardPolling();
    global.apiFetch.mockRejectedValue(new Error('y'));
    global.toast.mockClear();
    jest.advanceTimersByTime(4000);
    await flushPromises();
    expect(global.toast).not.toHaveBeenCalledWith('Verbinding hapert');
  });
});
