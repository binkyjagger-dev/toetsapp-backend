/**
 * @jest-environment jsdom
 *
 * MOL-03 Fix 3 — Scherm 10: mol-test
 * Test: submitTest() faalt als testVerdachteId niet gezet is
 * Test: submitTest() dient in zonder argument-tekst als verdachteId gezet is
 * Test: renderSpelerTest() toont geen ronde-keuze elementen
 */

const fs = require('fs');
const path = require('path');
const spelerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');

describe('MOL-03 Fix 3 — scherm 10 mol-test', () => {
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
  });

  beforeEach(() => {
    global.apiFetch.mockClear();
    global.showScreen.mockClear();
    global.testVerdachteId = null;
    global.testIngediend = false;
    document.body.innerHTML = `
      <div id="screen-speler-wacht-briefing" class="screen">
        <h2 class="page-title"></h2>
        <p class="page-sub"></p>
        <div id="speler-briefing-sectie"></div>
      </div>
      <div id="test-error" style="display:none;"></div>
      <div id="test-verdachte-keuze"></div>`;
  });

  it('submitTest() faalt als testVerdachteId niet gezet is', async () => {
    global.testVerdachteId = null;
    await global.submitTest();
    expect(global.apiFetch).not.toHaveBeenCalled();
    expect(document.getElementById('test-error').style.display).toBe('block');
  });

  it('submitTest() dient in zonder argument-tekst als verdachteId gezet is', async () => {
    global.testVerdachteId = 'sp2';
    await global.submitTest();
    expect(global.apiFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(global.apiFetch.mock.calls[0][1].body);
    expect(body.verdachte_id).toBe('sp2');
    expect(body.argument).toBeUndefined();
  });

  it('renderSpelerTest() toont geen ronde-keuze elementen', () => {
    const leerlingen = [
      { id: 'sp1', groep_id: 'g1', naam: 'Test' },
      { id: 'sp2', groep_id: 'g1', naam: 'Andere' },
    ];
    const state = { sessie: { n_rondes: 3 } };
    global.renderSpelerTest(leerlingen, state);
    const rondeKnop = document.querySelector('[id^="ronde-opt-"]');
    expect(rondeKnop).toBeNull();
  });
});
