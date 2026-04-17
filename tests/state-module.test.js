const fs = require('fs');
const path = require('path');

const VARS_TO_MOVE = [
  'alleLeerdoelen', 'ldImportBuffer',
  'leraarToken', 'leraarProfiel', 'currentRole', 'studentName',
  'selectedClass', 'selectedLesson', 'chatMessages', 'questionCount',
  'MAX_QUESTIONS', 'resultsCache', 'classesCache', 'lessonsCache',
  'currentResultId', 'currentUnderstanding', 'currentReflGoed',
  'currentReflVerbeteren', 'opgavenData', 'studentScores',
  'selectedLesvorm', 'chatPhase', 'socraticAnswerCount',
  'currentLeerdoelen', 'vraagLeerdoelen',
  'LESVORMEN_REGISTRY', 'selectedLesvormen', 'lesvormMode',
  'lesLdAlle', 'lesLdGefilterd', 'lesLdGeselecteerd',
  'huidigView', 'huidigKlasId', 'huidigKlasTab',
  'klasLlKiezerAlle', 'klasLlKiezerGeselecteerd',
  '_klasResultatenCache', 'analyseData',
  'modalLlGeselecteerd', 'modalLlAlle',
  'klasModalLlAlle', 'klasModalLlGeselecteerd', 'klasModalEditId',
  'xlsxImportData', 'alleLeerlingen',
];

const stateJsPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'state.js');
const indexHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'index.html');

describe('state.js — module extractie', () => {
  it('js/state.js bestaat', () => {
    expect(fs.existsSync(stateJsPath)).toBe(true);
  });

  it('state.js bevat alle verwachte declaraties', () => {
    const content = fs.readFileSync(stateJsPath, 'utf8');
    for (const varName of VARS_TO_MOVE) {
      const re = new RegExp(`(let|const|var)\\s+${varName}\\b`);
      expect(content).toMatch(re);
    }
  });

  it('index.html laadt js/state.js via script tag', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).toContain('src="js/state.js"');
  });

  it('index.html heeft geen dubbele declaraties meer', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    for (const varName of VARS_TO_MOVE) {
      const re = new RegExp(`^(let|const|var)\\s+${varName}\\b`, 'm');
      expect(content).not.toMatch(re);
    }
  });
});
