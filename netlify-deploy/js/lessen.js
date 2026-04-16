// ── Les detail ─────────────────────────────────────────────
async function openLesDetail(lesId) {
  // Zoek in cache, anders haal op van server
  let les = lessonsCache.find(l => l.id === lesId);
  if (!les) {
    try {
      const alle = await apiFetch('/api/lessons');
      lessonsCache = alle || [];
      les = lessonsCache.find(l => l.id === lesId);
    } catch(e) { console.error('openLesDetail fetch fout:', e); }
  }
  if (!les) {
    showToast('Les niet gevonden (id: ' + lesId + ')');
    console.error('openLesDetail: les niet gevonden', lesId, 'cache:', lessonsCache.length);
    return;
  }

  // Verberg alle views
  ['klassen','klas-detail','leerlingen','leerdoelen','lessen',
   'les-detail-standalone','analyse','socratisch'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = 'none';
  });

  // Toon detail view
  const dv = document.getElementById('view-les-detail-standalone');
  if (dv) {
    dv.style.display = 'block';
  } else {
    console.error('view-les-detail-standalone niet gevonden in DOM');
    return;
  }

  // Klas-header verbergen
  const kh = document.getElementById('klas-header');
  if (kh) kh.style.display = 'none';

  // Sidebar + breadcrumb
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-lessen')?.classList.add('active');
  huidigView = 'les-detail-standalone';
  huidigKlasId = null;

  setBreadcrumb([
    { label: 'Lessen', onclick: "navNaar('lessen')" },
    { label: les.name }
  ]);

  const ma = document.getElementById('main-actions');
  if (ma) ma.innerHTML = '';

  toggleSidebar(false);
  renderLesDetail(les);
}

