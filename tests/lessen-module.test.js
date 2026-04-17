const fs = require('fs');
const path = require('path');

const lessenJsPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'lessen.js');
const indexHtmlPath = path.join(__dirname, '..', 'netlify-deploy', 'index.html');

describe('lessen.js — module extractie', () => {
  it('js/lessen.js bestaat', () => {
    expect(fs.existsSync(lessenJsPath)).toBe(true);
  });

  it('lessen.js bevat de kernfuncties', () => {
    const content = fs.readFileSync(lessenJsPath, 'utf8');
    expect(content).toContain('function loadTeacherDashboard');
    expect(content).toContain('function loadTeacherLessons');
    expect(content).toContain('function loadLessonsForTeacher');
    expect(content).toContain('function deleteLesson');
  });

  it('loadLessonsForTeacher is gedefinieerd', () => {
    const content = fs.readFileSync(lessenJsPath, 'utf8');
    expect(content).toContain('function loadLessonsForTeacher');
  });

  it('lessen.js bevat geen alert() aanroepen', () => {
    const content = fs.readFileSync(lessenJsPath, 'utf8');
    expect(content).not.toMatch(/alert\(/);
  });

  it('index.html laadt js/lessen.js via script tag', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).toContain('src="js/lessen.js"');
  });

  it('kernfuncties zijn niet meer inline in index.html', () => {
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(content).not.toContain('function loadTeacherDashboard');
    expect(content).not.toContain('function openLesDetail');
    expect(content).not.toContain('function renderLesDetail');
  });
});
