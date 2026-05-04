/**
 * @jest-environment jsdom
 *
 * TICKET-021 — Mol selecteert automatisch een sabotage-MC-optie.
 *
 * Doel: bevestigen dat bij MC-vragen de mol een niet-max-punten optie
 * krijgt voorgeselecteerd (zodat de submit-knop verschijnt en de mol
 * een rij in mol_antwoorden kan indienen).
 */

const fs = require('fs');
const path = require('path');
const spelerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');

function setupDom() {
  document.body.innerHTML = `
    <div id="screen-speler-ronde">
      <div id="ronde-fase-label"></div>
      <div id="ronde-progress" style="width:0;"></div>
      <div id="ronde-topbar-label"></div>
      <div id="ronde-content"></div>
    </div>
  `;
  global.lastRenderedFase       = null;
  global.geselecteerdeOptie     = null;
  global.geselecteerdeMcOptieId = null;
  global.geselecteerdeLidId     = null;
}

describe('TICKET-021 — mol-MC sabotage-default', () => {
  beforeAll(() => {
    global.sessieId = 'test-sessie';
    global.sessieState = null;
    global.briefingGedrukt = false;
    global.briefingGerenderd = false;
    global.bekendmakingGetoond = false;
    global.testIngediend = false;
    global.testVerdachteId = null;
    global.testRondeNr = null;
    global.pollTimer = null;
    global.heartbeatTimer = null;
    global.showScreen = jest.fn();
    global.toast = jest.fn();
    global.apiFetch = jest.fn().mockResolvedValue({});
    global.escH = (s) => String(s ?? '');
    global.startPoll = jest.fn();
    global.stopPoll = jest.fn();
    global.stopHeartbeat = jest.fn();
    global.getFaseTimerSec = jest.fn(() => 120);
    global.startCountdown = jest.fn();
    global.buildTimerRing = () => '';
    global.localStorage = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
    const src = fs.readFileSync(spelerPath, 'utf8');
    const indirectEval = eval;
    indirectEval(src);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    setupDom();
  });
  afterEach(() => jest.useRealTimers());

  function renderInvoer(spelerObj, caseData) {
    global.speler = spelerObj;
    const groep = [{ id: spelerObj.id, is_mol: spelerObj.is_mol, groep_id: 'g' }];
    global.renderSpelerRonde(
      1, 1, caseData, null, false, [], null,
      groep, groep,
      'invoer', Date.now(), 60, 60, [], []
    );
  }

  it('AC1: MC + is_mol -> sabotage-optie geselecteerd, submit zichtbaar', () => {
    renderInvoer(
      { id: 'm', is_mol: true },
      {
        vraagtype: 'mc',
        vraag: 'V?',
        mc_opties: [
          { id: 'a', tekst: 'A', punten: 10 },
          { id: 'b', tekst: 'B', punten: 0 },
        ],
      }
    );
    jest.advanceTimersByTime(150);
    expect(global.geselecteerdeMcOptieId).toBe('b');
    expect(global.geselecteerdeOptie).toBe('fout');
    expect(document.getElementById('submit-antwoord-btn').style.display).toBe('block');
  });

  it('AC2: MC + niet-mol -> niets geselecteerd', () => {
    renderInvoer(
      { id: 's', is_mol: false },
      {
        vraagtype: 'mc',
        vraag: 'V?',
        mc_opties: [
          { id: 'a', tekst: 'A', punten: 10 },
          { id: 'b', tekst: 'B', punten: 0 },
        ],
      }
    );
    jest.advanceTimersByTime(150);
    expect(global.geselecteerdeMcOptieId).toBeNull();
    expect(document.getElementById('submit-antwoord-btn').style.display).toBe('none');
  });

  it('AC3: niet-MC + is_mol -> selecteerOptie("fout") als vanouds', () => {
    renderInvoer(
      { id: 'm', is_mol: true },
      { vraag: 'V?' /* geen vraagtype: 'mc' */ }
    );
    jest.advanceTimersByTime(150);
    expect(global.geselecteerdeOptie).toBe('fout');
  });

  it('AC4: meerdere niet-correcte opties -> eerste niet-max-punten optie', () => {
    renderInvoer(
      { id: 'm', is_mol: true },
      {
        vraagtype: 'mc',
        vraag: 'V?',
        mc_opties: [
          { id: 'a', tekst: 'A', punten: 10 },
          { id: 'b', tekst: 'B', punten: 5 },
          { id: 'c', tekst: 'C', punten: 0 },
        ],
      }
    );
    jest.advanceTimersByTime(150);
    expect(global.geselecteerdeMcOptieId).toBe('b');
  });
});
