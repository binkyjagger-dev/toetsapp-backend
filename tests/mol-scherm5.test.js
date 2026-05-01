/**
 * @jest-environment jsdom
 *
 * MOL-08 -- Scherm 5 fixes
 * Verifieert: directe indienknop zichtbaar na selectie,
 * geen argument-validatie meer, foutmelding bij ontbrekende selectie.
 */

const fs   = require('fs');
const path = require('path');
const spelerPath = path.join(
  __dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js'
);

describe('Scherm 5 -- individuele vraag', () => {

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
    global.huidigeRondeNr         = 1;
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
    global.geselecteerdeOptie     = null;
    global.geselecteerdeMcOptieId = null;
    global.apiFetch               = jest.fn().mockResolvedValue({});
  });

  test('submit-antwoord-btn is zichtbaar na selecteerOptie()', () => {
    document.body.innerHTML = `
      <div class="antwoord-optie" id="opt-correct"></div>
      <button id="submit-antwoord-btn" style="display:none;"></button>
      <div id="antwoord-error"></div>
    `;
    selecteerOptie('correct');
    const btn = document.getElementById('submit-antwoord-btn');
    expect(btn.style.display).toBe('block');
  });

  test('submit-antwoord-btn is zichtbaar na selecteerMcOptie()', () => {
    document.body.innerHTML = `
      <div id="opt-abc" class="antwoord-optie">Optie A</div>
      <button id="submit-antwoord-btn" style="display:none;"></button>
    `;
    selecteerMcOptie('abc', 'correct');
    const btn = document.getElementById('submit-antwoord-btn');
    expect(btn.style.display).toBe('block');
  });

  test('submitAntwoord weigert als geen optie geselecteerd', async () => {
    document.body.innerHTML = `
      <div id="antwoord-error" style="display:none;"></div>
      <button id="submit-antwoord-btn"></button>
    `;
    global.geselecteerdeOptie = null;
    await submitAntwoord(1);
    const err = document.getElementById('antwoord-error');
    expect(err.style.display).toBe('block');
    expect(err.textContent).toContain('Kies eerst');
  });

  test('submitAntwoord verstuurt argument als lege string', async () => {
    document.body.innerHTML = `
      <div id="antwoord-error" style="display:none;"></div>
      <button id="submit-antwoord-btn"></button>
    `;
    global.geselecteerdeOptie = 'correct';
    global.geselecteerdeMcOptieId = null;
    await submitAntwoord(1);
    expect(global.apiFetch).toHaveBeenCalledWith(
      '/api/mol/antwoord',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"argument":""'),
      })
    );
  });

});
