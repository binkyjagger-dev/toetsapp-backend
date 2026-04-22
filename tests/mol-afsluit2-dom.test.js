/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

global.sessieId = null;
global.sessieCode = null;
global.docentCode = null;
global.sessieState = null;
global.lastRenderedFase = null;
global.lastAutoAdvance = '';
global.docentToken = 'jwt-test';
global.speler = null;
global.setupData = {};
global.groepsindeling = [];
global.pollTimer = null;
global.heartbeatTimer = null;
global.hergebruikGroepen = [];
global.hergebruikSessieId = null;
global.hergebruikDocentCode = null;
global.showScreen = jest.fn();
global.toast = jest.fn();
global.apiFetch = jest.fn();
global.escH = (s) => String(s);
global.stopHeartbeat = jest.fn();
global.confirm = jest.fn(() => true);
global.crypto = { randomUUID: () => 'test-uuid' };
global.molLessenCache = [];
global.pickerGeselecteerd = new Set();
global.pickerAlleeLeerlingen = [];
global.pickerTargetTextarea = 'leerlingen-input';
global.molLessenCache = [];

const mockLS = { store: {}, setItem(k, v) { this.store[k] = v; }, getItem(k) { return this.store[k] || null; } };
Object.defineProperty(global, 'localStorage', { value: mockLS, writable: true });

const pickerSrc = fs.readFileSync(
  path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'leerlingen-picker.js'), 'utf8'
);
const setupSrc = fs.readFileSync(
  path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-setup.js'), 'utf8'
);
const indirectEval = eval;
indirectEval(pickerSrc);
indirectEval(setupSrc);

function setupDOM() {
  document.body.innerHTML = `
    <select id="sessie-les-select">
      <option value="">— Handmatig invullen —</option>
      <option value="les-1">Economie H4</option>
      <option value="les-2">Bedrijfseconomie V5</option>
    </select>
    <input id="setup-les-naam" value="">
    <input id="setup-les-content" value="">
    <div id="les-kiezer-preview" style="display:none;"></div>
    <div id="ronde-kaart-1"><span class="ronde-ai-btn"></span></div>
  `;
}

beforeEach(() => {
  jest.clearAllMocks();
  global.setupData = {};
  global.molLessenCache = [
    { id: 'les-1', name: 'Economie H4', content: '- Vraag en aanbod\n- Marktevenwicht\n- Elasticiteit' },
    { id: 'les-2', name: 'Bedrijfseconomie V5', content: '- Balansanalyse\n- Kostprijsberekening' },
  ];
  global.apiFetch.mockResolvedValue({ vraag: 'Test?', opties: [] });
  setupDOM();
});

describe('Schakel 1 — onMolLesKeuze vult hidden inputs', () => {
  it('keuze les vult setup-les-naam en setup-les-content', () => {
    document.getElementById('sessie-les-select').value = 'les-1';
    onMolLesKeuze();
    expect(document.getElementById('setup-les-naam').value).toBe('Economie H4');
    const content = document.getElementById('setup-les-content').value;
    expect(content).toContain('Vraag en aanbod');
    expect(content).toContain('Marktevenwicht');
    expect(content).toContain('Elasticiteit');
  });

  it('wisselen naar andere les overschrijft inputs', () => {
    document.getElementById('sessie-les-select').value = 'les-1';
    onMolLesKeuze();
    document.getElementById('sessie-les-select').value = 'les-2';
    onMolLesKeuze();
    expect(document.getElementById('setup-les-naam').value).toBe('Bedrijfseconomie V5');
    const content = document.getElementById('setup-les-content').value;
    expect(content).toContain('Balansanalyse');
    expect(content).toContain('Kostprijsberekening');
    expect(content).not.toContain('Vraag en aanbod');
  });
});

describe('Schakel 2 — genereerRondeAI leest uit setupData', () => {
  it('gebruikt setupData.lesContent als primaire bron', async () => {
    global.setupData = { lesContent: 'Inhoud van setupData' };
    document.getElementById('setup-les-content').value = 'Inhoud uit input';
    await genereerRondeAI(1);
    const body = JSON.parse(global.apiFetch.mock.calls[0][1].body);
    expect(body.les_content).toBe('Inhoud van setupData');
  });

  it('valt terug op hidden input als setupData leeg', async () => {
    global.setupData = {};
    document.getElementById('setup-les-content').value = 'Fallback content';
    await genereerRondeAI(1);
    const body = JSON.parse(global.apiFetch.mock.calls[0][1].body);
    expect(body.les_content).toBe('Fallback content');
  });

  it('beide leeg = lege string', async () => {
    global.setupData = {};
    document.getElementById('setup-les-content').value = '';
    await genereerRondeAI(1);
    const body = JSON.parse(global.apiFetch.mock.calls[0][1].body);
    expect(body.les_content).toBe('');
  });
});
