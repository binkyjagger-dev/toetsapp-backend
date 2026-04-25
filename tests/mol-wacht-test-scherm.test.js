/**
 * @jest-environment jsdom
 *
 * TICKET-007 Fix 1 — Scherm 11: wacht-test na test-indiening
 * Test 1: submitTest navigeert naar screen-speler-wacht-test
 * Test 2: renderWachtTest vult wacht-test-grid met chips voor eigen groep
 */

const fs = require('fs');
const path = require('path');
const spelerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');

describe('TICKET-007 Fix 1 — scherm 11 wacht-test', () => {
  beforeAll(() => {
    global.sessieId = 'sessie-1';
    global.speler = { id: 'l1', groep_id: 'g1', naam: 'Anna' };
    global.sessieState = { leerlingen: [] };
    global.lastRenderedFase = null;
    global.briefingGedrukt = false;
    global.briefingGerenderd = false;
    global.bekendmakingGetoond = false;
    global.testIngediend = false;
    global.testVerdachteId = 'verdachte-1';
    global.testRondeNr = null;
    global.geselecteerdeOptie = null;
    global.geselecteerdeLidId = null;
    global.geselecteerdeMcOptieId = null;
    global.pollTimer = null;
    global.heartbeatTimer = null;
    global.showScreen = jest.fn();
    global.toast = jest.fn();
    global.apiFetch = jest.fn().mockResolvedValue({ ok: true });
    global.escH = (s) => String(s);
    global.startPoll = jest.fn();
    global.stopPoll = jest.fn();
    global.stopHeartbeat = jest.fn();
    global.getFaseTimerSec = jest.fn(() => 120);
    global.localStorage = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
    const indirectEval = eval;
    indirectEval(fs.readFileSync(spelerPath, 'utf8'));
  });

  beforeEach(() => {
    global.showScreen.mockClear();
    global.apiFetch.mockClear();
    global.startPoll.mockClear();
    global.testIngediend = false;
    global.testVerdachteId = 'verdachte-1';
    document.body.innerHTML = `
      <div id="screen-speler-wacht" class="screen">
        <div class="page-title"></div>
        <div class="page-sub"></div>
        <div id="speler-briefing-sectie"></div>
      </div>
      <div id="screen-speler-wacht-test" class="screen"></div>
      <div id="wacht-test-grid"></div>
      <div id="test-error" style="display:none"></div>`;
  });

  it('submitTest navigeert naar screen-speler-wacht-test na indiening', async () => {
    await global.submitTest();
    expect(global.showScreen).toHaveBeenCalledWith('screen-speler-wacht-test');
    expect(global.showScreen).not.toHaveBeenCalledWith('screen-speler-wacht-briefing');
  });

  it('renderWachtTest vult wacht-test-grid met chips voor eigen groep', () => {
    const leerlingen = [
      { id: 'l1', groep_id: 'g1', naam: 'Anna' },
      { id: 'l2', groep_id: 'g1', naam: 'Bo' },
      { id: 'l3', groep_id: 'g2', naam: 'Cees' },
    ];
    global.renderWachtTest(leerlingen);
    const grid = document.getElementById('wacht-test-grid');
    const chips = grid.querySelectorAll('.wacht-chip');
    expect(chips.length).toBe(2);
    expect(grid.innerHTML).not.toContain('Cees');
    expect(chips[0].classList.contains('klaar')).toBe(true); // Anna = speler.id === l1
  });
});
