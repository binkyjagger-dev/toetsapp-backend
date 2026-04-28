/**
 * @jest-environment jsdom
 */
// MOL-10: scherm 6 volledig -- bugs A, B, C, D

const fs   = require('fs');
const path = require('path');
const spelerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');

describe('renderWachtNaIndienen - leesbare tekst', () => {
  beforeAll(() => {
    global.sessieId               = 'test-sessie';
    global.speler                 = { id: 'sp1', naam: 'Sara', groep_id: 'g1', groep_naam: 'Rood', is_groepshoofd: false };
    global.sessieState            = null;
    global.lastRenderedFase       = null;
    global.briefingGedrukt        = false;
    global.briefingGerenderd      = false;
    global.bekendmakingGetoond    = false;
    global.pollTimer              = null;
    global.heartbeatTimer         = null;
    global.showScreen             = jest.fn();
    global.toast                  = jest.fn();
    global.apiFetch               = jest.fn();
    global.escH                   = function(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); };
    global.startPoll              = jest.fn();
    global.stopPoll               = jest.fn();
    global.stopHeartbeat          = jest.fn();
    global.getFaseTimerSec        = jest.fn(() => 120);
    global.startCountdown         = jest.fn();
    global.geselecteerdeOptie     = null;
    global.geselecteerdeLidId     = null;
    global.geselecteerdeMcOptieId = null;
    global.testIngediend          = false;
    global.testVerdachteId        = null;
    global.testRondeNr            = null;
    global.localStorage = {
      getItem:    jest.fn(),
      setItem:    jest.fn(),
      removeItem: jest.fn()
    };
    const src = fs.readFileSync(spelerPath, 'utf8');
    const indirectEval = eval;
    indirectEval(src);
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="wacht-ronde-topbar-naam"></div>
      <div id="wacht-ronde-eigen"></div>
      <div id="wacht-ronde-grid"></div>
    `;
    global.speler = { id: 'sp1', naam: 'Sara', groep_id: 'g1', groep_naam: 'Rood', is_groepshoofd: false };
  });

  test('toont topbar naam + groep', () => {
    renderWachtNaIndienen({ antwoord: 'correct' }, [], [], null);
    expect(document.getElementById('wacht-ronde-topbar-naam').textContent).toContain('Sara');
    expect(document.getElementById('wacht-ronde-topbar-naam').textContent).toContain('Rood');
  });

  test('MC-vraag: toont optiebeschrijving in plaats van UUID', () => {
    var caseData = { mc_opties: [{ id: 'uuid-abc', tekst: 'Veel aanbieders' }] };
    var antwoord = { antwoord: 'correct', mc_optie_id: 'uuid-abc' };
    renderWachtNaIndienen(antwoord, [], [], caseData);
    expect(document.getElementById('wacht-ronde-eigen').innerHTML).toContain('Veel aanbieders');
  });

  test('niet-MC: correct wordt leesbare tekst', () => {
    renderWachtNaIndienen({ antwoord: 'correct', mc_optie_id: null }, [], [], null);
    expect(document.getElementById('wacht-ronde-eigen').innerHTML).toContain('Correct antwoord');
  });

  test('niet-MC: fout wordt leesbare tekst', () => {
    renderWachtNaIndienen({ antwoord: 'fout', mc_optie_id: null }, [], [], null);
    expect(document.getElementById('wacht-ronde-eigen').innerHTML).toContain('Alternatief antwoord');
  });

  test('statusrij toont Ingediend voor speler die al heeft ingediend', () => {
    var groep = [{ id: 'l1', naam: 'Sara Jansen' }];
    var ingediend = [{ leerling_id: 'l1' }];
    renderWachtNaIndienen({ antwoord: 'correct' }, groep, ingediend, null);
    expect(document.getElementById('wacht-ronde-grid').innerHTML).toContain('Ingediend');
  });

  test('statusrij toont Bezig voor speler die nog niet heeft ingediend', () => {
    var groep = [{ id: 'l1', naam: 'Lisa Kok' }];
    renderWachtNaIndienen({ antwoord: 'correct' }, groep, [], null);
    expect(document.getElementById('wacht-ronde-grid').innerHTML).toContain('Bezig');
  });
});
