/**
 * @jest-environment jsdom
 *
 * MOL-02 — Briefing-fase tests
 * Fix 1: pollSpelerStatus handelt fase 'ronde_1' af
 * Fix 2: renderGroepshoofBekendmaking + startCountdown
 * Fix 3: updateBriefingWachtGrid bevat geen gh-wacht-grid
 */

const fs = require('fs');
const path = require('path');

const spelerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');

// ── Fix 1 + Fix 2: code-inspectie ────────────────────────────────────────────

describe('MOL-02 Fix 1 — pollSpelerStatus handelt ronde_1 af', () => {
  let src;
  beforeAll(() => { src = fs.readFileSync(spelerPath, 'utf8'); });

  it('bevat een branch voor fase === "ronde_1"', () => {
    expect(src).toMatch(/fase\s*===\s*['"]ronde_1['"]/);
  });

  it('roept renderGroepshoofBekendmaking aan bij ronde_1', () => {
    const match = src.match(/fase\s*===\s*['"]ronde_1['"][^}]*renderGroepshoofBekendmaking/s);
    expect(match).not.toBeNull();
  });

  it('toont screen-speler-groepshoofd-bekendmaking bij ronde_1', () => {
    const match = src.match(/fase\s*===\s*['"]ronde_1['"][^}]*screen-speler-groepshoofd-bekendmaking/s);
    expect(match).not.toBeNull();
  });
});

// ── Fix 2: code-inspectie ─────────────────────────────────────────────────────

describe('MOL-02 Fix 2 — renderGroepshoofBekendmaking bestaat', () => {
  let src;
  beforeAll(() => { src = fs.readFileSync(spelerPath, 'utf8'); });

  it('renderGroepshoofBekendmaking is gedefinieerd', () => {
    expect(src).toContain('function renderGroepshoofBekendmaking');
  });

  it('startCountdown is gedefinieerd', () => {
    expect(src).toContain('function startCountdown');
  });

  it('renderGroepshoofBekendmaking vult groepshoofd-naam', () => {
    expect(src).toContain('groepshoofd-naam');
  });

  it('renderGroepshoofBekendmaking behandelt is_groepshoofd badge', () => {
    expect(src).toContain('groepshoofd-eigen-badge');
  });

  it('startCountdown gebruikt setInterval', () => {
    expect(src).toContain('setInterval');
  });
});

// ── Fix 2: DOM-test voor startCountdown ──────────────────────────────────────

describe('MOL-02 Fix 2 — startCountdown DOM gedrag', () => {
  let startCountdown;

  beforeAll(() => {
    global.sessieId = 'test-sessie';
    global.speler = { id: 'sp1', groep_id: 'g1', is_groepshoofd: false };
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
    global.apiFetch = jest.fn();
    global.escH = (s) => String(s);
    global.startPoll = jest.fn();
    global.stopPoll = jest.fn();
    global.stopHeartbeat = jest.fn();
    global.getFaseTimerSec = jest.fn(() => 120);
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };

    const src = fs.readFileSync(spelerPath, 'utf8');
    const indirectEval = eval;
    indirectEval(src);

    startCountdown = global.startCountdown;
  });

  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('startCountdown roept callback aan na het verstrijken van de opgegeven tijd', () => {
    document.body.innerHTML = '<div id="test-countdown"></div>';
    const cb = jest.fn();
    startCountdown('test-countdown', 3, cb);
    expect(cb).not.toHaveBeenCalled();
    jest.advanceTimersByTime(3000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('startCountdown telt af in het DOM-element', () => {
    document.body.innerHTML = '<div id="test-countdown2"></div>';
    const cb = jest.fn();
    startCountdown('test-countdown2', 5, cb);
    const el = document.getElementById('test-countdown2');
    jest.advanceTimersByTime(1000);
    expect(el.textContent).toBe('4');
    jest.advanceTimersByTime(4000);
    expect(cb).toHaveBeenCalled();
  });

  it('startCountdown crasht niet als element niet bestaat', () => {
    expect(() => {
      startCountdown('niet-bestaand-element', 2, jest.fn());
      jest.advanceTimersByTime(2000);
    }).not.toThrow();
  });
});

// ── Fix 3: code-inspectie ─────────────────────────────────────────────────────

describe('MOL-02 Fix 3 — gh-wacht-grid verwijderd uit updateBriefingWachtGrid', () => {
  it('updateBriefingWachtGrid bevat geen getElementById("gh-wacht-grid")', () => {
    const src = fs.readFileSync(spelerPath, 'utf8');
    const fnMatch = src.match(/function updateBriefingWachtGrid[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch[0]).not.toContain('gh-wacht-grid');
  });
});

// ── Fix 2: DOM-gedragstests badge zichtbaarheid ───────────────────────────────

describe('MOL-02 Fix 2 — renderGroepshoofBekendmaking badge zichtbaarheid', () => {
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
    global.apiFetch = jest.fn();
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
    jest.useFakeTimers();
    global.bekendmakingGetoond = false;
    document.body.innerHTML = `
      <div id="screen-speler-groepshoofd-bekendmaking" class="screen">
        <span id="groepshoofd-naam"></span>
        <span id="groepshoofd-eigen-badge" style="display:none"></span>
        <span id="groepshoofd-countdown"></span>
      </div>`;
  });

  afterEach(() => { jest.useRealTimers(); });

  it('badge is zichtbaar (display:block) als speler.is_groepshoofd === true', () => {
    global.speler = { id: 'sp1', groep_id: 'g1', naam: 'Test', is_groepshoofd: true };
    global.renderGroepshoofBekendmaking(
      [{ id: 'sp1', groep_id: 'g1', naam: 'Test', is_groepshoofd: true }], {}
    );
    expect(document.getElementById('groepshoofd-eigen-badge').style.display).toBe('block');
  });

  it('badge is verborgen (display:none) als speler.is_groepshoofd === false', () => {
    global.speler = { id: 'sp1', groep_id: 'g1', naam: 'Test', is_groepshoofd: false };
    global.renderGroepshoofBekendmaking(
      [{ id: 'sp2', groep_id: 'g1', naam: 'Hoofd', is_groepshoofd: true }], {}
    );
    expect(document.getElementById('groepshoofd-eigen-badge').style.display).toBe('none');
  });
});

// ── Fix 2: timer-integratietest — poll loopt autonoom door ───────────────────
// De lege callback () => {} in startCountdown is correct: de poll stopt nooit.
// startPoll wordt NIET vanuit de callback aangeroepen — de poll draait al.

describe('MOL-02 Fix 2 — timer-integratietest: poll loopt autonoom door', () => {
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
    global.apiFetch = jest.fn();
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

  it('startPoll wordt NIET vanuit callback aangeroepen — poll draait autonoom door', () => {
    jest.useFakeTimers();
    global.bekendmakingGetoond = false;
    document.body.innerHTML = `
      <div id="screen-speler-groepshoofd-bekendmaking" class="screen">
        <span id="groepshoofd-naam"></span>
        <span id="groepshoofd-eigen-badge"></span>
        <span id="groepshoofd-countdown"></span>
      </div>`;
    global.startPoll.mockClear();
    global.renderGroepshoofBekendmaking(
      [{ id: 'sp1', groep_id: 'g1', naam: 'Test', is_groepshoofd: false }], {}
    );
    jest.advanceTimersByTime(10000);
    // startPoll wordt NIET aangeroepen vanuit de callback: de poll draait
    // al autonoom via initSpelerFlow en detecteert de fase-overgang zelf.
    expect(global.startPoll).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
