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
