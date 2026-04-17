const fs = require('fs');
const path = require('path');

const studentJsPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'student.js');
const indexHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'index.html');

describe('student.js — module extractie', () => {
  it('js/student.js bestaat', () => {
    expect(fs.existsSync(studentJsPath)).toBe(true);
  });

  it('student.js bevat de kernfuncties', () => {
    const content = fs.readFileSync(studentJsPath, 'utf8');
    expect(content).toContain('function startStudentMetCode');
    expect(content).toContain('function startStudentViaKlas');
    expect(content).toContain('function loadLessonsForStudent');
    expect(content).toContain('function sendChatMessage');
    expect(content).toContain('function generateOpgaven');
  });

  it('student.js bevat geen alert() aanroepen', () => {
    const content = fs.readFileSync(studentJsPath, 'utf8');
    expect(content).not.toMatch(/alert\(/);
  });

  it('index.html laadt js/student.js via script tag', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).toContain('src="js/student.js"');
  });

  it('kernfuncties zijn niet meer inline in index.html', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).not.toContain('function startStudentMetCode');
    expect(content).not.toContain('function sendChatMessage');
  });
});
