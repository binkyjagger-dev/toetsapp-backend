/**
 * @jest-environment jsdom
 *
 * MOL-03 Fix 4 — Scherm 6: wacht-chips na antwoord indienen
 * Test: wacht-chip heeft 'klaar' class als leerling al ingediend heeft
 * Test: wacht-chip heeft geen 'klaar' class als leerling nog niet ingediend heeft
 */

const fs = require('fs');
const path = require('path');
const spelerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');

describe('MOL-03 Fix 4 — scherm 6 wacht-chips', () => {
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
    global.lastRenderedFase = null;
    document.body.innerHTML = `
      <div id="screen-speler-ronde" class="screen">
        <div id="ronde-topbar-label"></div>
        <div id="ronde-progress" style="width:0%"></div>
        <div id="ronde-fase-label"></div>
        <div id="ronde-content"></div>
      </div>`;
  });

  it('wacht-chip heeft klaar class als leerling al ingediend heeft', () => {
    const mijnGroep = [{ id: 'sp2', groep_id: 'g1', naam: 'Anna' }];
    const alleAntwoorden = [{ leerling_id: 'sp2', ronde_nr: 1 }];
    const caseData = { ronde_nr: 1, vraag: 'Testvraag', vraagtype: 'stelling' };
    const mijnAntwoord = { leerling_id: 'sp1', ronde_nr: 1 };

    global.renderSpelerRonde(
      1, 3, caseData, mijnAntwoord, false, alleAntwoorden,
      null, mijnGroep, mijnGroep, 'invoer', Date.now(), 120, 60, [], []
    );

    const chips = document.querySelectorAll('.wacht-chip');
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0].classList.contains('klaar')).toBe(true);
  });

  it('wacht-chip heeft geen klaar class als leerling nog niet ingediend heeft', () => {
    const mijnGroep = [{ id: 'sp2', groep_id: 'g1', naam: 'Bert' }];
    const alleAntwoorden = []; // sp2 heeft nog niet ingediend
    const caseData = { ronde_nr: 1, vraag: 'Testvraag', vraagtype: 'stelling' };
    const mijnAntwoord = { leerling_id: 'sp1', ronde_nr: 1 };

    global.renderSpelerRonde(
      1, 3, caseData, mijnAntwoord, false, alleAntwoorden,
      null, mijnGroep, mijnGroep, 'invoer', Date.now(), 120, 60, [], []
    );

    const chips = document.querySelectorAll('.wacht-chip');
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0].classList.contains('klaar')).toBe(false);
  });
});
