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
global.docentToken = '';
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
global.escH = (s) => {
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
};
global.stopHeartbeat = jest.fn();
global.confirm = jest.fn(() => true);
global.crypto = { randomUUID: () => 'test-uuid' };

const src = fs.readFileSync(
  path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js'), 'utf8'
);
const indirectEval = eval;
indirectEval(src);

beforeEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = '<div id="dashboard-groepen-grid"></div>';
});

describe('renderGroepskaarten (DOM)', () => {
  it('happy path — 2 groepen met spelers', () => {
    renderGroepskaarten([
      { id: 'g1', naam: 'Groep Rood', fase: 'briefing', spelers: [
        { id: 's1', naam: 'Sara', online: true, is_groepshoofd: false },
        { id: 's2', naam: 'Tom', online: true, is_groepshoofd: false },
        { id: 's3', naam: 'Lex', online: false, is_groepshoofd: false },
      ]},
      { id: 'g2', naam: 'Groep Blauw', fase: 'individueel', spelers: [
        { id: 's4', naam: 'Mia', online: true, is_groepshoofd: false },
        { id: 's5', naam: 'Jan', online: false, is_groepshoofd: false },
        { id: 's6', naam: 'Eva', online: true, is_groepshoofd: false },
      ]},
    ]);
    const grid = document.getElementById('dashboard-groepen-grid');
    const kaarten = grid.querySelectorAll('.groepskaart');
    expect(kaarten.length).toBe(2);
    expect(kaarten[0].textContent).toContain('Groep Rood');
    expect(kaarten[0].querySelector('.fase-briefing')).not.toBeNull();
    expect(kaarten[1].querySelector('.fase-individueel')).not.toBeNull();
    expect(kaarten[1].querySelector('.fase-individueel').textContent).toBe('Individuele vraag');
  });

  it('online/offline stippen en tekst', () => {
    renderGroepskaarten([{
      id: 'g1', naam: 'G1', fase: 'briefing', spelers: [
        { id: 's1', naam: 'Anna', online: true, is_groepshoofd: false },
        { id: 's2', naam: 'Bert', online: false, is_groepshoofd: false },
      ],
    }]);
    const grid = document.getElementById('dashboard-groepen-grid');
    const stippen = grid.querySelectorAll('.stip-online, .stip-offline');
    expect(stippen.length).toBe(2);
    expect(grid.querySelectorAll('.stip-online').length).toBe(1);
    expect(grid.querySelectorAll('.stip-offline').length).toBe(1);
    expect(grid.textContent).toContain('offline');
  });

  it('groepshoofd krijgt kroontje', () => {
    renderGroepskaarten([{
      id: 'g1', naam: 'G1', fase: 'briefing', spelers: [
        { id: 's1', naam: 'Chef', online: true, is_groepshoofd: true },
        { id: 's2', naam: 'Lid1', online: true, is_groepshoofd: false },
        { id: 's3', naam: 'Lid2', online: true, is_groepshoofd: false },
      ],
    }]);
    const grid = document.getElementById('dashboard-groepen-grid');
    const spelerEls = grid.querySelectorAll('.groepskaart-speler');
    const metKroon = Array.from(spelerEls).filter(el => el.textContent.includes('👑'));
    expect(metKroon.length).toBe(1);
    expect(metKroon[0].textContent).toContain('Chef');
  });

  it('lege array toont placeholder', () => {
    renderGroepskaarten([]);
    const grid = document.getElementById('dashboard-groepen-grid');
    expect(grid.textContent).toContain('Nog geen groepen gevormd');
  });

  it('null toont placeholder zonder crash', () => {
    renderGroepskaarten(null);
    const grid = document.getElementById('dashboard-groepen-grid');
    expect(grid.textContent).toContain('Nog geen groepen gevormd');
  });

  it('groep zonder spelers toont melding', () => {
    renderGroepskaarten([{ id: 'g1', naam: 'Leeg', fase: 'briefing', spelers: [] }]);
    const grid = document.getElementById('dashboard-groepen-grid');
    expect(grid.textContent).toContain('Geen leerlingen');
  });

  it('XSS wordt geëscaped', () => {
    renderGroepskaarten([{
      id: 'g1', naam: 'Test', fase: 'briefing',
      spelers: [{ id: 's1', naam: '<script>alert(1)</script>', online: true, is_groepshoofd: false }],
    }]);
    const grid = document.getElementById('dashboard-groepen-grid');
    expect(grid.innerHTML).not.toContain('<script>');
    expect(grid.textContent).toContain('<script>alert(1)</script>');
  });

  it('onbekende fase valt terug op briefing', () => {
    renderGroepskaarten([{ id: 'g1', naam: 'G1', fase: 'onzin', spelers: [] }]);
    const grid = document.getElementById('dashboard-groepen-grid');
    expect(grid.querySelector('.fase-briefing')).not.toBeNull();
    expect(grid.querySelector('.fase-briefing').textContent).toBe('Briefing');
  });

  it('herhaalde aanroep vervangt grid volledig', () => {
    renderGroepskaarten([
      { id: 'g1', naam: 'A', fase: 'briefing', spelers: [] },
      { id: 'g2', naam: 'B', fase: 'briefing', spelers: [] },
    ]);
    renderGroepskaarten([
      { id: 'g3', naam: 'C', fase: 'moltest', spelers: [] },
    ]);
    const grid = document.getElementById('dashboard-groepen-grid');
    expect(grid.querySelectorAll('.groepskaart').length).toBe(1);
    expect(grid.textContent).toContain('C');
    expect(grid.textContent).not.toContain('A');
  });
});
