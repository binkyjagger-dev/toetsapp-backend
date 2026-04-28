/**
 * @jest-environment jsdom
 *
 * TICKET-015 -- renderSpelerTest crash-fix + Mol-badge ID
 * Test 1: renderSpelerTest crasht niet en vult test-verdachte-keuze
 * Test 2: speler-topbar-right bestaat in de DOM (wacht-briefing scherm)
 */

const fs   = require('fs');
const path = require('path');

const spelerPath = path.join(
  __dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js'
);

const leerlingen = [
  { id: 'sp1', naam: 'Piet',  groep_id: 'g1' },
  { id: 'sp2', naam: 'Marie', groep_id: 'g1' },
  { id: 'sp3', naam: 'Jan',   groep_id: 'g1' },
];
const state = { leerlingen, sessie: { status: 'test' } };

function setDom() {
  document.body.innerHTML = `
    <div id="screen-speler-test">
      <div class="content">
        <div id="test-verdachte-keuze"></div>
        <div id="test-error" style="display:none;"></div>
      </div>
    </div>
    <div id="screen-speler-wacht-briefing">
      <div class="topbar">
        <div class="topbar-brand" id="wacht-briefing-naam"></div>
        <div class="topbar-right" id="speler-topbar-right">
          <span class="topbar-tag tag-speler">WACHTEN</span>
        </div>
      </div>
    </div>`;
}

describe('TICKET-015: renderSpelerTest en speler-topbar-right', () => {
  beforeAll(() => {
    global.sessieId               = 'sess1';
    global.speler                 = { id: 'sp1', naam: 'Piet', groep_id: 'g1',
                                      is_mol: false, is_groepshoofd: false };
    global.testVerdachteId        = null;
    global.testRondeNr            = null;
    global.pollTimer              = null;
    global.geselecteerdeOptie     = null;
    global.geselecteerdeLidId     = null;
    global.geselecteerdeMcOptieId = null;
    global.testIngediend          = false;
    global.briefingGedrukt        = false;
    global.briefingGerenderd      = false;
    global.bekendmakingGetoond    = false;
    global.lastRenderedFase       = null;
    global.sessieState            = null;
    global.heartbeatTimer         = null;
    global.showScreen             = jest.fn();
    global.toast                  = jest.fn();
    global.apiFetch               = jest.fn().mockResolvedValue({});
    global.escH                   = (s) => String(s);
    global.startPoll              = jest.fn();
    global.stopPoll               = jest.fn();
    global.stopHeartbeat          = jest.fn();
    global.getFaseTimerSec        = jest.fn(() => 120);
    global.startCountdown         = jest.fn();
    global.stemOpGroepshoofd      = jest.fn();
    global.drukOpStart            = jest.fn();
    global.localStorage = {
      getItem:    jest.fn(),
      setItem:    jest.fn(),
      removeItem: jest.fn(),
    };
    const src = fs.readFileSync(spelerPath, 'utf8');
    const indirectEval = eval;
    indirectEval(src);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.pollTimer = null;
    global.speler = { id: 'sp1', naam: 'Piet', groep_id: 'g1',
                      is_mol: false, is_groepshoofd: false };
    setDom();
  });

  test('renderSpelerTest crasht niet en vult test-verdachte-keuze', () => {
    expect(() => renderSpelerTest(leerlingen, state)).not.toThrow();
    const vc = document.getElementById('test-verdachte-keuze');
    expect(vc.innerHTML).not.toBe('');
  });

  test('renderSpelerTest toont twee knoppen (groepsleden zonder speler zelf)', () => {
    renderSpelerTest(leerlingen, state);
    const knoppen = document.querySelectorAll('#test-verdachte-keuze .groepslid-btn');
    expect(knoppen.length).toBe(2);
    expect(document.getElementById('test-verdachte-keuze').innerHTML).toContain('Marie');
    expect(document.getElementById('test-verdachte-keuze').innerHTML).toContain('Jan');
  });

  test('speler-topbar-right bestaat in de DOM en is niet null', () => {
    expect(document.getElementById('speler-topbar-right')).not.toBeNull();
  });
});
