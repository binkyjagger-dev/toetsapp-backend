/**
 * @jest-environment jsdom
 *
 * TICKET-009 -- initSpelerFlow() DOM-veiligheid
 * Verifieert dat de functie niet crasht als speler-naam-tag /
 * speler-topbar-right niet in het DOM staan, en dat
 * wacht-briefing-naam correct gevuld wordt.
 */

const fs = require('fs');
const path = require('path');
const spelerPath = path.join(
  __dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js'
);

describe('initSpelerFlow DOM-veiligheid', () => {
  beforeAll(() => {
    global.sessieId             = 'test-sessie';
    global.speler               = { id: 'sp1', groep_id: 'g1', naam: 'Anna', is_mol: false };
    global.sessieState          = null;
    global.lastRenderedFase     = null;
    global.geselecteerdeOptie   = null;
    global.geselecteerdeLidId   = null;
    global.geselecteerdeMcOptieId = null;
    global.testIngediend        = false;
    global.testVerdachteId      = null;
    global.testRondeNr          = null;
    global.briefingGedrukt      = false;
    global.briefingGerenderd    = false;
    global.bekendmakingGetoond  = false;
    global.pollTimer            = null;
    global.heartbeatTimer       = null;
    global.showScreen           = jest.fn();
    global.toast                = jest.fn();
    global.apiFetch             = jest.fn().mockResolvedValue({});
    global.escH                 = (s) => String(s);
    global.startPoll            = jest.fn();
    global.stopPoll             = jest.fn();
    global.stopHeartbeat        = jest.fn();
    global.getFaseTimerSec      = jest.fn(() => 120);
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    const src = fs.readFileSync(spelerPath, 'utf8');
    const indirectEval = eval;
    indirectEval(src);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Minimale DOM: wacht-briefing-naam aanwezig,
    // speler-naam-tag en speler-topbar-right bestaan NIET
    document.body.innerHTML = '<div id="wacht-briefing-naam">-</div>';
    global.speler = { id: 'sp1', groep_id: 'g1', naam: 'Anna', is_mol: false };
  });

  test('crasht niet als speler-naam-tag ontbreekt', () => {
    expect(() => initSpelerFlow()).not.toThrow();
  });

  test('vult wacht-briefing-naam met spelernaam en bereikt showScreen', () => {
    initSpelerFlow();
    expect(document.getElementById('wacht-briefing-naam').textContent)
      .toBe('Anna');
    expect(global.showScreen)
      .toHaveBeenCalledWith('screen-speler-wacht-briefing');
  });

  test('crasht niet als speler-topbar-right ontbreekt en is_mol true is', () => {
    global.speler = { id: 'sp1', groep_id: 'g1', naam: 'Anna', is_mol: true };
    expect(() => initSpelerFlow()).not.toThrow();
  });
});
