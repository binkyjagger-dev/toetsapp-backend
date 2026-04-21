/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DASHBOARD_IDS = [
  'dashboard-sessie-naam', 'dashboard-klas-naam', 'dashboard-code',
  'dashboard-stat-online', 'dashboard-stat-groepen', 'dashboard-stat-status',
  'dashboard-groepen-grid',
];

function setupDOM() {
  document.body.innerHTML = DASHBOARD_IDS.map(id =>
    `<div id="${id}"></div>`
  ).join('');
}

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

const src = fs.readFileSync(
  path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js'), 'utf8'
);
const indirectEval = eval;
indirectEval(src);

beforeEach(() => {
  jest.clearAllMocks();
  setupDOM();
  global.sessieId = 'test-sessie-123';
});

const HAPPY_RESPONSE = {
  sessie: { id: 's1', sessie_code: 'AB7X', les_naam: 'Economie H4', klas_naam: 'H4A', status: 'ronde_1' },
  groepen: [{ id: 'g1', naam: 'Groep A', fase: 'briefing', spelers: [] }],
  stats: { online: 6, aantal_groepen: 2, status_label: 'Actief' },
};

describe('renderDocentSessie (DOM)', () => {
  it('vult sessienaam en tegels bij happy path', async () => {
    global.apiFetch.mockResolvedValue(HAPPY_RESPONSE);
    await renderDocentSessie();
    expect(global.showScreen).toHaveBeenCalledWith('screen-docent-dashboard');
    expect(document.getElementById('dashboard-sessie-naam').textContent).toBe('Economie H4');
    expect(document.getElementById('dashboard-klas-naam').textContent).toBe('H4A');
    expect(document.getElementById('dashboard-code').textContent).toBe('AB7X');
    expect(document.getElementById('dashboard-stat-online').textContent).toBe('6');
    expect(document.getElementById('dashboard-stat-groepen').textContent).toBe('2');
    expect(document.getElementById('dashboard-stat-status').textContent).toBe('Actief');
  });

  it('status-actief klasse bij actieve sessie', async () => {
    global.apiFetch.mockResolvedValue(HAPPY_RESPONSE);
    await renderDocentSessie();
    const el = document.getElementById('dashboard-stat-status');
    expect(el.classList.contains('status-actief')).toBe(true);
    expect(el.classList.contains('status-gestopt')).toBe(false);
  });

  it('status-gestopt klasse bij gestopte sessie', async () => {
    global.apiFetch.mockResolvedValue({
      ...HAPPY_RESPONSE,
      stats: { ...HAPPY_RESPONSE.stats, status_label: 'Gestopt' },
    });
    await renderDocentSessie();
    const el = document.getElementById('dashboard-stat-status');
    expect(el.classList.contains('status-gestopt')).toBe(true);
    expect(el.classList.contains('status-actief')).toBe(false);
  });

  it('leeg sessieId toont toast, geen navigatie', async () => {
    global.sessieId = null;
    await renderDocentSessie();
    expect(global.toast).toHaveBeenCalledWith('Geen sessie geselecteerd');
    expect(global.showScreen).not.toHaveBeenCalledWith('screen-docent-dashboard');
    expect(global.apiFetch).not.toHaveBeenCalled();
  });

  it('netwerkfout toont toast en navigeert terug', async () => {
    global.apiFetch.mockRejectedValue(new Error('network'));
    await renderDocentSessie();
    expect(global.toast).toHaveBeenCalledWith('Netwerkfout');
    expect(global.showScreen).toHaveBeenCalledWith('screen-sessie-lijst');
  });

  it('klasse-reset bij wisseling gestopt naar actief', async () => {
    const el = document.getElementById('dashboard-stat-status');
    el.classList.add('status-gestopt');
    global.apiFetch.mockResolvedValue(HAPPY_RESPONSE);
    await renderDocentSessie();
    expect(el.classList.contains('status-actief')).toBe(true);
    expect(el.classList.contains('status-gestopt')).toBe(false);
  });

  it('ontbrekende stats veld crasht niet, toont fallback', async () => {
    global.apiFetch.mockResolvedValue({ sessie: HAPPY_RESPONSE.sessie });
    await renderDocentSessie();
    expect(document.getElementById('dashboard-stat-online').textContent).toBe('—');
    expect(document.getElementById('dashboard-stat-groepen').textContent).toBe('—');
    expect(document.getElementById('dashboard-stat-status').textContent).toBe('—');
  });
});
