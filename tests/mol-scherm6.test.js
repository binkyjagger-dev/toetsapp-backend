/**
 * @jest-environment jsdom
 */
// MOL-09: scherm 6 wacht-scherm na indienen individueel antwoord

const fs   = require('fs');
const path = require('path');
const spelerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');

describe('renderWachtNaIndienen', () => {
  let renderWachtNaIndienen;

  beforeAll(() => {
    global.sessieId = 'test-sessie';
    global.speler = { id: 'sp1', groep_id: 'g1', is_groepshoofd: false };
    global.sessieState = null;
    global.lastRenderedFase = null;
    global.briefingGedrukt = false;
    global.briefingGerenderd = false;
    global.bekendmakingGetoond = false;
    global.pollTimer = null;
    global.heartbeatTimer = null;
    global.showScreen = jest.fn();
    global.toast = jest.fn();
    global.apiFetch = jest.fn();
    global.escH = (s) => String(s);
    global.startPoll = jest.fn();
    global.stopPoll = jest.fn();
    global.stopHeartbeat = jest.fn();
    global.getFaseTimerSec = jest.fn(() => 120);
    global.geselecteerdeOptie = null;
    global.geselecteerdeLidId = null;
    global.geselecteerdeMcOptieId = null;
    global.testIngediend = false;
    global.testVerdachteId = null;
    global.testRondeNr = null;
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };

    const src = fs.readFileSync(spelerPath, 'utf8');
    const indirectEval = eval;
    indirectEval(src);

    renderWachtNaIndienen = global.renderWachtNaIndienen;
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="wacht-ronde-eigen"></div>
      <div id="wacht-ronde-grid"></div>
    `;
  });

  test('vult eigen antwoord in wacht-ronde-eigen', () => {
    const mijnAntwoord = { antwoord: 'correct' };
    const mijnGroep = [];
    const alleAntwoorden = [];
    renderWachtNaIndienen(mijnAntwoord, mijnGroep, alleAntwoorden);
    const el = document.getElementById('wacht-ronde-eigen');
    expect(el.innerHTML).toContain('correct');
  });

  test('wacht-chip heeft klaar-class als leerling heeft ingediend', () => {
    const mijnAntwoord = { antwoord: 'fout' };
    const mijnGroep = [{ id: 'l1', naam: 'Anna' }, { id: 'l2', naam: 'Bo' }];
    const alleAntwoorden = [{ leerling_id: 'l1' }];
    renderWachtNaIndienen(mijnAntwoord, mijnGroep, alleAntwoorden);
    const grid = document.getElementById('wacht-ronde-grid');
    const chips = grid.querySelectorAll('.wacht-chip');
    expect(chips[0].classList.contains('klaar')).toBe(true);
    expect(chips[1].classList.contains('klaar')).toBe(false);
  });

});
