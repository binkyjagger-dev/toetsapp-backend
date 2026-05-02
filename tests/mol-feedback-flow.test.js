/**
 * @jest-environment jsdom
 *
 * TICKET-019 — Per-ronde feedback navigatie na reveal.
 *
 * - startFeedbackFlow() zet feedbackRondeNr=1 en rendert ronde 1
 * - renderFeedbackScherm(rondeNr) gebruikt rondeNr voor fetch + label
 * - feedbackVolgendeRonde() stapt door rondes en keert terug naar reveal
 */

const fs = require('fs');
const path = require('path');
const spelerPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'speler.js');

describe('TICKET-019 — feedback-flow', () => {
  beforeAll(() => {
    global.sessieId = 'sid1';
    global.speler = { id: 'lid1', groep_id: 'gid1', naam: 'Test', is_mol: false };
    global.sessieState = { sessie: { n_rondes: 3 }, leerlingen: [] };
    global.huidigeRondeNr = 3;
    global.feedbackRondeNr = 1;
    global.lastRenderedFase = null;
    global.briefingGedrukt = false;
    global.briefingGerenderd = false;
    global.testIngediend = false;
    global.testVerdachteId = null;
    global.testRondeNr = null;
    global.geselecteerdeOptie = null;
    global.geselecteerdeLidId = null;
    global.geselecteerdeMcOptieId = null;
    global.pollTimer = null;
    global.heartbeatTimer = null;
    global.escH = (s) => String(s ?? '');
    global.showScreen = (id) => {
      document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
      const el = document.getElementById(id);
      if (el) el.style.display = 'block';
    };
    global.apiFetch = jest.fn().mockResolvedValue({
      eigen_score: 7,
      vraag_tekst: 'Wat is X?',
      opties: [
        { tekst: 'A', correct: true,  is_eigen_antwoord: true,  is_groepsantwoord: false, feedback: 'Goed' },
        { tekst: 'B', correct: false, is_eigen_antwoord: false, is_groepsantwoord: false, feedback: 'Fout' },
      ],
    });
    global.toast = jest.fn();
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
    global.apiFetch.mockClear();
    global.feedbackRondeNr = 1;
    document.body.innerHTML = `
      <div id="screen-speler-reveal" class="screen" style="display:none;"></div>
      <div id="screen-speler-feedback" class="screen" style="display:none;">
        <div id="feedback-score-banner"><div id="feedback-score-val"></div></div>
        <div id="feedback-content"></div>
        <button id="feedback-volgende-btn"></button>
      </div>
    `;
  });

  function setNRondes(n) {
    global.sessieState = { sessie: { n_rondes: n }, leerlingen: [] };
  }

  it('AC2/AC3: startFeedbackFlow rendert ronde 1 met label "Volgende ronde"', async () => {
    setNRondes(3);
    await global.startFeedbackFlow();
    expect(global.feedbackRondeNr).toBe(1);
    expect(document.getElementById('feedback-volgende-btn').textContent)
      .toMatch(/Volgende ronde/);
  });

  it('AC4: bij laatste ronde label "Naar eindstand"', async () => {
    setNRondes(2);
    global.feedbackRondeNr = 2;
    await global.renderFeedbackScherm(2);
    expect(document.getElementById('feedback-volgende-btn').textContent)
      .toMatch(/Naar eindstand/);
  });

  it('AC5: feedbackVolgendeRonde gaat van ronde 1 naar 2', async () => {
    setNRondes(3);
    global.feedbackRondeNr = 1;
    await global.feedbackVolgendeRonde();
    expect(global.feedbackRondeNr).toBe(2);
  });

  it('AC6: feedbackVolgendeRonde bij laatste ronde toont reveal-scherm', async () => {
    setNRondes(3);
    global.feedbackRondeNr = 3;
    await global.feedbackVolgendeRonde();
    expect(document.getElementById('screen-speler-reveal').style.display).toBe('block');
  });

  it('AC9: n_rondes=1 toont label "Naar eindstand" direct', async () => {
    setNRondes(1);
    await global.startFeedbackFlow();
    expect(document.getElementById('feedback-volgende-btn').textContent)
      .toMatch(/Naar eindstand/);
  });

  it('renderFeedbackScherm gebruikt rondeNr in fetch-URL', async () => {
    setNRondes(3);
    global.feedbackRondeNr = 2;
    await global.renderFeedbackScherm(2);
    const url = global.apiFetch.mock.calls[0][0];
    expect(url).toContain('ronde_nr=2');
  });
});