function renderLesDetail(les) {
  const wrap = document.getElementById('les-detail-content');
  if (!wrap) return;
  const code  = getLesCode(les.id);
  const datum = les.created_at
    ? new Date(les.created_at).toLocaleDateString('nl-NL', { day:'numeric', month:'long', year:'numeric' })
    : '';
  const klasNamen = (les.class_ids || [])
    .map(id => classesCache.find(c => c.id === id)?.name)
    .filter(Boolean);
  const klasNaam = klasNamen.join(', ');

  // Parse leerdoelen uit content
  const content = les.content || '';
  const secties = { kennen: [], kunnen: [] };
  let huidigType = null;
  content.split('\n').forEach(regel => {
    const r = regel.trim();
    if (r.toLowerCase().startsWith('kennen:') || r.toLowerCase() === 'kennen') { huidigType = 'kennen'; return; }
    if (r.toLowerCase().startsWith('kunnen:') || r.toLowerCase() === 'kunnen') { huidigType = 'kunnen'; return; }
    if (r.startsWith('- ') && huidigType) secties[huidigType].push(r.slice(2));
  });

  const renderLdSectie = (lijst, type) => {
    if (!lijst.length) return '';
    return `<div style="margin-bottom:1rem;">
      <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;
        color:${type==='kennen'?'#3b82f6':'#1a6a40'};margin-bottom:8px;">${type==='kennen'?'Kennen':'Kunnen'}</div>
      ${lijst.map(ld => `<div class="les-leerdoel-rij">
        <span class="ld-badge ld-badge-${type}" style="flex-shrink:0;margin-top:2px;">${type==='kennen'?'K':'V'}</span>
        <span>${ld}</span>
      </div>`).join('')}
    </div>`;
  };

  const aantalLd = secties.kennen.length + secties.kunnen.length;
  const safeId   = les.id.replace(/'/g, "\'");
  const safeName = (les.name||'').replace(/'/g, "\'");
  const safeContent = encodeURIComponent(content);

  wrap.innerHTML = `
    <div class="les-detail-header">
      <div>
        <div class="page-eyebrow">Les</div>
        <h2 class="page-title" style="margin-bottom:4px;">${les.name}</h2>
        ${datum ? `<div style="font-size:0.82rem;color:var(--muted);">📅 ${datum}</div>` : ''}
        ${klasNaam
          ? `<div style="font-size:0.82rem;color:var(--muted);margin-top:2px;">🏫 ${klasNaam}</div>`
          : `<div style="font-size:0.82rem;color:var(--muted);margin-top:2px;">Geen klas gekoppeld</div>`}
      </div>
      <div style="text-align:right;">
        <div class="les-detail-code">${code}</div>
        <div style="font-size:0.68rem;color:var(--muted);margin-top:4px;">Leerling-toegangscode</div>
      </div>
    </div>

    <!-- Stats strip -->
    <div style="display:flex;gap:12px;margin-bottom:1.5rem;flex-wrap:wrap;">
      <div class="stat-card" style="flex:1;min-width:120px;">
        <div class="stat-val">${aantalLd}</div>
        <div class="stat-lbl">Leerdoelen</div>
      </div>
      <div class="stat-card" style="flex:1;min-width:120px;">
        <div class="stat-val">${secties.kennen.length}</div>
        <div class="stat-lbl">Kennen</div>
      </div>
      <div class="stat-card" style="flex:1;min-width:120px;">
        <div class="stat-val">${secties.kunnen.length}</div>
        <div class="stat-lbl">Kunnen</div>
      </div>
      ${les.werkvorm ? `<div class="stat-card" style="flex:1;min-width:120px;">
        <div class="stat-val">${les.werkvorm === 'mol' ? '🕵️' : '💬'}</div>
        <div class="stat-lbl">${les.werkvorm === 'mol' ? 'Wie is de Mol' : 'Socratisch'}</div>
      </div>` : ''}
    </div>

    <!-- Wervormen -->
    <div style="margin-bottom:1.5rem;">
      <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;
        color:var(--muted);margin-bottom:10px;">Starten als werkvorm</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-ghost-navy" onclick="openLesResultatenVanLessen('${safeId}')"
          style="display:flex;align-items:center;gap:8px;">
          💬 Socratische toets
        </button>
        <button class="btn btn-primary" onclick="startMolVanuitLes('${safeId}','${safeName}','${safeContent}')"
          style="background:#1B3A6B;display:flex;align-items:center;gap:8px;">
          🕵️ Wie is de Mol starten
        </button>
      </div>
    </div>

    <!-- Leerdoelen -->
    ${aantalLd ? `
    <div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:1.25rem;">
      <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;
        color:var(--muted);margin-bottom:1rem;">Leerdoelen</div>
      ${renderLdSectie(secties.kennen, 'kennen')}
      ${renderLdSectie(secties.kunnen, 'kunnen')}
    </div>` : `
    <div class="empty-state">
      <div class="empty-icon">🎯</div>
      <p>Geen leerdoelen gekoppeld aan deze les.</p>
    </div>`}

    <!-- Acties onderaan -->
    <div style="display:flex;gap:8px;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border);">
      <button class="btn btn-ghost-navy btn-sm" style="color:var(--red);border-color:rgba(192,57,43,0.25);"
        onclick="deleteLesson('${safeId}','${safeName}')">🗑 Les verwijderen</button>
    </div>`;
}

function startMolVanuitLes(lesId, lesNaam, lesContent) {
  const decoded = decodeURIComponent(lesContent);
  const url = 'mol-lesvorm.html'
    + '?leraar='      + encodeURIComponent(leraarToken || '')
    + '&les_naam='    + encodeURIComponent(lesNaam)
    + '&les_content=' + encodeURIComponent(decoded)
    + '&direct_setup=1';
  window.open(url, '_blank');
}

// ── Les code helper ─────────────────────────────────────────
function getLesCode(lesId) {
  return lesId ? lesId.slice(0, 4).toUpperCase() : '—';
}

// ── Les helpers ─────────────────────────────────────────────
async function getLessons(classId) {
  const qs = classId ? '?class_id=' + classId : '';
  return await apiFetch('/api/lessons' + qs);
}

async function getClasses() {
  return await apiFetch('/api/classes');
}

// Detecteer niveau uit klas-naam (Stanislascollege conventie)
function detecteerNiveau(naam) {
  if (!naam) return 'atheneum';
  const n = naam.toLowerCase();
  if (/^w[va]/.test(n) || n.includes('atheneum') || n.includes('vwo')) return 'atheneum';
  if (/^wh/.test(n) || n.includes('havo'))    return 'havo';
  if (/^wg/.test(n) || n.includes('gym'))     return 'gymnasium';
  return 'atheneum';
}

// Haal eerste getal uit klas-naam als leerjaar
function detecteerLeerjaar(naam) {
  const m = (naam || '').match(/\d/);
  return m ? m[0] : '';
}

// Laad klassen voor leerling-dropdown op landingspagina
async function loadClasses() {
  try {
    const klassen = await apiFetch('/api/classes');
    classesCache = klassen || [];
    populateStudentClassDropdown();
  } catch(e) { console.warn('loadClasses fout:', e.message); }
}

function populateStudentClassDropdown() {
  const sel = document.getElementById('student-class');
  if (classesCache.length === 0) {
    sel.innerHTML = '<option value="">— Geen klassen beschikbaar —</option>';
  } else {
    sel.innerHTML = '<option value="">— Kies jouw klas —</option>';
    classesCache.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
  }
}

// ── Lesvormen ───────────────────────────────────────────────
function getBeschikbareLesvormen(lesson) {
  const toegestaan = lesson?.toegestane_lesvormen;
  if (!toegestaan || toegestaan.length === 0) {
    // null = alles toegestaan
    return Object.values(LESVORMEN_REGISTRY);
  }
  return toegestaan
    .filter(id => LESVORMEN_REGISTRY[id])
    .map(id => LESVORMEN_REGISTRY[id]);
}

// ═══════════════════════════════════════════════════════════
//  UNIFORME RESULTAATOPSLAG — alle lesvormen gebruiken dit
// ═══════════════════════════════════════════════════════════
async function saveUniformResult({ lesvorm, scoreNorm, lesvormData, extraFields = {} }) {
  currentResultId = currentResultId || ('result_' + Date.now());
  const payload = {
    id:             currentResultId,
    lesson_id:      selectedLesson.id,
    lesson_name:    selectedLesson.name,
    student_name:   studentName,
    class_id:       selectedClass ? selectedClass.id   : null,
    class_name:     selectedClass ? selectedClass.name : null,
    timestamp:      Date.now(),
    // Nieuwe platformvelden:
    lesvorm,           // 'socratisch' | 'quiz' | ...
    score_norm:  scoreNorm !== null ? Math.round(scoreNorm * 10) / 10 : null,
    lesvorm_data: lesvormData || null,
    ...extraFields,    // lesvorm-specifieke velden voor backwards-compatibiliteit
  };
  try {
    await apiFetch('/api/results', { method: 'POST', body: JSON.stringify(payload) });
  } catch(e) {
    console.error('[saveUniformResult] mislukt:', e);
  }
  return currentResultId;
}

// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════




function renderLesvormCheckboxes() {
  const container = document.getElementById('lesvormen-checkboxes');
  container.innerHTML = '';
  Object.values(LESVORMEN_REGISTRY).forEach(lv => {
    const checked = selectedLesvormen.includes(lv.id);
    const row = document.createElement('label');
    row.className = 'lv-check-row' + (checked ? ' checked' : '');
    row.innerHTML = `
      <input type="checkbox" value="${lv.id}" ${checked ? 'checked' : ''}
        onchange="toggleLesvormCheck(this)">
      <span class="lv-icoon">${lv.icoon}</span>
      <div style="flex:1;min-width:0;">
        <div class="lv-naam">${lv.naam}</div>
        <div class="lv-desc">${lv.beschrijving}</div>
      </div>
      <span class="lv-duur">${lv.duur}</span>`;
    container.appendChild(row);
  });
}

function toggleLesvormCheck(cb) {
  const id = cb.value;
  if (cb.checked) {
    if (!selectedLesvormen.includes(id)) selectedLesvormen.push(id);
  } else {
    selectedLesvormen = selectedLesvormen.filter(x => x !== id);
    if (selectedLesvormen.length === 0) {
      // Minimaal één lesvorm verplicht — zet terug
      cb.checked = true;
      selectedLesvormen.push(id);
      return;
    }
  }
  cb.closest('.lv-check-row').className = 'lv-check-row' + (cb.checked ? ' checked' : '');
  updateModeBtns();
}

function setLesvormMode(mode) {
  lesvormMode = mode;
  updateModeBtns();
}

function updateModeBtns() {
  document.getElementById('mode-btn-locked').classList.toggle('active', lesvormMode === 'locked');
  document.getElementById('mode-btn-free').classList.toggle('active',   lesvormMode === 'free');
  const count = selectedLesvormen.length;
  const hint  = document.getElementById('mode-hint');
  if (lesvormMode === 'locked' || count <= 1) {
    hint.textContent = 'Leerlingen worden direct naar de lesvorm gestuurd — geen keuze.';
  } else {
    hint.textContent = `Leerlingen kiezen zelf uit ${count} lesvormen.`;
  }
}

// ── Les aanmaken ────────────────────────────────────────────
async function openCreateLesson() {
  // Reset
  document.getElementById('new-lesson-name').value = '';
  document.getElementById('new-lesson-content').value = '';
  document.getElementById('new-lesson-content-auto').value = '';
  document.getElementById('create-lesson-error').style.display = 'none';
  lesLdGeselecteerd = new Set();
  selectedLesvormen = ['socratisch'];
  lesvormMode = 'locked';

  openModal('modal-create-lesson');

  // Laad leerdoelen uit DB
  const leegHint = document.getElementById('les-ld-leeg-hint');
  try {
    lesLdAlle = await apiFetch('/api/leerdoelen');
    if (!lesLdAlle.length) {
      if (leegHint) leegHint.textContent = 'Geen leerdoelen gevonden. Upload eerst leerdoelen via het Leerdoelen-menu.';
    } else {
      if (leegHint) leegHint.textContent = lesLdAlle.length + ' leerdoelen beschikbaar. Kies filters hieronder.';
      vulLesLdFilterDropdowns();
    }
  } catch(e) {
    if (leegHint) leegHint.textContent = 'Laden mislukt: ' + e.message;
  }
}

function vulLesLdFilterDropdowns() {
  // Niveau
  const niveaus = [...new Set(lesLdAlle.map(l => l.niveau).filter(Boolean))].sort();
  const nvSel = document.getElementById('les-ld-niveau');
  nvSel.innerHTML = '<option value="">— Niveau —</option>'
    + niveaus.map(n => `<option value="${n}">${n}</option>`).join('');

  // Lesbrief
  const lesbrieven = [...new Set(lesLdAlle.map(l => l.lesbrief).filter(Boolean))].sort();
  const lbSel = document.getElementById('les-ld-lesbrief');
  lbSel.innerHTML = '<option value="">— Lesbrief —</option>'
    + lesbrieven.map(lb => `<option value="${lb}">${lb}</option>`).join('');

  // Hoofdstuk leeg (wordt gevuld na lesbrief-keuze)
  document.getElementById('les-ld-hoofdstuk').innerHTML = '<option value="">— Hfst. —</option>';
}

function onLesLdLesbriefChange() {
  const lb = document.getElementById('les-ld-lesbrief').value;
  // Vul hoofdstuk-dropdown afhankelijk van lesbrief
  const bron = lb ? lesLdAlle.filter(l => l.lesbrief === lb) : lesLdAlle;
  const hoofdstukken = [...new Set(bron.map(l => l.hoofdstuk).filter(Boolean))].sort((a,b) => {
    const n1 = parseInt(a.replace(/\D/g,'')) || 0, n2 = parseInt(b.replace(/\D/g,'')) || 0;
    return n1 !== n2 ? n1 - n2 : a.localeCompare(b);
  });
  const hfstSel = document.getElementById('les-ld-hoofdstuk');
  hfstSel.innerHTML = '<option value="">— Hfst. —</option>'
    + hoofdstukken.map(h => `<option value="${h}">${h}</option>`).join('');

  // Auto-vul naam als lesbrief + hoofdstuk bekend
  const hfst = hfstSel.value;
  if (lb && hfst) {
    const autoNaam = document.getElementById('new-lesson-name');
    if (!autoNaam.value) autoNaam.value = lb + ' — ' + hfst;
  }
  onLesLdFilter();
}

function onLesLdFilter() {
  const niveau    = document.getElementById('les-ld-niveau')?.value    || '';
  const lesbrief  = document.getElementById('les-ld-lesbrief')?.value  || '';
  const hoofdstuk = document.getElementById('les-ld-hoofdstuk')?.value || '';
  const type      = document.getElementById('les-ld-type')?.value      || '';

  lesLdGefilterd = lesLdAlle.filter(l => {
    return (!niveau    || l.niveau    === niveau)
        && (!lesbrief  || l.lesbrief  === lesbrief)
        && (!hoofdstuk || l.hoofdstuk === hoofdstuk)
        && (!type      || l.type      === type);
  });

  // Auto-vul lesnaam als lesbrief + hoofdstuk gekozen
  if (lesbrief && hoofdstuk) {
    const autoNaam = document.getElementById('new-lesson-name');
    if (!autoNaam.value) autoNaam.value = lesbrief + ' — ' + hoofdstuk;
  }

  renderLesLdLijst();
}

function renderLesLdLijst() {
  const lijst = document.getElementById('les-ld-lijst');
  if (!lijst) return;

  if (!lesLdGefilterd.length) {
    lijst.innerHTML = '<div style="padding:0.75rem;text-align:center;color:var(--muted);font-size:0.82rem;">'
      + (lesLdAlle.length ? 'Geen leerdoelen voor deze filters.' : 'Geen leerdoelen beschikbaar.') + '</div>';
    updateLesLdTelling();
    return;
  }

  // Groepeer per type voor leesbaarheid
  const kennen = lesLdGefilterd.filter(l => l.type === 'kennen');
  const kunnen = lesLdGefilterd.filter(l => l.type === 'kunnen');

  const renderGroep = (groep, label) => {
    if (!groep.length) return '';
    return `<div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;
        color:var(--muted);padding:6px 8px 3px;">${label}</div>`
      + groep.map(l => {
          const sel = lesLdGeselecteerd.has(l.id);
          return `<div class="ll-picker-rij ${sel?'geselecteerd':''}"
            onclick="toggleLesLd('${l.id}')" data-les-ld-id="${l.id}">
            <div class="ll-picker-check">${sel?'✓':''}</div>
            <span class="ll-picker-naam" style="font-size:0.82rem;font-weight:400;">${l.lesdoel}</span>
          </div>`;
        }).join('');
  };

  lijst.innerHTML = renderGroep(kennen, 'Kennen') + renderGroep(kunnen, 'Kunnen');
  updateLesLdTelling();
}

function toggleLesLd(id) {
  if (lesLdGeselecteerd.has(id)) lesLdGeselecteerd.delete(id);
  else lesLdGeselecteerd.add(id);
  const el = document.querySelector(`[data-les-ld-id="${id}"]`);
  if (el) {
    const sel = lesLdGeselecteerd.has(id);
    el.classList.toggle('geselecteerd', sel);
    el.querySelector('.ll-picker-check').textContent = sel ? '✓' : '';
  }
  updateLesLdTelling();
  updateLesLdPreview();
}

function selecteerAlleLesLd()  { lesLdGefilterd.forEach(l => lesLdGeselecteerd.add(l.id));    renderLesLdLijst(); updateLesLdPreview(); }
function deselecteerAlleLesLd(){ lesLdGefilterd.forEach(l => lesLdGeselecteerd.delete(l.id)); renderLesLdLijst(); updateLesLdPreview(); }

function updateLesLdTelling() {
  const el = document.getElementById('les-ld-telling');
  if (el) el.textContent = lesLdGeselecteerd.size
    ? lesLdGeselecteerd.size + ' geselecteerd'
    : lesLdGefilterd.length + ' gevonden';
}

function updateLesLdPreview() {
  const prev = document.getElementById('les-ld-preview');
  const tags = document.getElementById('les-ld-preview-tags');
  const geselecteerd = lesLdAlle.filter(l => lesLdGeselecteerd.has(l.id));
  if (!geselecteerd.length) { if (prev) prev.style.display = 'none'; return; }
  if (prev) prev.style.display = 'block';
  if (tags) tags.innerHTML = geselecteerd.map(l =>
    `<span class="ld-badge ld-badge-${l.type||'kennen'}" style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
      title="${l.lesdoel}">${l.lesdoel.length>60?l.lesdoel.slice(0,60)+'…':l.lesdoel}</span>`
  ).join('');
  // Bouw content-string voor AI
  const kennen = geselecteerd.filter(l => l.type==='kennen').map(l => l.lesdoel);
  const kunnen = geselecteerd.filter(l => l.type==='kunnen').map(l => l.lesdoel);
  const lb = document.getElementById('les-ld-lesbrief')?.value || '';
  const hf = document.getElementById('les-ld-hoofdstuk')?.value || '';
  let content = '';
  if (lb) content += 'Lesbrief: ' + lb + '\n';
  if (hf) content += 'Hoofdstuk: ' + hf + '\n';
  if (kennen.length) content += '\nKennen:\n' + kennen.map(k => '- ' + k).join('\n');
  if (kunnen.length) content += '\n\nKunnen:\n' + kunnen.map(k => '- ' + k).join('\n');
  document.getElementById('new-lesson-content-auto').value = content;
  document.getElementById('new-lesson-content').value = content;
}

// Legacy stubs (niet meer nodig maar voorkomen JS-errors)
function onLesbriefChange() { onLesLdLesbriefChange(); }
function onHoofdstukChange() { onLesLdFilter(); }
function renderLeerdoelenPreview() {}

function toggleLeerdoelenEdit() {
  const sec = document.getElementById('manual-edit-section');
  const isHidden = sec.style.display === 'none';
  sec.style.display = isHidden ? 'block' : 'none';
}

async function createLesson() {
  const name = document.getElementById('new-lesson-name').value.trim();
  const err  = document.getElementById('create-lesson-error');
  const btn  = document.getElementById('create-lesson-btn');

  if (!name) { err.textContent = 'Vul een lesnaam in.'; err.style.display = 'block'; return; }
  err.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Aanmaken...';

  // Bouw content-string uit geselecteerde leerdoelen
  const geselecteerd = lesLdAlle.filter(l => lesLdGeselecteerd.has(l.id));
  const kennen = geselecteerd.filter(l => l.type === 'kennen').map(l => l.lesdoel);
  const kunnen = geselecteerd.filter(l => l.type === 'kunnen').map(l => l.lesdoel);
  const lb  = document.getElementById('les-ld-lesbrief')?.value  || '';
  const hf  = document.getElementById('les-ld-hoofdstuk')?.value || '';
  let content = '';
  if (lb) content += 'Lesbrief: ' + lb + '\n';
  if (hf) content += 'Hoofdstuk: ' + hf + '\n';
  if (kennen.length) content += '\nKennen:\n' + kennen.map(k => '- ' + k).join('\n');
  if (kunnen.length) content += '\n\nKunnen:\n' + kunnen.map(k => '- ' + k).join('\n');
  if (!content) content = name;

  const id = 'lesson_' + Date.now();
  const lesson = {
    id, name,
    content,
    chapter_val:          hf || null,
    created_at:           Date.now(),
    toegestane_lesvormen: ['socratisch'],
    lesvorm_mode:         'locked',
  };

  try {
    await apiFetch('/api/lessons', { method: 'POST', body: JSON.stringify(lesson) });
  } catch(e) {
    err.textContent = 'Opslaan mislukt: ' + e.message; err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Les aanmaken'; return;
  }
  btn.disabled = false; btn.textContent = 'Les aanmaken';
  closeModal('modal-create-lesson');
  showToast('✓ Les "' + name + '" aangemaakt!');
  await loadTeacherDashboard();
}

// ── Dashboard filters ───────────────────────────────────────
async function onClassFilterChange() {
  // Re-filter lesson dropdown based on selected class
  const classId = document.getElementById('teacher-class-filter').value;
  const allLessons = await apiFetch('/api/lessons');
  const sel = document.getElementById('teacher-lesson-select');
  sel.innerHTML = '<option value="">— Kies een les —</option>';
  const filtered = classId
    ? allLessons.filter(l => (l.class_ids || []).includes(classId))
    : allLessons;
  filtered.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id; opt.textContent = l.name;
    sel.appendChild(opt);
  });
  document.getElementById('student-results-area').innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Selecteer een les om de resultaten te zien.</p></div>';
}

