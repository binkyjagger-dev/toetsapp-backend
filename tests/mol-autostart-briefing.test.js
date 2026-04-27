/**
 * @jest-environment jsdom
 *
 * TICKET-010 -- auto-start briefing
 * Verifieert dat refreshDashboardData() automatisch docentActie('briefing', 0)
 * aanroept zodra minstens een groep volledig online is en status 'setup' is.
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

function maakData(status, groepen) {
  return {
    sessie: { id: 's1', sessie_code: 'AB7X', les_naam: 'Test', klas_naam: 'H4A', status },
    groepen,
    stats: { online: 1, aantal_groepen: groepen.length, status_label: 'Test' },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  global.sessieId = 'test-sid';
  document.body.innerHTML = DASHBOARD_IDS.map(id => `<div id="${id}"></div>`).join('');
  // Re-eval reset module-level let-variabelen (incl. autoStartGetriggerd)
  indirectEval(src);
  // Mock docentActie NA de eval (eval definieert de echte functie opnieuw)
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
    await refreshDashboardData(); // eerste aanroep: triggert
    await refreshDashboardData(); // tweede aanroep: vlag staat op true
    expect(global.docentActie).toHaveBeenCalledTimes(1);
  });
});
