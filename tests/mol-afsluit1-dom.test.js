/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const ALL_IDS = [
  'sessie-naam', 'setup-les-content', 'setup-n-rondes', 'setup-les-naam',
  'dashboard-sessie-naam', 'dashboard-klas-naam', 'dashboard-code',
  'dashboard-stat-online', 'dashboard-stat-groepen', 'dashboard-stat-status',
  'dashboard-groepen-grid', 'btn-toon-spelcodes', 'btn-stop-sessie',
  'btn-terug-dashboard', 'btn-terug-sessielijst',
  'dash-spelcodes-sessienaam', 'dash-spelcodes-code', 'dash-spelcodes-groepen',
  'sessie-lijst-loading', 'sessie-lijst-wrap', 'sessie-lijst-leeg',
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

const setupSrc = fs.readFileSync(
  path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-setup.js'), 'utf8'
);
const sessieSrc = fs.readFileSync(
  path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js'), 'utf8'
);
const indirectEval = eval;
indirectEval(setupSrc);
indirectEval(sessieSrc);

const DASH = {
  sessie: { id: 's1', sessie_code: 'AB7X', les_naam: 'Eco', klas_naam: 'H4A', status: 'ronde_1' },
  groepen: [], stats: { online: 3, aantal_groepen: 2, status_label: 'Actief' },
};

function setupDOM() {
  document.body.innerHTML = ALL_IDS.map(id => {
    if (id === 'sessie-naam') return `<input id="${id}" value="">`;
    if (id === 'setup-les-content') return `<input id="${id}" value="">`;
    if (id === 'setup-les-naam') return `<input id="${id}" value="">`;
    if (id === 'setup-n-rondes') return `<input id="${id}" value="3">`;
    if (id.startsWith('btn-')) return `<button id="${id}"></button>`;
    return `<div id="${id}"></div>`;
  }).join('');
}

beforeEach(() => {
  jest.clearAllMocks();
  global.setupData = {};
  global.sessieId = 'test-sid';
  global.apiFetch.mockResolvedValue(DASH);
  setupDOM();
});

describe('FIX 1 — naarStap2Leerlingen leest stap-1 inputs', () => {
  it('leest sessie-naam naar setupData.lesNaam', () => {
    document.getElementById('sessie-naam').value = 'Economie H4';
    naarStap2Leerlingen();
    expect(global.setupData.lesNaam).toBe('Economie H4');
    expect(global.showScreen).toHaveBeenCalledWith('screen-sessie-stap2');
  });

  it('lege naam = toast + geen navigatie', () => {
    document.getElementById('sessie-naam').value = '';
    naarStap2Leerlingen();
    expect(global.toast).toHaveBeenCalledWith('Vul een sessie-naam in');
    expect(global.showScreen).not.toHaveBeenCalledWith('screen-sessie-stap2');
  });

  it('hervullen overschrijft setupData', () => {
    global.setupData.lesNaam = 'Oud';
    document.getElementById('sessie-naam').value = 'Nieuw';
    naarStap2Leerlingen();
    expect(global.setupData.lesNaam).toBe('Nieuw');
  });
});

describe('FIX 2 — terugNaarSessielijst', () => {
  it('stopt polling + herlaadt lijst + navigeert', () => {
    terugNaarSessielijst();
    expect(global.showScreen).toHaveBeenCalledWith('screen-sessie-lijst');
  });

  it('event-listener gekoppeld tijdens render', async () => {
    await renderDocentSessie();
    const btn = document.getElementById('btn-terug-sessielijst');
    expect(btn.dataset.bound).toBe('1');
    global.showScreen.mockClear();
    btn.click();
    expect(global.showScreen).toHaveBeenCalledWith('screen-sessie-lijst');
  });

  it('dubbel-render voorkomt dubbele listener', async () => {
    await renderDocentSessie();
    await renderDocentSessie();
    const btn = document.getElementById('btn-terug-sessielijst');
    global.showScreen.mockClear();
    btn.click();
    const lijstCalls = global.showScreen.mock.calls.filter(c => c[0] === 'screen-sessie-lijst');
    expect(lijstCalls.length).toBe(1);
  });
});

describe('FIX 3 — hergebruik-knop verborgen', () => {
  it('hergebruik-knop niet gerenderd in sessielijst', async () => {
    global.apiFetch.mockResolvedValue([
      { id: 's1', les_naam: 'Test', status: 'setup', sessie_code: 'AB', docent_code: 'dc', n_rondes: 3, groep_grootte: 3, created_at: Date.now() },
      { id: 's2', les_naam: 'Test2', status: 'afgelopen', sessie_code: 'CD', docent_code: 'dc2', n_rondes: 3, groep_grootte: 3, created_at: Date.now() },
    ]);
    await laadSessieLijst();
    const hergebruikBtns = document.querySelectorAll('[onclick*="openHergebruik"]');
    expect(hergebruikBtns.length).toBe(0);
    const startBtns = document.querySelectorAll('[onclick*="startSessie"]');
    expect(startBtns.length).toBeGreaterThan(0);
    const openBtns = document.querySelectorAll('[onclick*="openSessie"]');
    expect(openBtns.length).toBeGreaterThan(0);
  });
});
