/**
 * @jest-environment jsdom
 *
 * TICKET-017 — renderGroepsantwoordWachten dekt AC1, AC2, AC3:
 * - AC1: showScreen wordt aangeroepen met 'screen-speler-groepsantwoord'.
 * - AC2: #groepsantwoord-tekst toont leesbare tekst (niet de raw MC-id).
 * - AC3: #groepsantwoord-countdown bestaat en heeft initieel "10".
 */

const fs   = require('fs');
const path = require('path');

global.sessieId    = 's1';
global.sessieCode  = null;
global.docentCode  = null;
global.docentToken = '';
global.sessieState = null;
global.lastRenderedFase = null;
global.lastAutoAdvance  = '';
global.speler           = null;
global.huidigeRondeNr   = 1;
global.testVerdachteId  = null;
global.testRondeNr      = null;
global.testIngediend    = false;
global.geselecteerdeOptie    = null;
global.geselecteerdeMcOptieId = null;
global.geselecteerdeLidId    = null;
global.briefingGerenderd     = false;
global.briefingGedrukt       = false;
global.groepshoofGedrukt     = false;
global.setupData         = {};
global.groepsindeling    = [];
global.hergebruikGroepen      = [];
global.hergebruikSessieId     = null;
global.hergebruikDocentCode   = null;
global.pollTimer       = null;
global.heartbeatTimer  = null;
global.pickerGeselecteerd    = new Set();
global.pickerAlleeLeerlingen = [];
global.pickerTargetTextarea  = 'leerlingen-input';
global.molLessenCache  = [];

global.showScreen      = jest.fn();
global.toast           = jest.fn();
global.apiFetch        = jest.fn(() => Promise.resolve({}));
global.escH            = (s) => String(s);
global.startCountdown  = jest.fn();
global.pollSpelerStatus = jest.fn();
global.confirm         = jest.fn(() => true);
global.crypto          = { randomUUID: () => 'test-uuid' };

const mockLS = { store: {}, setItem(k, v) { this.store[k] = v; }, getItem(k) { return this.store[k] || null; } };
Object.defineProperty(global, 'localStorage', { value: mockLS, writable: true });

const src = fs.readFileSync(
  path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js'), 'utf8'
);
const indirectEval = eval;
indirectEval(src);

// Override globals die speler.js zelf definieert (function-declarations
// worden globals via top-level eval). We willen ze tijdens de test als
// jest-mocks gebruiken, niet de echte implementaties met setInterval etc.
global.startCountdown   = jest.fn();
global.showScreen       = jest.fn();
global.pollSpelerStatus = jest.fn();

function setupDOM() {
  document.body.innerHTML = `
    <div id="screen-speler-groepsantwoord" class="screen">
      <div id="groepsantwoord-tekst"></div>
      <div id="groepsantwoord-door"></div>
      <span id="groepsantwoord-countdown">10</span>
    </div>
  `;
}

beforeEach(() => {
  jest.clearAllMocks();
  global.lastRenderedFase = null;
  setupDOM();
  global.speler = { id: 'lid1', groep_id: 'gid1', naam: 'Anna' };
});

describe('renderGroepsantwoordWachten()', () => {
  test('AC1: showScreen wordt aangeroepen met screen-speler-groepsantwoord', () => {
    global.sessieState = {
      groepStemmen: [{ groep_id: 'gid1', ronde_nr: 1, gekozen_argument: 'opt-A' }],
      cases: [{ ronde_nr: 1, mc_opties: [{ id: 'opt-A', tekst: 'Antwoord A' }] }],
      leerlingen: [{ id: 'lid1', groep_id: 'gid1', naam: 'Anna', is_groepshoofd: true }],
    };
    renderGroepsantwoordWachten(1);
    expect(global.showScreen).toHaveBeenCalledWith('screen-speler-groepsantwoord');
  });

  test('AC2: #groepsantwoord-tekst toont leesbare MC-tekst (niet de id)', () => {
    global.sessieState = {
      groepStemmen: [{ groep_id: 'gid1', ronde_nr: 1, gekozen_argument: 'opt-B' }],
      cases: [{ ronde_nr: 1, mc_opties: [
        { id: 'opt-A', tekst: 'Eerste antwoord' },
        { id: 'opt-B', tekst: 'Tweede antwoord' },
      ] }],
      leerlingen: [{ id: 'lid1', groep_id: 'gid1', naam: 'Anna', is_groepshoofd: true }],
    };
    renderGroepsantwoordWachten(1);
    const tekstEl = document.getElementById('groepsantwoord-tekst');
    expect(tekstEl.textContent).toBe('Tweede antwoord');
    expect(tekstEl.textContent).not.toBe('opt-B');
  });

  test('AC2 bonus: "correct" wordt vertaald naar "Correct antwoord"', () => {
    global.sessieState = {
      groepStemmen: [{ groep_id: 'gid1', ronde_nr: 1, gekozen_argument: 'correct' }],
      cases: [{ ronde_nr: 1, mc_opties: [] }],
      leerlingen: [{ id: 'lid1', groep_id: 'gid1', naam: 'Anna', is_groepshoofd: true }],
    };
    renderGroepsantwoordWachten(1);
    expect(document.getElementById('groepsantwoord-tekst').textContent).toBe('Correct antwoord');
  });

  test('AC3: startCountdown wordt aangeroepen met groepsantwoord-countdown en 10', () => {
    global.sessieState = {
      groepStemmen: [{ groep_id: 'gid1', ronde_nr: 1, gekozen_argument: 'opt-A' }],
      cases: [{ ronde_nr: 1, mc_opties: [{ id: 'opt-A', tekst: 'Antwoord A' }] }],
      leerlingen: [{ id: 'lid1', groep_id: 'gid1', naam: 'Anna', is_groepshoofd: true }],
    };
    renderGroepsantwoordWachten(1);
    expect(global.startCountdown).toHaveBeenCalledTimes(1);
    const args = global.startCountdown.mock.calls[0];
    expect(args[0]).toBe('groepsantwoord-countdown');
    expect(args[1]).toBe(10);
    expect(typeof args[2]).toBe('function');
  });

  test('AC3: countdown-element bestaat in de DOM met initiele waarde 10', () => {
    const el = document.getElementById('groepsantwoord-countdown');
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('10');
  });
});
