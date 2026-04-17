const fs = require('fs');
const path = require('path');

const detailPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'les-detail.js');
const aanmakenPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'les-aanmaken.js');
const lessenPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'lessen.js');
const indexPath = path.join(__dirname, '..', 'netlify-deploy', 'index.html');

describe('lessen.js — module splitsing', () => {
  it('js/les-detail.js bestaat', () => {
    expect(fs.existsSync(detailPath)).toBe(true);
  });

  it('js/les-aanmaken.js bestaat', () => {
    expect(fs.existsSync(aanmakenPath)).toBe(true);
  });

  it('les-detail.js bevat de detail-functies', () => {
    const content = fs.readFileSync(detailPath, 'utf8');
    expect(content).toContain('function openLesDetail');
    expect(content).toContain('function renderLesDetail');
    expect(content).toContain('function startMolVanuitLes');
    expect(content).toContain('function getLesCode');
  });

  it('les-aanmaken.js bevat de aanmaken-functies', () => {
    const content = fs.readFileSync(aanmakenPath, 'utf8');
    expect(content).toContain('function openCreateLesson');
    expect(content).toContain('function createLesson');
    expect(content).toContain('function renderLesvormCheckboxes');
    expect(content).toContain('function saveUniformResult');
    expect(content).toContain('function getBeschikbareLesvormen');
  });

  it('lessen.js bevat nog de dashboard-functies', () => {
    const content = fs.readFileSync(lessenPath, 'utf8');
    expect(content).toContain('function loadTeacherDashboard');
    expect(content).toContain('function loadTeacherLessons');
    expect(content).toContain('function loadLessonsForTeacher');
    expect(content).toContain('function deleteLesson');
    expect(content).toContain('function renderClassenGrid');
  });

  it('geen functie staat in twee bestanden tegelijk', () => {
    const lessen = fs.readFileSync(lessenPath, 'utf8');
    const detail = fs.readFileSync(detailPath, 'utf8');
    const aanmaken = fs.readFileSync(aanmakenPath, 'utf8');
    expect(lessen).not.toContain('function openLesDetail');
    expect(detail).not.toContain('function loadTeacherDashboard');
    expect(lessen).not.toMatch(/function openCreateLesson\b[^V]/);
    expect(lessen).not.toContain('function saveUniformResult');
  });

  it('index.html laadt alle drie bestanden', () => {
    const content = fs.readFileSync(indexPath, 'utf8');
    expect(content).toContain('src="js/les-detail.js"');
    expect(content).toContain('src="js/les-aanmaken.js"');
    expect(content).toContain('src="js/lessen.js"');
  });
});
