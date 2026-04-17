const fs = require('fs');
const path = require('path');

const lessenPath = path.join(__dirname, '..', 'netlify-deploy', 'js', 'lessen.js');

describe('refreshCache — gecentraliseerde cache', () => {
  const content = fs.readFileSync(lessenPath, 'utf8');

  it('refreshCache is gedefinieerd in lessen.js', () => {
    expect(content).toContain('async function refreshCache');
  });

  it('refreshCache werkt alle drie caches bij', () => {
    const match = content.match(/async function refreshCache[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    const body = match[0];
    expect(body).toContain('lessonsCache');
    expect(body).toContain('classesCache');
    expect(body).toContain('resultsCache');
  });

  it('loadTeacherDashboard roept refreshCache aan', () => {
    const match = content.match(/async function loadTeacherDashboard[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    expect(match[0]).toContain('refreshCache');
  });

  it('loadTeacherDashboard bevat geen directe apiFetch voor lessons', () => {
    const match = content.match(/async function loadTeacherDashboard[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    expect(match[0]).not.toContain("apiFetch('/api/lessons')");
  });
});
