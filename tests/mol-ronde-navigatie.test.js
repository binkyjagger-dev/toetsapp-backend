/**
 * @jest-environment jsdom
 *
 * MOL-03 Fix 2 — naarVolgendeRondeOfTest navigatie-logica
 * Test: start poll als ronde < n_rondes
 * Test: toont scherm 10 (screen-speler-test) als ronde === n_rondes
 */

const fs = require('fs');
const path = require('path');
const spelerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');

describe('MOL-03 Fix 2 — naarVolgendeRondeOfTest', () => {
  beforeAll(() => {
    global.sessieId = 'test-sessie';
    global.speler = { id: 'sp1', groep_id: 'g1', naam: 'Test', is_groepshoofd: false };
    global.sessieState = null;
    global.lastRenderedFase = null;
    global.briefingGedrukt = false;
    global.briefingGerenderd = false;
    global.bekendmakingGetoond = false;
    global.testIngediend = false;
    global.testVerdachteId = null;
    global.testRondeNr = null;
    global.geselecteerdeOptie = null;
    global.geselecteerdeLidId = null;
    global.geselecteerdeMcOptieId = null;
    global.pollTimer = null;
    global.heartbeatTimer = null;
    global.showScreen = jest.fn();
    global.toast = jest.fn();
    global.apiFetch = jest.fn().mockResolvedValue({});
    global.escH = (s) => String(s);
    global.startPoll = jest.fn();
    global.stopPoll = jest.fn();
    global.stopHeartbeat = jest.fn();
    global.getFaseTimerSec = jest.fn(() => 120);
    global.localStorage = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
    const src = fs.readFileSync(spelerPath, 'utf8');
    const indirectEval = eval;
    indirectEval(src);
    global.renderSpelerTest = jest.fn();
  });

  beforeEach(() => {
    global.showScreen.mockClear();
    global.startPoll.mockClear();
    global.renderSpelerTest.mockClear();
  });

  it('start poll als huidige_ronde < n_rondes', () => {
    global.sessieState = { sessie: { huidige_ronde: 1, n_rondes: 3 }, leerlingen: [] };
    global.naarVolgendeRondeOfTest();
    expect(global.startPoll).toHaveBeenCalledWith(global.pollSpelerStatus, 3500);
    expect(global.showScreen).not.toHaveBeenCalledWith('screen-speler-test');
  });

  it('toont screen-speler-test als huidige_ronde === n_rondes', () => {
    global.sessieState = { sessie: { huidige_ronde: 3, n_rondes: 3 }, leerlingen: [] };
    global.naarVolgendeRondeOfTest();
    expect(global.showScreen).toHaveBeenCalledWith('screen-speler-test');
    expect(global.startPoll).not.toHaveBeenCalled();
  });
});
