/**
 * @jest-environment jsdom
 *
 * MOL-03 Fix 1 — Scherm 8: groepsantwoord bevestiging
 * Test: submitGroepsantwoord navigeert naar screen-speler-groepsantwoord
 * Test: renderGroepsantwoordBevestiging vult antwoordtekst in
 * Test: na 5 seconden wordt pollSpelerStatus aangeroepen
 */

const fs = require('fs');
const path = require('path');
const spelerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');

describe('MOL-03 Fix 1 — scherm 8 na submitGroepsantwoord', () => {
  beforeAll(() => {
    global.sessieId = 'test-sessie';
    global.speler = { id: 'sp1', groep_id: 'g1', naam: 'Test', is_groepshoofd: true, ronde_nr: 1 };
    global.sessieState = { leerlingen: [
      { id: 'sp1', groep_id: 'g1', naam: 'Test', is_groepshoofd: true }
    ]};
    global.geselecteerdeOptie = 'A';
    global.lastRenderedFase = null;
    global.briefingGedrukt = false;
    global.briefingGerenderd = false;
    global.bekendmakingGetoond = false;
    global.testIngediend = false;
    global.testVerdachteId = null;
    global.testRondeNr = null;
    global.geselecteerdeLidId = null;
    global.geselecteerdeMcOptieId = null;
    global.pollTimer = null;
    global.heartbeatTimer = null;
    global.huidigeRondeNr = 1;
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
    // Vervang pollSpelerStatus door een spy na eval (wordt opgezocht via global)
    global.pollSpelerStatus = jest.fn();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    global.showScreen.mockClear();
    global.apiFetch.mockClear();
    global.pollSpelerStatus.mockClear();
    global.geselecteerdeOptie = 'A';
    document.body.innerHTML = `
      <div id="screen-speler-groepsantwoord" class="screen">
        <div id="groepsantwoord-tekst"></div>
        <span id="groepsantwoord-door"></span>
        <span id="groepsantwoord-countdown"></span>
      </div>`;
  });

  afterEach(() => { jest.useRealTimers(); });

  it('submitGroepsantwoord navigeert naar screen-speler-groepsantwoord na succes', async () => {
    await global.submitGroepsantwoord();
    expect(global.showScreen).toHaveBeenCalledWith('screen-speler-groepsantwoord');
  });

  it('renderGroepsantwoordBevestiging vult groepsantwoord-tekst in', () => {
    global.renderGroepsantwoordBevestiging('B');
    expect(document.getElementById('groepsantwoord-tekst').textContent).toBe('B');
  });

  it('na 5 seconden wordt pollSpelerStatus aangeroepen', () => {
    global.renderGroepsantwoordBevestiging('C');
    expect(global.pollSpelerStatus).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5000);
    expect(global.pollSpelerStatus).toHaveBeenCalledTimes(1);
  });
});
