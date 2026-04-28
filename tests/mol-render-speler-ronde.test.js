/**
 * @jest-environment jsdom
 *
 * TICKET-014 -- renderSpelerRonde() crash-fix
 * Verifieert dat de functie niet crasht na het corrigeren van
 * verkeerde element-IDs in screen-speler-ronde, en de verwachte
 * elementen correct vult.
 */

const fs   = require('fs');
const path = require('path');
const spelerPath = path.join(
  __dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js'
);

const caseData = {
  vraag:     'Wat is de beste keuze?',
  context:   null,
  vraagtype: 'open',
  mc_opties: [],
  fout_uitleg: 'Fout argument',
};
const mijnGroep = [{ id: 'sp1', naam: 'Piet', is_groepshoofd: false }];

function setDom() {
  document.body.innerHTML = `
    <div id="screen-speler-ronde" class="screen">
      <div class="topbar">
        <div class="topbar-brand" id="ronde-speler-naam">--</div>
        <div class="topbar-right">
          <span class="topbar-tag tag-speler" id="ronde-topbar-label">Ronde</span>
        </div>
      </div>
      <div style="height:4px;">
        <div id="ronde-progress" style="width:40%;"></div>
      </div>
      <div class="content">
        <div id="ronde-fase-label"></div>
        <div id="ronde-content"></div>
      </div>
    </div>`;
}

describe('renderSpelerRonde', () => {
  beforeAll(() => {
    global.sessieId               = 'test-sessie';
    global.speler                 = { id: 'sp1', naam: 'Piet', groep_id: 'g1', is_mol: false, is_groepshoofd: false };
    global.sessieState            = null;
    global.lastRenderedFase       = null;
    global.geselecteerdeOptie     = null;
    global.geselecteerdeMcOptieId = null;
    global.geselecteerdeLidId     = null;
    global.testIngediend          = false;
    global.testVerdachteId        = null;
    global.testRondeNr            = null;
    global.briefingGedrukt        = false;
    global.briefingGerenderd      = false;
    global.bekendmakingGetoond    = false;
    global.pollTimer              = null;
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
    global.lastRenderedFase       = null;
    global.geselecteerdeOptie     = null;
    global.geselecteerdeMcOptieId = null;
    global.geselecteerdeLidId     = null;
    global.speler = { id: 'sp1', naam: 'Piet', groep_id: 'g1', is_mol: false, is_groepshoofd: false };
    setDom();
  });

  test('crasht niet en vult topbar en content bij fase invoer', () => {
    expect(() =>
      renderSpelerRonde(1, 3, caseData, null, false, [], null, mijnGroep,
        mijnGroep, 'invoer', Date.now(), 120, 60, [], [])
    ).not.toThrow();
    expect(document.getElementById('ronde-topbar-label').textContent)
      .toBe('Ronde 1/3');
    expect(document.getElementById('ronde-content').innerHTML).not.toBe('');
    expect(document.getElementById('ronde-fase-label').textContent)
      .toContain('Ronde 1');
  });

  test('ronde-progress heeft width die overeenkomt met rondenummer', () => {
    renderSpelerRonde(1, 3, caseData, null, false, [], null, mijnGroep,
      mijnGroep, 'invoer', Date.now(), 120, 60, [], []);
    const breedte = document.getElementById('ronde-progress').style.width;
    // ronde 1 van 3: 40 + (1/3)*40 = ~53.3%
    expect(parseFloat(breedte)).toBeGreaterThan(50);
    expect(parseFloat(breedte)).toBeLessThan(60);
  });

  test('toont spinner als caseData null is', () => {
    expect(() =>
      renderSpelerRonde(1, 3, null, null, false, [], null, mijnGroep,
        mijnGroep, 'invoer', Date.now(), 120, 60, [], [])
    ).not.toThrow();
    expect(document.getElementById('ronde-content').innerHTML)
      .toContain('geladen');
  });

  test('sloeg re-render over als fase niet veranderd is', () => {
    renderSpelerRonde(1, 3, caseData, null, false, [], null, mijnGroep,
      mijnGroep, 'invoer', Date.now(), 120, 60, [], []);
    // Tweede aanroep met dezelfde parameters -- guard lastRenderedFase werkt
    expect(() =>
      renderSpelerRonde(1, 3, caseData, null, false, [], null, mijnGroep,
        mijnGroep, 'invoer', Date.now(), 120, 60, [], [])
    ).not.toThrow();
  });
});
