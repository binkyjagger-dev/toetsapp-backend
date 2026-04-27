/**
 * @jest-environment jsdom
 *
 * TICKET-010 -- auto-start briefing
 * Verifieert dat refreshDashboardData() automatisch docentActie('briefing', 0)
 * aanroept zodra minstens een groep volledig online is en status 'setup' is.
 *
 * TICKET-011 -- twee scenario's toegevoegd:
 * - autoStartGetriggerd blijft false als docentActie gooit (fix A)
 * - docentCode wordt bijgewerkt vanuit dashboard-response (fix B)
 */

const fs = require('fs');
const path = require('path');

const DASHBOARD_IDS = [
  'dashboard-sessie-naam', 'dashboard-klas-naam', 'dashboard-code',
  'dashboard-stat-online', 'dashboard-stat-groepen', 'dashboard-stat-status',
  'dashboard-groepen-grid',
];

// Globals die docent-sessie.js verwacht
global.sessieId             = 'test-sid';
global.sessieCode           = null;
global.docentCode           = null;
global.sessieState          = null;
global.lastRenderedFase     = null;
global.lastAutoAdvance      = '';
global.docentToken          = 'jwt-test';
global.speler               = null;
global.setupData            = {};
global.groepsindeling       = [];
global.pollTimer            = null;
global.heartbeatTimer       = null;
global.hergebruikGroepen    = [];
global.hergebruikSessieId   = null;
global.hergebruikDocentCode = null;
global.showScreen           = jest.fn();
global.toast                = jest.fn();
global.apiFetch             = jest.fn();
global.escH                 = (s) => String(s);
global.stopHeartbeat        = jest.fn();
global.confirm              = jest.fn(() => true);
global.crypto               = { randomUUID: () => 'test-uuid' };

const mockLS = {
  store: {},
  setItem(k, v) { this.store[k] = v; },
  getItem(k)    { return this.store[k] || null; },
};
Object.defineProperty(global, 'localStorage', { value: mockLS, writable: true });

const src = fs.readFileSync(
  path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js'), 'utf8'
);
const indirectEval = eval;

function maakData(status, groepen, docent_code) {
  return {
    sessie: { id: 's1', sessie_code: 'AB7X', les_naam: 'Test', klas_naam: 'H4A', status, docent_code: docent_code || null },
    groepen,
    stats: { online: 1, aantal_groepen: groepen.length, status_label: 'Test' },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  global.sessieId   = 'test-sid';
  global.docentCode = null;
  document.body.innerHTML = DASHBOARD_IDS.map(id => '<div id="' + id + '"></div>').join('');
  indirectEval(src);
  global.docentActie = jest.fn().mockResolvedValue({});
  global.apiFetch    = jest.fn();
});

describe('auto-start briefing', () => {
  test('roept docentActie aan als status setup en een groep compleet is', async () => {
    const groepen = [{ id: 'g1', naam: 'A', fase: null,
      spelers: [{ id: 'sp1', naam: 'Anna', online: true }] }];
    global.apiFetch.mockResolvedValue(maakData('setup', groepen));
    await refreshDashboardData();
    expect(global.docentActie).toHaveBeenCalledWith('briefing', 0);
  });

  test('triggert niet als geen groep compleet is', async () => {
    const groepen = [
      { id: 'g1', naam: 'A', fase: null,
        spelers: [{ id: 'sp1', naam: 'Anna', online: true },
                  { id: 'sp2', naam: 'Bert', online: false }] },
      { id: 'g2', naam: 'B', fase: null, spelers: [] },
    ];
    global.apiFetch.mockResolvedValue(maakData('setup', groepen));
    await refreshDashboardData();
    expect(global.docentActie).not.toHaveBeenCalled();
  });

  test('triggert niet als status niet setup is', async () => {
    const groepen = [{ id: 'g1', naam: 'A', fase: null,
      spelers: [{ id: 'sp1', naam: 'Anna', online: true }] }];
    global.apiFetch.mockResolvedValue(maakData('ronde_1', groepen));
    await refreshDashboardData();
    expect(global.docentActie).not.toHaveBeenCalled();
  });

  test('triggert maximaal een keer (vlag werkt)', async () => {
    const groepen = [{ id: 'g1', naam: 'A', fase: null,
      spelers: [{ id: 'sp1', naam: 'Anna', online: true }] }];
    global.apiFetch.mockResolvedValue(maakData('setup', groepen));
    await refreshDashboardData();
    await refreshDashboardData();
    expect(global.docentActie).toHaveBeenCalledTimes(1);
  });

  test('autoStartGetriggerd blijft false als docentActie gooit', async () => {
    const groepen = [{ id: 'g1', naam: 'A', fase: null,
      spelers: [{ id: 'sp1', naam: 'Anna', online: true }] }];
    global.apiFetch.mockResolvedValue(maakData('setup', groepen));
    global.docentActie = jest.fn().mockRejectedValue(new Error('403 Forbidden'));
    await refreshDashboardData();
    await refreshDashboardData();
    expect(global.docentActie).toHaveBeenCalledTimes(2);
  });

  test('docentCode wordt bijgewerkt vanuit dashboard-response', async () => {
    const groepen = [{ id: 'g1', naam: 'A', fase: null, spelers: [] }];
    global.apiFetch.mockResolvedValue(maakData('setup', groepen, 'ABC123'));
    await refreshDashboardData();
    expect(global.docentCode).toBe('ABC123');
  });
});