// ── Klas → les helpers ──────────────────────────────────────
function openCreateLessonVoorKlas(klasId) {
  document.getElementById('act-dropdown')?.classList.remove('open');
  openCreateLesson();
  // Selecteer klas automatisch
  setTimeout(() => {
    const sel = document.getElementById('new-lesson-class');
    if (sel && klasId) sel.value = klasId;
  }, 100);
}

// ── Klassen grid ────────────────────────────────────────────
function renderClassenGrid(klassen) {
  // Zorg altijd dat view-klassen zichtbaar is als deze functie wordt aangeroepen
  const grid = document.getElementById('classes-grid-new');
  if (!grid) { console.error('classes-grid-new niet gevonden!'); return; }

  const niveauCls = nv => {
    const l = (nv || '').toLowerCase();
    return l === 'gymnasium' ? 'niveau-gymnasium' : l === 'havo' ? 'niveau-havo' : 'niveau-atheneum';
  };
  const escQ = s => (s || '').replace(/'/g, "\'");

  const kaart = k => {
    const nv     = k.niveau   || '';
    const lj     = k.leerjaar || detecteerLeerjaar(k.name) || '';
    const meta   = [nv, lj ? 'Leerjaar ' + lj : ''].filter(Boolean).join(' · ');
    const lessen = (lessonsCache || []).filter(l => (l.class_ids || []).includes(k.id));
    return `<div class="class-card">
      <div class="class-card-naam" onclick="openKlas('${k.id}')" style="cursor:pointer;">${k.name}</div>
      ${meta ? `<div class="class-card-meta">${meta}</div>` : ''}
      <div class="class-card-stats" style="margin-top:8px;">
        <div class="class-card-stat"><strong>${lessen.length}</strong> les${lessen.length !== 1 ? 'sen' : ''}</div>
        <div class="class-card-stat" id="ll-count-${k.id}"><span style="color:var(--muted);">…</span></div>
      </div>
      ${nv ? `<span class="niveau-tag ${niveauCls(nv)}" style="margin-top:8px;display:inline-block;">${nv}</span>` : ''}
      <div class="class-card-acties">
        <button class="btn-open" onclick="openKlas('${k.id}')">Openen</button>
        <button class="btn-edit" onclick="event.stopPropagation();openEditClass('${k.id}')">✏ Bewerken</button>
        <button class="btn-del"  onclick="event.stopPropagation();deleteClass('${k.id}','${escQ(k.name)}')">🗑</button>
      </div>
    </div>`;
  };

  if (!klassen || klassen.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:2rem;">
      <div class="empty-icon">🏫</div><p>Nog geen klassen. Klik op "+ Nieuwe klas".</p>
    </div>`;
  } else {
    grid.innerHTML = klassen.map(kaart).join('') +
      `<div class="class-card class-card-add" onclick="openCreateClass()">
        <div style="font-size:22px;margin-bottom:4px;color:var(--navy);">+</div>
        <div style="font-size:12px;font-weight:500;">Nieuwe klas</div>
       </div>`;
    // Leerlingenaantallen asynchroon
    klassen.forEach(k => {
      apiFetch('/api/leerlingen?klas=' + encodeURIComponent(k.name))
        .then(ll => {
          const el = document.getElementById('ll-count-' + k.id);
          if (el) el.innerHTML = '<strong>' + (Array.isArray(ll) ? ll.length : 0) + '</strong> leerlingen';
        }).catch(() => {});
    });
  }
}

// ── Lessen weergave ─────────────────────────────────────────
function laadLessenView() {
  loadTeacherLessons();
}

async function loadTeacherLessons() {
  const grid  = document.getElementById('teacher-lessons-grid');
  const noMsg = document.getElementById('no-lessons-teacher');
  if (!grid) return;

  grid.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);grid-column:1/-1;"><span class="spinner" style="border-top-color:var(--navy);display:inline-block;margin-right:8px;"></span>Lessen laden...</div>';

  try {
    const lessen = await apiFetch('/api/lessons');
    lessonsCache = lessen || [];
  } catch(e) {
    grid.innerHTML = '<p style="color:var(--red);font-size:0.85rem;grid-column:1/-1;">Laden mislukt: ' + e.message + '</p>';
    return;
  }

  if (!lessonsCache.length) {
    grid.innerHTML = '';
    if (noMsg) noMsg.style.display = 'block';
    return;
  }
  if (noMsg) noMsg.style.display = 'none';

  grid.innerHTML = lessonsCache.map(l => {
    const datum    = l.created_at
      ? new Date(l.created_at).toLocaleDateString('nl-NL', { day:'numeric', month:'short', year:'numeric' })
      : '';
    const code     = getLesCode(l.id);
    const klasNaam = (l.class_ids || [])
      .map(id => classesCache.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(', ');
    const safeId   = (l.id   || '').replace(/'/g, "\'");
    const safeName = (l.name || '').replace(/'/g, "\'");
    const aantalLd = (l.content?.match(/^- .+/gm) || []).length;

    return `<div class="lesson-card" style="display:flex;flex-direction:column;gap:0;cursor:pointer;"
      onclick="openLesDetail('${safeId}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
        <div class="lesson-card-name" style="font-size:15px;font-weight:700;color:var(--navy);">${l.name}</div>
        <span style="font-family:'DM Mono',monospace;font-size:0.68rem;background:var(--navy-glow);
          color:var(--navy);padding:2px 7px;border-radius:4px;white-space:nowrap;flex-shrink:0;">${code}</span>
      </div>
      ${datum    ? `<div style="font-size:0.75rem;color:var(--muted);margin-top:3px;">📅 ${datum}</div>` : ''}
      ${klasNaam ? `<div style="font-size:0.75rem;color:var(--muted);margin-top:2px;">🏫 ${klasNaam}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
        ${aantalLd ? `<span class="ld-badge ld-badge-niveau">${aantalLd} leerdoelen</span>` : ''}
        <span class="ld-badge" style="background:rgba(46,107,62,0.1);color:#1a6a40;">💬 Socratisch</span>
        <span class="ld-badge" style="background:rgba(200,169,81,0.1);color:#8a6200;">🕵️ Mol</span>
      </div>
      <div style="font-size:0.72rem;color:var(--muted);margin-top:8px;padding-top:8px;
        border-top:1px solid var(--border);">Klik voor details →</div>
    </div>`;
  }).join('');
}

function openLesResultatenVanLessen(lesId) {
  navNaar('socratisch');
  setTimeout(() => {
    const sel = document.getElementById('teacher-lesson-select');
    if (sel) { sel.value = lesId; loadStudentResults(); }
  }, 150);
}

// ── Socratisch-view filterhulp ─────────────────────────────
function vulClassFilter() {
  const sel = document.getElementById('teacher-class-filter');
  if (!sel || !classesCache) return;
  sel.innerHTML = '<option value="">— Alle klassen —</option>';
  classesCache.forEach(c => sel.add(new Option(c.name, c.id)));
}

// ── Dashboard ───────────────────────────────────────────────
async function loadTeacherDashboard() {
  try {
    const [classes, lessons, results] = await Promise.all([
      apiFetch('/api/classes'),
      apiFetch('/api/lessons'),
      apiFetch('/api/results'),
    ]);
    classesCache  = classes  || [];
    lessonsCache  = lessons  || [];
    resultsCache  = results  || [];

    // ── Klassen-grid renderen ─────────────────────────────
    renderClassenGrid(classesCache);

    // ── Dashboard greeting ────────────────────────────────
    const uur   = new Date().getHours();
    const groet = uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond';
    const naam  = leraarProfiel?.naam?.split(' ')[0] || 'Leraar';
    const greetEl = document.getElementById('dashboard-greeting');
    if (greetEl) greetEl.textContent = groet + ', ' + naam;
    const subEl = document.getElementById('dashboard-sub');
    if (subEl) subEl.textContent = 'Schooljaar 2025–2026 · ' + classesCache.length + ' klassen · ' + lessonsCache.length + ' lessen';

    // ── Stats ─────────────────────────────────────────────
    const stats = document.getElementById('dashboard-stats');
    if (stats) {
      const uniekeLL = new Set(resultsCache.map(r => r.student_name)).size;
      stats.innerHTML = `
        <div class="stat-card"><div class="stat-val">${classesCache.length}</div><div class="stat-lbl">Klassen</div></div>
        <div class="stat-card"><div class="stat-val">${lessonsCache.length}</div><div class="stat-lbl">Lessen</div></div>
        <div class="stat-card"><div class="stat-val">${uniekeLL}</div><div class="stat-lbl">Actieve leerlingen</div></div>
        <div class="stat-card"><div class="stat-val">${resultsCache.length}</div><div class="stat-lbl">Resultaten</div></div>
      `;
    }

    // ── Sidebar naam + avatar ─────────────────────────────
    const avatarEl = document.getElementById('sidebar-avatar');
    const naamEl   = document.getElementById('sidebar-naam');
    if (leraarProfiel) {
      if (avatarEl) {
        const initials = leraarProfiel.naam.split(' ').filter(Boolean).map(w => w[0]).slice(0,2).join('').toUpperCase();
        avatarEl.textContent = initials;
      }
      if (naamEl) naamEl.textContent = leraarProfiel.naam;
    }

    // ── Acties voor klassen-view ──────────────────────────
    setMainActions('klassen');

    // ── Socratisch-filters vullen ─────────────────────────
    vulClassFilter();
    loadTeacherLessons();

  } catch(e) {
    console.error('loadTeacherDashboard fout:', e);
  }
}

async function deleteLesson(id, name) {
  if (!confirm(`Weet je zeker dat je de les "${name}" wilt verwijderen? Alle resultaten worden ook verwijderd.`)) return;
  try {
    await apiFetch('/api/lessons/' + id, { method: 'DELETE' });
    showToast('Les verwijderd.');
    loadTeacherDashboard();
  } catch(e) {
    showToast('Verwijderen mislukt: ' + e.message);
  }
}

// ── Resultaten ──────────────────────────────────────────────
async function loadStudentResults() {
  const lessonId = document.getElementById('teacher-lesson-select').value;
  const area = document.getElementById('student-results-area');
  if (!lessonId) {
    area.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Selecteer een les om de resultaten te zien.</p></div>';
    return;
  }
  let rawResults;
  try { rawResults = await apiFetch('/api/results/' + lessonId); }
  catch(e) { area.innerHTML = '<div class="empty-state"><p>Laden mislukt: ' + e.message + '</p></div>'; return; }
  if (rawResults.length === 0) {
    area.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>Nog geen leerlingen hebben deze les geoefend.</p></div>';
    return;
  }

  // Normalize API field names to camelCase for the rest of the UI
  resultsCache = rawResults.map(r => ({
    studentName:        r.student_name,
    lessonName:         r.lesson_name,
    lessonId:           r.lesson_id,
    className:          r.class_name,
    classId:            r.class_id,
    understanding:      r.understanding,
    reflGoed:           r.refl_goed,
    reflVerbeteren:     r.refl_verbeteren,
    messages:           r.messages || [],
    scores:             r.scores || [],
    opgaven:            r.opgaven || null,
    opgavenAntwoorden:  r.opgaven_antwoorden || null,
    opgavenFeedback:    r.opgaven_feedback || null,
    timestamp:          r.timestamp
  }));
  resultsCache.sort((a,b) => b.timestamp - a.timestamp);

  const n_verdiept    = resultsCache.filter(r => r.understanding === 'verdiept').length;
  const n_analyserend = resultsCache.filter(r => r.understanding === 'analyserend').length;
  const n_toepassend  = resultsCache.filter(r => r.understanding === 'toepassend').length;
  const n_begrijpend  = resultsCache.filter(r => r.understanding === 'begrijpend').length;
  const n_beginnend   = resultsCache.filter(r => r.understanding === 'beginnend').length;
  const n_onvoldoende = resultsCache.filter(r => r.understanding === 'onvoldoende').length;
  // backwards compat with old data
  const n_uitstekend_old = resultsCache.filter(r => r.understanding === 'uitstekend').length;
  const n_goed_old       = resultsCache.filter(r => r.understanding === 'goed').length;
  const n_matig_old      = resultsCache.filter(r => r.understanding === 'matig').length;
  const total = resultsCache.length;

  const niveaus = [
    { key:'verdiept',    label:'💡 Verdiept',    count: n_verdiept + n_uitstekend_old, color:'var(--purple)',  bg:'rgba(90,74,138,0.12)',   border:'rgba(90,74,138,0.4)'   },
    { key:'analyserend', label:'🔍 Analyserend', count: n_analyserend,                  color:'var(--accent)',  bg:'rgba(0,122,122,0.10)',   border:'rgba(0,122,122,0.35)'  },
    { key:'toepassend',  label:'🔄 Toepassend',  count: n_toepassend + n_goed_old,      color:'var(--green)',   bg:'rgba(46,139,74,0.10)',   border:'rgba(46,139,74,0.35)'  },
    { key:'begrijpend',  label:'📖 Begrijpend',  count: n_begrijpend + n_matig_old,     color:'#6d9e35',        bg:'rgba(139,195,74,0.12)',  border:'rgba(139,195,74,0.4)'  },
    { key:'beginnend',   label:'🌱 Beginnend',   count: n_beginnend,                    color:'var(--orange)', bg:'rgba(212,130,10,0.10)',  border:'rgba(212,130,10,0.35)' },
    { key:'onvoldoende', label:'❌ Onvoldoende', count: n_onvoldoende,                  color:'var(--red)',     bg:'rgba(192,57,43,0.10)',   border:'rgba(192,57,43,0.35)'  },
  ];

  let html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.6rem;margin-bottom:1.5rem;">';
  niveaus.forEach(n => {
    html += '<div style="background:' + n.bg + ';border:1.5px solid ' + n.border + ';border-radius:10px;padding:0.75rem;text-align:center;">' +
      '<div style="font-family:Raleway,sans-serif;font-weight:800;font-size:1.9rem;color:' + n.color + ';">' + n.count + '</div>' +
      '<div style="font-size:0.72rem;color:' + n.color + ';margin-top:0.15rem;">' + n.label + '</div></div>';
  });
  html += '</div>';

  const barColors = ['var(--purple)','var(--accent)','var(--green)','#8bc34a','var(--orange)','var(--red)'];
  html += '<div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:1.1rem 1.25rem;margin-bottom:1.5rem;">' +
    '<div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:0.75rem;">Klassenverdeling — ' + total + ' reflecties</div>' +
    '<div style="display:flex;height:22px;border-radius:6px;overflow:hidden;gap:2px;">';
  niveaus.forEach((n, i) => {
    const pct = total > 0 ? Math.round((n.count / total) * 100) : 0;
    if (pct > 0) html += '<div style="flex:' + pct + ';background:' + barColors[i] + ';display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:white;font-weight:700;">' + pct + '%</div>';
  });
  html += '</div><div style="display:flex;gap:1rem;margin-top:0.6rem;flex-wrap:wrap;">';
  niveaus.forEach((n, i) => {
    html += '<span style="font-size:0.75rem;color:' + barColors[i] + ';">● ' + n.label + '</span>';
  });
  html += '</div></div>';

  // Score-per-vraag blok
  const numVragen = MAX_QUESTIONS;
  const vraagGems = Array.from({length: numVragen}, (_, qi) => {
    const scores = resultsCache.map(r => r.scores && r.scores[qi] ? r.scores[qi].score : null).filter(s => s !== null);
    return scores.length > 0 ? (scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(1) : null;
  });
  const hasScores = vraagGems.some(g => g !== null);
  if (hasScores) {
    html += '<div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:1.1rem 1.25rem;margin-bottom:1.5rem;">' +
      '<div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:0.9rem;">Gemiddelde score per vraag</div>' +
      '<div style="display:grid;grid-template-columns:repeat(' + numVragen + ',1fr);gap:0.75rem;">';
    vraagGems.forEach((gem, qi) => {
      const val = gem !== null ? parseFloat(gem) : 0;
      const pct = gem !== null ? Math.round((val / 10) * 100) : 0;
      const col = gem === null ? 'var(--muted)' : val >= 8 ? 'var(--green)' : val >= 5 ? 'var(--orange)' : 'var(--red)';
      const label = qi === vraagGems.indexOf(Math.min(...vraagGems.filter(g=>g!==null).map(g=>parseFloat(g))).toString()) && gem !== null
        ? '⚠️ Moeilijkst' : qi === vraagGems.indexOf(Math.max(...vraagGems.filter(g=>g!==null).map(g=>parseFloat(g))).toString()) && gem !== null
        ? '✓ Makkelijkst' : '';
      html += '<div style="text-align:center;">' +
        '<div style="font-family:Raleway,sans-serif;font-weight:800;font-size:1.6rem;color:' + col + ';">' + (gem !== null ? gem : '—') + '<span style="font-size:0.75rem;color:var(--muted);font-weight:400;">/10</span></div>' +
        '<div style="font-size:0.75rem;color:var(--muted);margin-bottom:0.4rem;">Vraag ' + (qi+1) + '</div>' +
        '<div style="height:6px;background:var(--border);border-radius:99px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + col + ';border-radius:99px;"></div></div>' +
        (label ? '<div style="font-size:0.7rem;color:' + col + ';margin-top:0.3rem;">' + label + '</div>' : '') +
        '</div>';
    });
    html += '</div></div>';
  }

  html += `<div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;overflow:hidden;">
      <div style="padding:0.75rem 1.25rem;border-bottom:1px solid var(--border);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);">
        Klik op een rij om het volledige gesprek en de reflectie te bekijken
      </div>
      <table class="student-table">
        <thead><tr>
          <th>Leerling</th><th>Klas</th><th>Score</th><th>Datum &amp; tijd</th><th></th>
        </tr></thead>
        <tbody>`;

  resultsCache.forEach((r, idx) => {
    const totaalScore = r.scores && r.scores.length > 0 ? r.scores.reduce((s, x) => s + (x.score||0), 0) : null;
    const maxScore    = r.scores && r.scores.length > 0 ? r.scores.length * 10 : 30;
    const scorePct    = totaalScore !== null ? Math.round((totaalScore / maxScore) * 100) : null;
    const scoreColor  = totaalScore === null ? 'var(--muted)' : scorePct >= 80 ? 'var(--green)' : scorePct >= 50 ? 'var(--orange)' : 'var(--red)';
    const scoreLabel  = totaalScore !== null ? totaalScore + '/' + maxScore : '—';
    const dt = new Date(r.timestamp);
    const dateStr = dt.toLocaleDateString('nl-NL', {day:'numeric',month:'short',year:'numeric'});
    const timeStr = dt.toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit'});
    html += `<tr class="clickable" onclick="showStudentDetail(${idx})">
      <td>
        <div style="font-weight:700;">${escHtml(r.studentName)}</div>
        <div style="font-size:0.78rem;color:var(--muted);">${escHtml(r.lessonName || '')}</div>
      </td>
      <td style="font-size:0.88rem;">${escHtml(r.className || '—')}</td>
      <td><span style="color:${scoreColor};font-family:'Raleway',sans-serif;font-weight:700;font-size:1rem;">${scoreLabel}</span></td>
      <td style="color:var(--muted);font-size:0.85rem;">${dateStr}, ${timeStr}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();showStudentDetail(${idx})">Bekijk →</button></td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  area.innerHTML = html;
}

function showStudentDetail(idx) {
  const r = resultsCache[idx];
  if (!r) return;

  document.getElementById('detail-student-name').textContent = r.studentName || 'Onbekend';

  // Scores sectie
  const scoresSection = document.getElementById('detail-scores-section');
  if (r.scores && r.scores.length > 0) {
    scoresSection.style.display = 'block';
    const grid = document.getElementById('detail-scores-grid');
    grid.innerHTML = '';
    let totaal = 0;
    r.scores.forEach((s, i) => {
      const sc = s.score || 0;
      totaal += sc;
      const col = sc >= 8 ? 'var(--green)' : sc >= 5 ? 'var(--orange)' : 'var(--red)';
      const chip = document.createElement('div');
      chip.style.cssText = 'background:var(--surface2);border:1.5px solid var(--border);border-radius:8px;padding:0.5rem 0.75rem;text-align:center;min-width:70px;';
      chip.innerHTML = '<div style="font-family:Raleway,sans-serif;font-weight:800;font-size:1.3rem;color:' + col + ';">' + sc + '<span style="font-size:0.7rem;color:var(--muted);font-weight:400;">/10</span></div>' +
        '<div style="font-size:0.7rem;color:var(--muted);">Vraag ' + (i+1) + '</div>' +
        (s.motivatie ? '<div style="font-size:0.7rem;color:var(--text2);font-style:italic;margin-top:0.2rem;max-width:120px;">' + escHtml(s.motivatie) + '</div>' : '');
      grid.appendChild(chip);
    });
    const maxSc = r.scores.length * 10;
    const pct = Math.round((totaal / maxSc) * 100);
    const totCol = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--orange)' : 'var(--red)';
    document.getElementById('detail-totaalscore').innerHTML = 'Totaal: <strong style="color:' + totCol + ';">' + totaal + '/' + maxSc + '</strong> (' + pct + '%)';
  } else {
    scoresSection.style.display = 'none';
  }
  document.getElementById('detail-lesson-tag').textContent   = '📚 ' + (r.lessonName || '—');
  document.getElementById('detail-class-tag').textContent    = '🏫 ' + (r.className || '—');
  const dt = new Date(r.timestamp);
  document.getElementById('detail-date-tag').textContent = '🕐 ' + dt.toLocaleDateString('nl-NL', {day:'numeric',month:'long',year:'numeric'}) + ' om ' + dt.toLocaleTimeString('nl-NL', {hour:'2-digit',minute:'2-digit'});
  document.getElementById('detail-good').textContent    = r.reflGoed      || 'Geen reflectie beschikbaar.';
  document.getElementById('detail-improve').textContent = r.reflVerbeteren || 'Geen reflectie beschikbaar.';

  const log = document.getElementById('detail-chat-log');
  log.innerHTML = '';
  const msgs = r.messages || [];
  if (msgs.length === 0) {
    log.innerHTML = '<p style="color:var(--muted);font-style:italic;font-size:0.85rem;">Geen berichten gevonden.</p>';
  } else {
    msgs.forEach(m => {
      const div = document.createElement('div');
      div.className = 'detail-msg';
      const isAI = m.role === 'assistant';
      div.innerHTML = '<div class="detail-msg-role ' + (isAI ? 'ai' : 'user') + '">' + (isAI ? '🤖 Toetsbot' : '👤 ' + escHtml(r.studentName)) + '</div><div class="detail-msg-text">' + escHtml(m.content) + '</div>';
      log.appendChild(div);
    });
  }
  // Opgaven sectie
  const opgavenSection = document.getElementById('detail-opgaven-section');
  if (r.opgaven && r.opgaven.vragen && r.opgaven.vragen.length > 0) {
    opgavenSection.style.display = 'block';
    document.getElementById('detail-opgaven-context').textContent = r.opgaven.context || '';
    const opgavenItems = document.getElementById('detail-opgaven-items');
    opgavenItems.innerHTML = '';
    r.opgaven.vragen.forEach((v, i) => {
      const antw  = r.opgavenAntwoorden ? (r.opgavenAntwoorden[i] || '—') : '—';
      const fb    = r.opgavenFeedback   ? (r.opgavenFeedback[i]   || null) : null;
      const score = fb ? (fb.score || '').toLowerCase() : '';
      const cls   = score === 'goed' ? 'correct' : score === 'gedeeltelijk' ? 'partial' : score === 'incorrect' ? 'incorrect' : '';
      const div = document.createElement('div');
      div.className = 'opgave-feedback-card' + (cls ? ' ' + cls : '');
      div.style.marginBottom = '0.75rem';
      const labelText = score === 'goed' ? '✅ Goed' : score === 'gedeeltelijk' ? '〰️ Gedeeltelijk' : score === 'incorrect' ? '❌ Niet goed' : '';
      div.innerHTML =
        '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);margin-bottom:0.3rem;">Vraag ' + (i+1) + (labelText ? ' — ' + labelText : '') + '</div>' +
        '<p style="font-size:0.85rem;font-weight:600;margin-bottom:0.4rem;">' + escHtml(v.vraag) + '</p>' +
        '<div class="opgave-antwoord-box" style="font-size:0.82rem;"><strong style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;">Antwoord leerling:</strong><br>' + escHtml(antw) + '</div>' +
        (fb ? '<div style="font-size:0.82rem;color:var(--text2);margin-bottom:0.4rem;">' + escHtml(fb.feedback || '') + '</div>' : '') +
        '<div class="opgave-modelantwoord" style="font-size:0.82rem;"><strong style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--green);">Modelantwoord:</strong><br>' + escHtml(v.modelantwoord || '') + '</div>';
      opgavenItems.appendChild(div);
    });
  } else {
    opgavenSection.style.display = 'none';
  }

  openModal('modal-student-detail');
}

// ── Socratisch les-dropdown ─────────────────────────────────
async function loadLessonsForTeacher() {
  const sel = document.getElementById('teacher-lesson-select');
  if (!sel) return;
  try {
    const lessen = await apiFetch('/api/lessons');
    lessonsCache = lessen || [];
    sel.innerHTML = '<option value="">— Kies een les —</option>';
    lessonsCache.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.name;
      sel.appendChild(opt);
    });
  } catch(e) {
    showToast('Lessen laden mislukt: ' + e.message);
  }
}
