async function openLeerlingenPicker(targetTextareaId) {
  // Sla het doel-textarea op zodat bevestig weet waar naartoe
  pickerTargetTextarea = targetTextareaId || 'leerlingen-input';
  const modal = document.getElementById('ll-picker-modal');
  modal.style.display = 'flex';
  pickerGeselecteerd = new Set();
  pickerAlleeLeerlingen = [];
  document.getElementById('picker-lijst').innerHTML =
    '<p style="padding:1rem;color:var(--muted);font-size:0.82rem;text-align:center;"><span class="spinner"></span> Laden...</p>';

  try {
    const [periodes, meta] = await Promise.all([
      apiFetch('/api/leerlingen/periodes'),
      apiFetch('/api/leerlingen/klassen'),
    ]);
    const pSel = document.getElementById('picker-periode');
    pSel.innerHTML = '<option value="">— Alle periodes —</option>'
      + periodes.map(p => `<option value="${p}" ${p === periodes[0] ? 'selected' : ''}>${p}</option>`).join('');

    // Klassen-dropdown
    const kSel = document.getElementById('picker-klas');
    const klassen = Array.isArray(meta) ? meta : (meta.klassen || []);
    kSel.innerHTML = '<option value="">— Alle klassen —</option>'
      + klassen.map(k => `<option value="${k}">${k}</option>`).join('');

    await laadPickerLeerlingen();
  } catch(e) {
    document.getElementById('picker-lijst').innerHTML =
      '<p style="padding:1rem;color:var(--muted);">Geen leerlingen gevonden. Importeer eerst leerlingen via de Toetsapp.</p>';
  }
}


function selecteerAllePickerLeerlingen() {
  pickerAlleeLeerlingen.forEach(l => pickerGeselecteerd.add(l.id));
  renderPickerLijst();
}

function deselecteerAllePickerLeerlingen() {
  pickerGeselecteerd.clear();
  renderPickerLijst();
}

async function laadPickerLeerlingen() {
  const klas     = document.getElementById('picker-klas')?.value     || '';
  const periode  = document.getElementById('picker-periode')?.value  || '';
  const niveau   = document.getElementById('picker-niveau')?.value   || '';
  const leerjaar = document.getElementById('picker-leerjaar')?.value || '';
  const qs = new URLSearchParams();
  if (klas)     qs.set('klas', klas);
  if (periode)  qs.set('lesperiode', periode);
  if (niveau)   qs.set('leerniveau', niveau);
  if (leerjaar) qs.set('leerjaar', leerjaar);
  try {
    pickerAlleeLeerlingen = await apiFetch('/api/leerlingen?' + qs);
    renderPickerLijst();
  } catch(e) {
    document.getElementById('picker-lijst').innerHTML =
      '<p style="padding:1rem;color:var(--red-l);">Laden mislukt.</p>';
  }
}

function renderPickerLijst() {
  const lijst = document.getElementById('picker-lijst');
  if (!pickerAlleeLeerlingen.length) {
    lijst.innerHTML = '<p style="padding:1rem;color:var(--muted);font-size:0.82rem;">Geen leerlingen in deze klas.</p>';
    return;
  }
  lijst.innerHTML = pickerAlleeLeerlingen.map(l => {
    const naam = [l.roepnaam, l.tussenvoegsel, l.achternaam].filter(Boolean).join(' ');
    const sel  = pickerGeselecteerd.has(l.id);
    const badge = l.leerniveau
      ? `<span style="font-size:0.62rem;padding:1px 5px;border-radius:3px;
           background:rgba(27,58,107,0.12);color:var(--blue);margin-right:3px;">${l.leerniveau.slice(0,3)}</span>`
      : '';
    return `<div class="ll-picker-rij ${sel ? 'geselecteerd' : ''}" onclick="togglePickerKeuze('${l.id}')" data-id="${l.id}">
      <div class="ll-picker-check">${sel ? '✓' : ''}</div>
      <span class="ll-picker-naam">${naam}</span>
      <span class="ll-picker-klas">${badge}${l.klas || ''} ${l.leerjaar ? '·&nbsp;jr ' + l.leerjaar : ''}</span>
    </div>`;
  }).join('');
  updatePickerCount();
}

function togglePickerKeuze(id) {
  if (pickerGeselecteerd.has(id)) pickerGeselecteerd.delete(id);
  else pickerGeselecteerd.add(id);
  // Update alleen de aangeklikte rij
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) {
    const sel = pickerGeselecteerd.has(id);
    el.classList.toggle('geselecteerd', sel);
    const check = el.querySelector('.ll-picker-check');
    if (check) check.textContent = sel ? '✓' : '';
  }
  updatePickerCount();
}

function updatePickerCount() {
  const cnt = document.getElementById('picker-count');
  if (cnt) cnt.textContent = pickerGeselecteerd.size + ' geselecteerd';
}

function bevestigLeerlingenKeuze() {
  const gekozen = pickerAlleeLeerlingen.filter(l => pickerGeselecteerd.has(l.id));
  const namen   = gekozen.map(l => [l.roepnaam, l.tussenvoegsel, l.achternaam].filter(Boolean).join(' '));
  const textarea = document.getElementById(pickerTargetTextarea || 'leerlingen-input');
  if (textarea) {
    const bestaand = textarea.value.trim();
    textarea.value = bestaand
      ? bestaand + '\n' + namen.join('\n')
      : namen.join('\n');
  }
  sluitLeerlingenPicker();
}

function sluitLeerlingenPicker() {
  const modal = document.getElementById('ll-picker-modal');
  if (modal) modal.style.display = 'none';
}


// ── Les-koppeling vanuit leerplatform ────────────────────────

async function laadMolLessenDropdown() {
  if (!docentToken) return;
  try {
    const lessen = await apiFetch('/api/lessons');
    molLessenCache = lessen || [];
    const sel = document.getElementById('sessie-les-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Handmatig invullen —</option>'
      + molLessenCache.map(l =>
          `<option value="${l.id}">${l.name}</option>`
        ).join('');
  } catch(e) { /* stil falen */ }
}

function onMolLesKeuze() {
  const sel = document.getElementById('sessie-les-select');
  const lesId = sel?.value;
  if (!lesId) {
    // Reset naar handmatig
    document.getElementById('setup-les-naam').value    = '';
    document.getElementById('setup-les-content').value = '';
    const prev = document.getElementById('les-kiezer-preview');
    if (prev) prev.style.display = 'none';
    return;
  }
  const les = molLessenCache.find(l => l.id === lesId);
  if (!les) return;
  document.getElementById('setup-les-naam').value    = les.name;
  document.getElementById('setup-les-content').value = les.content || '';
  // Tel leerdoelen
  const aantalLd = (les.content?.match(/^- .+/gm) || []).length;
  const prev = document.getElementById('les-kiezer-preview');
  if (prev) {
    prev.textContent = '✓ ' + les.name + (aantalLd ? ' · ' + aantalLd + ' leerdoelen' : '');
    prev.style.display = 'block';
  }
}

