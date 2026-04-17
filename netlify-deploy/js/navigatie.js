const ALL_VIEWS = [
  'klassen', 'klas-detail', 'leerlingen', 'leerdoelen',
  'lessen', 'les-detail-standalone', 'analyse', 'socratisch'
];

function navNaar(view) {
  huidigView = view;
  huidigKlasId = null;
  ALL_VIEWS.filter(v => v !== 'klas-detail').forEach(v => {
    const el = document.getElementById('nav-' + v);
    if (el) el.classList.toggle('active', v === view);
  });
  const klasHeader = document.getElementById('klas-header');
  if (klasHeader) klasHeader.style.display = 'none';
  ALL_VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById('view-' + view);
  if (target) target.style.display = view === 'klas-detail' ? 'flex' : 'block';
  setBreadcrumb([{ label: navLabel(view) }]);
  setMainActions(view);
  toggleSidebar(false);
  if (view === 'leerlingen') laadLeerlingenTab();
  if (view === 'klassen')   renderClassenGrid(classesCache);
  if (view === 'leerdoelen') laadLeerdoelenTab();
  if (view === 'lessen')    laadLessenView();
  if (view === 'analyse')   { vulAnalyseFilters(); runAnalyse(); }
  if (view === 'socratisch') { vulClassFilter(); loadTeacherLessons(); }
}

function navLabel(view) {
  const map = { klassen:'Mijn klassen', leerlingen:'Leerlingen', lessen:'Lessen', analyse:'Analyse', socratisch:'Socratische toets' };
  return map[view] || view;
}

function setBreadcrumb(stappen) {
  const el = document.getElementById('main-breadcrumb');
  if (!el) return;
  el.innerHTML = stappen.map((s, i) => {
    if (i < stappen.length - 1) {
      return `<button class="bc-link" onclick="${s.onclick || ''}">${s.label}</button>
              <span class="bc-sep">›</span>`;
    }
    return `<span class="bc-current">${s.label}</span>`;
  }).join('');
}

function setMainActions(view, klasId) {
  const el = document.getElementById('main-actions');
  if (!el) return;
  if (view === 'klassen') {
    el.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openCreateClass()">+ Nieuwe klas</button>`;
  } else if (view === 'leerlingen') {
    el.innerHTML = `<button class="btn btn-primary btn-sm" onclick="document.getElementById('xlsx-upload-input').click()">📥 XLSX importeren</button>`;
  } else if (view === 'leerdoelen') {
    el.innerHTML = `<button class="btn btn-ghost-navy btn-sm" onclick="document.getElementById('ld-xlsx-input').click()">📥 Excel importeren</button>
      <button class="btn btn-primary btn-sm" onclick="openLdModal(null)">+ Toevoegen</button>`;
  } else if (view === 'lessen') {
    el.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openCreateLesson()">+ Nieuwe les</button>`;
  } else if (view === 'klas-detail') {
    el.innerHTML = '';
  } else {
    el.innerHTML = '';
  }
}

function openKlas(klasId) {
  huidigView = 'klas-detail';
  huidigKlasId = klasId;
  klasLlKiezerGeselecteerd = new Set();
  klasLlKiezerAlle = [];
  const klas = classesCache.find(c => c.id === klasId);
  if (!klas) { console.warn('Klas niet gevonden in cache:', klasId); navNaar('klassen'); return; }
  document.getElementById('nav-klassen')?.classList.add('active');
  document.getElementById('klas-badge-naam').textContent = klas.name;
  document.getElementById('klas-detail-titel').textContent = klas.name;
  const niveauLbl = { atheneum:'Atheneum', gymnasium:'Gymnasium', havo:'HAVO' }[detecteerNiveau(klas.name)] || '';
  const leerjaar  = detecteerLeerjaar(klas.name);
  document.getElementById('klas-detail-sub').textContent = niveauLbl + (leerjaar ? ' ' + leerjaar : '') + ' · laden...';
  apiFetch('/api/leerlingen?klas=' + encodeURIComponent(klas.name))
    .then(ll => {
      const el = document.getElementById('klas-detail-sub');
      const aantalLl = Array.isArray(ll) ? ll.length : 0;
      if (el) el.textContent = niveauLbl + (leerjaar ? ' ' + leerjaar : '') + (aantalLl ? ' · ' + aantalLl + ' leerlingen' : '');
    }).catch(() => {
      const el = document.getElementById('klas-detail-sub');
      if (el) el.textContent = niveauLbl + (leerjaar ? ' ' + leerjaar : '');
    });
  const kh2 = document.getElementById('klas-header'); if(kh2) kh2.style.display = 'block';
  ALL_VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = 'none';
  });
  const vkd = document.getElementById('view-klas-detail'); if(vkd) vkd.style.display = 'flex';
  setBreadcrumb([
    { label: 'Mijn klassen', onclick: "navNaar('klassen')" },
    { label: klas.name }
  ]);
  setMainActions('klas-detail', klasId);
  toggleSidebar(false);
  switchKlasTab('activiteiten');
}

function switchKlasTab(tab) {
  huidigKlasTab = tab;
  document.querySelectorAll('.klas-tab').forEach((el, i) => {
    const tabs = ['activiteiten','leerlingen','resultaten'];
    el.classList.toggle('active', tabs[i] === tab);
  });
  renderKlasTabContent(tab);
}

function renderKlasTabContent(tab) {
  const klas = classesCache.find(c => c.id === huidigKlasId);
  const wrap = document.getElementById('klas-tab-content');
  if (!wrap) return;
  if (tab === 'activiteiten') renderKlasActiviteiten(klas, wrap);
  if (tab === 'leerlingen')   renderKlasLeerlingen(klas, wrap);
  if (tab === 'resultaten')   renderKlasResultaten(klas, wrap);
}

function toggleSidebar(open) {
  document.getElementById('sidebar')?.classList.toggle('open', open);
  document.getElementById('sidebar-overlay')?.classList.toggle('open', open);
}
