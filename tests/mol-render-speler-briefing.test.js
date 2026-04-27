/**
 * @jest-environment jsdom
 *
 * TICKET-012 -- renderSpelerBriefing() crash-fix
 * Verifieert dat de functie niet crasht na het corrigeren van
 * verkeerde element-IDs, en de topbar correct vult.
 */

const fs   = require('fs');
const path = require('path');
const spelerPath = path.join(
  __dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js'
);

const TEST_LEERLINGEN = [
  { id: 'sp1', naam: 'Anna', groep_id: 'g1', groep_naam: 'Groep Rood', is_mol: false, is_groepshoofd: false, groepshoofd_stem: null },
  { id: 'sp2', naam: 'Ben',  groep_id: 'g1', groep_naam: 'Groep Rood', is_mol: false, is_groepshoofd: false, groepshoofd_stem: null },
];
const TEST_GROEPEN = [{ id: 'g1', naam: 'Groep Rood' }];
const TEST_SESSIE  = { id: 'sess1', fase: 'briefing' };

function setDomMet() {
  document.body.innerHTML = `
    <div id="screen-speler-briefing" class="screen">
      <div class="topbar">
        <div class="topbar-brand" id="briefing-speler-naam">--</div>
        <div class="topbar-right">
          <span class="topbar-tag tag-speler" id="briefing-groep-naam">--</span>
        </div>
      </div>
      <div class="content">
        <div id="speler-briefing-sectie"></div>
      </div>
    </div>`;
}

describe('renderSpelerBriefing', () => {
  beforeAll(() => {
    global.sessieId               = 'sess1';
    global.speler                 = { id: 'sp1', groep_id: 'g1', naam: 'Anna', is_mol: false, groepshoofd_stem: null };
    global.sessieState            = null;
    global.lastRenderedFase       = null;
    global.geselecteerdeOptie     = null;
    global.geselecteerdeLidId     = null;
    global.geselecteerdeMcOptieId = null;
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
    global.briefingGerenderd = false;
    global.briefingGedrukt   = false;
    global.speler = { id: 'sp1', groep_id: 'g1', naam: 'Anna', is_mol: false, groepshoofd_stem: null };
    setDomMet();
  });

  test('crasht niet als speler geen mol is', () => {
    expect(() =>
      renderSpelerBriefing(TEST_LEERLINGEN, TEST_GROEPEN, TEST_SESSIE)
    ).not.toThrow();
  });

  test('vult briefing-speler-naam en briefing-groep-naam na aanroep', () => {
    renderSpelerBriefing(TEST_LEERLINGEN, TEST_GROEPEN, TEST_SESSIE);
    expect(document.getElementById('briefing-speler-naam').textContent).toBe('Anna');
    expect(document.getElementById('briefing-groep-naam').textContent).toBe('Groep Rood');
  });

  test('speler-briefing-sectie is niet leeg na aanroep', () => {
    renderSpelerBriefing(TEST_LEERLINGEN, TEST_GROEPEN, TEST_SESSIE);
    const sec = document.getElementById('speler-briefing-sectie');
    expect(sec.innerHTML).not.toBe('');
  });

  test('crasht niet als speler de mol is en sectie bevat Mol', () => {
    global.speler = { id: 'sp1', groep_id: 'g1', naam: 'Anna', is_mol: true, groepshoofd_stem: null };
    expect(() =>
      renderSpelerBriefing(TEST_LEERLINGEN, TEST_GROEPEN, TEST_SESSIE)
    ).not.toThrow();
    const sec = document.getElementById('speler-briefing-sectie');
    expect(sec.innerHTML).toContain('Mol');
  });

  test('guard: doet niets als speler-briefing-sectie ontbreekt in DOM', () => {
    document.body.innerHTML = `
      <div id="briefing-speler-naam">--</div>
      <div id="briefing-groep-naam">--</div>`;
    expect(() =>
      renderSpelerBriefing(TEST_LEERLINGEN, TEST_GROEPEN, TEST_SESSIE)
    ).not.toThrow();
  });
});
