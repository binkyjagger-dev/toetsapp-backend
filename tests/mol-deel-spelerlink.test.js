/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Globals die docent-sessie.js verwacht
global.sessieId    = 's1';
global.sessieCode  = 'AB7X';
global.docentCode  = 'DC99';
global.docentToken = 'jwt-test';
global.sessieState = null;
global.lastRenderedFase  = null;
global.lastAutoAdvance   = '';
global.speler      = null;
global.setupData   = {};
global.groepsindeling  = [];
global.pollTimer       = null;
global.heartbeatTimer  = null;
global.hergebruikGroepen      = [];
global.hergebruikSessieId     = null;
global.hergebruikDocentCode   = null;
global.showScreen  = jest.fn();
global.toast       = jest.fn();
global.apiFetch    = jest.fn();
global.escH        = (s) => String(s);
global.stopHeartbeat = jest.fn();
global.confirm     = jest.fn(() => true);
global.crypto      = { randomUUID: () => 'test-uuid' };

const mockLS = {
  store: {},
  setItem(k, v) { this.store[k] = v; },
  getItem(k)    { return this.store[k] || null; },
};
Object.defineProperty(global, 'localStorage', { value: mockLS, writable: true });

// window.location mocken zodat getSpelerUrl() een testbare URL teruggeeft
delete window.location;
window.location = { href: 'https://voorbeeld.nl/mol-lesvorm.html?leraar=abc' };

// clipboard.writeText mocken
const mockWriteText = jest.fn(() => Promise.resolve());
Object.defineProperty(global.navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
});

const src = fs.readFileSync(
  path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-sessie.js'), 'utf8'
);
const indirectEval = eval;
indirectEval(src);

beforeEach(() => {
  jest.clearAllMocks();
  mockWriteText.mockResolvedValue(undefined);
});

describe('deelSpelerLink()', () => {
  test('roept clipboard.writeText aan met URL die eindigt op ?rol=speler', async () => {
    await deelSpelerLink();
    expect(mockWriteText).toHaveBeenCalledTimes(1);
    const url = mockWriteText.mock.calls[0][0];
    expect(url).toMatch(/\?rol=speler$/);
  });

  test('roept toast aan met "🔗 Link gekopieerd!" na kopiëren', async () => {
    await deelSpelerLink();
    expect(global.toast).toHaveBeenCalledWith('🔗 Link gekopieerd!');
  });
});
