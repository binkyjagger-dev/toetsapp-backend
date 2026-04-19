function goToLeerlingenSetup() {
  const naam    = document.getElementById('setup-les-naam').value.trim();
  const content = document.getElementById('setup-les-content').value.trim();
  const err     = document.getElementById('setup-error');
  if (!naam)    { err.textContent = 'Vul een lesnaam in.'; err.style.display='block'; return; }
  if (!content) { err.textContent = 'Beschrijf de kernstof zodat de AI cases kan genereren.'; err.style.display='block'; return; }
  err.style.display = 'none';
  setupData.lesNaam    = naam;
  setupData.lesContent = content;
  setupData.nRondes       = parseInt(document.getElementById('setup-n-rondes').value);
  setupData.groepGrootte  = parseInt(document.getElementById('setup-groep-grootte').value);
  setupData.timerDiscussie = 0; // discussiefase niet meer gebruikt
  setupData.timerStem      = parseInt(document.getElementById('setup-timer-stem').value) || 60;
  showScreen('screen-sessie-stap2');
}

function parseLeerlingen() {
  const raw = document.getElementById('leerlingen-input').value;
  return raw.split(/[\n,]/).map(s => s.trim()).filter(s => s.length > 1);
}

// Groepsindeling state — [{naam, leden:[{naam, isMol}]}]

function genereerGroepsindeling() {
  const leerlingen = parseLeerlingen();
  if (leerlingen.length < 2) { toast('Voer minimaal 2 leerlingen in.'); return; }
  const gs = setupData.groepGrootte || 4;
  const geshuffled = [...leerlingen].sort(() => Math.random() - 0.5);
  groepsindeling = [];
  const labels = 'ABCDEFGHIJ'.split('');
  const aantalVolledigeGroepen = Math.floor(geshuffled.length / gs);

  // Maak volledige groepen
  for (let i = 0; i < aantalVolledigeGroepen; i++) {
    const leden = geshuffled.slice(i * gs, (i + 1) * gs).map((naam, idx) => ({
      naam, isMol: idx === 0,
    }));
    groepsindeling.push({ naam: 'Groep ' + labels[i], leden });
  }

  // Verdeel resterende leerlingen over bestaande groepen
  const rest = geshuffled.slice(aantalVolledigeGroepen * gs);
  rest.forEach((naam, idx) => {
    groepsindeling[idx % groepsindeling.length].leden.push({ naam, isMol: false });
  });

  if (rest.length > 0) {
    toast(`${rest.length} leerling${rest.length>1?'en zijn':' is'} verdeeld over bestaande groepen.`);
  }
  renderGroepsindeling();
}

function renderGroepsindeling() {
  const grid = document.getElementById('preview-groepen');
  grid.innerHTML = groepsindeling.map((g, gi) => `
    <div class="groep-card-interactief">
      <div class="groep-naam">
        <span>${escH(g.naam)}</span>
        <span style="font-size:0.65rem;color:var(--muted);font-weight:400;">
          Mol: <span style="color:var(--red-l);">${escH(g.leden.find(l => l.isMol)?.naam || '—')}</span>
        </span>
      </div>
      ${g.leden.map((l, li) => `
        <div class="groep-lid-mol-rij${l.isMol ? ' is-mol' : ''}"
          onclick="selecteerMol(${gi}, ${li})" title="Aanwijzen als Mol">
          <div class="mol-kies-radio"></div>
          <span class="groep-lid-mol-naam" style="margin-left:0.6rem;">${escH(l.naam)}</span>
          ${l.isMol ? '<span style="font-size:0.68rem;color:var(--red-l);font-weight:700;">🕵️ Mol</span>' : ''}
        </div>`).join('')}
    </div>`).join('');
  const totaal = groepsindeling.reduce((s, g) => s + g.leden.length, 0);
  document.getElementById('preview-count').textContent =
    `${totaal} leerlingen · ${groepsindeling.length} groep${groepsindeling.length !== 1 ? 'en' : ''}`;
  document.getElementById('leerlingen-preview').style.display = 'block';
}

function selecteerMol(groepIdx, lidIdx) {
  const g = groepsindeling[groepIdx];
  if (!g) return;
  g.leden.forEach((l, i) => { l.isMol = i === lidIdx; });
  renderGroepsindeling();
  toast(`🕵️ ${g.leden[lidIdx].naam} is de Mol in ${g.naam}`);
}


// ════════════════════════════════════════════════════════════
// VRAAG-EDITOR STATE
// ════════════════════════════════════════════════════════════

// ── Stap: leerlingen → vraag-editor ─────────────────────────────────────────
async function naarVragenEditor() {
  const leerlingen = parseLeerlingen();
  const err = document.getElementById('leerlingen-error');
  if (leerlingen.length < setupData.groepGrootte) {
    err.textContent = `Minimaal ${setupData.groepGrootte} leerlingen nodig.`;
    err.style.display = 'block'; return;
  }
  // Genereer willekeurige indeling als docent dat nog niet gedaan heeft
  if (groepsindeling.length === 0) {
    setupData.groepGrootte = parseInt(document.getElementById('setup-groep-grootte').value) || 4;
    genereerGroepsindeling();
  }
  err.style.display = 'none';
  setupData.leerlingen    = leerlingen;
  setupData.groepsindeling = groepsindeling; // met Mol-keuzes
  showScreen('screen-sessie-stap4');
  await genereerVragenPreview();
}

async function genereerVragenPreview() {
  document.getElementById('vragen-loading').style.display = 'block';
  document.getElementById('vragen-editor-wrap').style.display = 'none';
  document.getElementById('vragen-actie-row').style.display = 'none';
  document.getElementById('vragen-error').style.display = 'none';
  try {
    const result = await apiFetch('/api/mol/genereer-cases-preview', {
      method: 'POST',
      body: JSON.stringify({
        les_naam:    setupData.lesNaam,
        les_content: setupData.lesContent,
        n_rondes:    setupData.nRondes,
      }),
    });
    vragenData = result.cases.map(c => ({
      ronde_nr:       c.ronde_nr,
      vraag:          c.vraag,
      context:        c.context || '',
      vraagtype:      c.mc_opties && c.mc_opties.length > 0 ? 'mc' : 'open',
      correct_uitleg: c.correct_uitleg,
      fout_uitleg:    c.fout_uitleg,
      // AI-puntenvoorstel overnemen als beschikbaar
      mc_opties: (c.mc_opties || []).map(o => ({
        id:         o.id || uid(),
        tekst:      o.tekst || '',
        punten:     o.punten ?? 0,
        is_correct: o.punten === Math.max(...(c.mc_opties || []).map(x => x.punten ?? 0)),
        is_mol:     !!o.is_mol,
      })),
    }));
    renderVragenEditor();
  } catch(e) {
    document.getElementById('vragen-loading').style.display = 'none';
    document.getElementById('vragen-error').textContent = 'Genereren mislukt: ' + e.message + ' — je kunt vragen handmatig invullen.';
    document.getElementById('vragen-error').style.display = 'block';
    // Maak lege vragen aan
    vragenData = Array.from({length: setupData.nRondes}, (_, i) => ({
      ronde_nr: i + 1, vraag: '', context: '', vraagtype: 'open',
      correct_uitleg: '', fout_uitleg: '', mc_opties: [],
    }));
    renderVragenEditor();
  }
}

async function herGenereerAlleVragen() {
  vragenData = [];
  await genereerVragenPreview();
}

async function herGenereerVraag(rondeNr) {
  const idx = vragenData.findIndex(v => v.ronde_nr === rondeNr);
  if (idx === -1) return;
  const kaart = document.getElementById(`vraag-kaart-${rondeNr}`);
  if (kaart) kaart.style.opacity = '0.4';
  try {
    const result = await apiFetch('/api/mol/genereer-cases-preview', {
      method: 'POST',
      body: JSON.stringify({
        les_naam:    setupData.lesNaam,
        les_content: setupData.lesContent,
        n_rondes:    1,
        ronde_offset: rondeNr - 1,
      }),
    });
    const c = result.cases[0];
    vragenData[idx] = {
      ...vragenData[idx],
      vraag: c.vraag, context: c.context || '',
      correct_uitleg: c.correct_uitleg, fout_uitleg: c.fout_uitleg,
    };
    renderVraagKaart(rondeNr);
  } catch(e) {
    toast('Genereren mislukt: ' + e.message);
  } finally {
    if (kaart) kaart.style.opacity = '1';
  }
}

function renderVragenEditor() {
  document.getElementById('vragen-loading').style.display = 'none';
  const wrap = document.getElementById('vragen-editor-wrap');
  wrap.innerHTML = vragenData.map(v => `<div id="vraag-kaart-${v.ronde_nr}"></div>`).join('');
  vragenData.forEach(v => renderVraagKaart(v.ronde_nr));
  document.getElementById('vragen-editor-wrap').style.display = 'block';
  document.getElementById('vragen-actie-row').style.display = 'flex';
}

function renderVraagKaart(rondeNr) {
  const v   = vragenData.find(x => x.ronde_nr === rondeNr);
  const div = document.getElementById(`vraag-kaart-${rondeNr}`);
  if (!v || !div) return;

  const mcOpties = v.mc_opties.length > 0 ? v.mc_opties
    : [{id: uid(), tekst: v.correct_uitleg.substring(0,80) || 'Correct antwoord', is_correct: true},
       {id: uid(), tekst: v.fout_uitleg.substring(0,80) || 'Fout antwoord', is_correct: false}];
  if (v.mc_opties.length === 0 && v.vraagtype === 'mc') v.mc_opties = mcOpties;

  const labels = ['A','B','C','D'];

  div.innerHTML = `
  <div class="vraag-kaart">
    <div class="vraag-kaart-header">
      <span class="vraag-ronde-badge">Ronde ${rondeNr}</span>
      <span style="font-size:0.83rem;font-weight:600;color:#fff;flex:1;">
        ${escH(v.vraag.substring(0,60))}${v.vraag.length > 60 ? '…' : ''}
      </span>
      <button class="btn btn-ghost btn-sm" onclick="herGenereerVraag(${rondeNr})" title="Nieuwe AI-vraag genereren">↻ Nieuw</button>
    </div>
    <div class="vraag-kaart-body">

      <div class="form-section">
        <label>Vraag</label>
        <textarea rows="2" id="vraag-tekst-${rondeNr}" oninput="updateVraag(${rondeNr},'vraag',this.value)"
          style="font-size:0.88rem;">${escH(v.vraag)}</textarea>
      </div>

      <div class="form-section">
        <label>Vraagtype</label>
        <div class="type-toggle">
          <button class="type-btn ${v.vraagtype==='open' ? 'active-open' : ''}"
            onclick="setVraagtype(${rondeNr},'open')">📝 Open antwoord</button>
          <button class="type-btn ${v.vraagtype==='mc' ? 'active-mc' : ''}"
            onclick="setVraagtype(${rondeNr},'mc')">🔢 Multiple choice</button>
        </div>
      </div>

      ${v.vraagtype === 'mc' ? renderMcOpties(rondeNr, v.mc_opties, labels) : ''}

      <div class="uitleg-grid">
        <div>
          <div class="uitleg-veld-label" style="color:var(--green);">✅ Correct antwoord / uitleg</div>
          <textarea rows="3" id="correct-uitleg-${rondeNr}" oninput="updateVraag(${rondeNr},'correct_uitleg',this.value)"
            style="font-size:0.78rem;">${escH(v.correct_uitleg)}</textarea>
        </div>
        <div>
          <div class="uitleg-veld-label" style="color:var(--red);">🕵️ Mol-argument (fout maar plausibel)</div>
          <textarea rows="3" id="fout-uitleg-${rondeNr}" oninput="updateVraag(${rondeNr},'fout_uitleg',this.value)"
            style="font-size:0.78rem;">${escH(v.fout_uitleg)}</textarea>
        </div>
      </div>
      <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:0.5rem;">
          ⏱ Timer-afwijkingen voor deze ronde (leeg = sessie-standaard)
        </div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:0.4rem;">
            <label style="font-size:0.72rem;color:var(--text2);white-space:nowrap;">Discussie (sec):</label>
            <input type="number" min="30" max="600" placeholder="standaard"
              style="width:80px;padding:0.3rem 0.5rem;font-size:0.8rem;"
              value="${v.timer_discussie_override || ''}"
              oninput="updateVraag(${rondeNr},'timer_discussie_override',this.value?parseInt(this.value):null)">
          </div>
          <div style="display:flex;align-items:center;gap:0.4rem;">
            <label style="font-size:0.72rem;color:var(--text2);white-space:nowrap;">Stem (sec):</label>
            <input type="number" min="15" max="300" placeholder="standaard"
              style="width:80px;padding:0.3rem 0.5rem;font-size:0.8rem;"
              value="${v.timer_stem_override || ''}"
              oninput="updateVraag(${rondeNr},'timer_stem_override',this.value?parseInt(this.value):null)">
          </div>
        </div>
      </div>

    </div>
  </div>`;
  // Auto-resize alle MC textareas na render
  setTimeout(() => autoResizeAllMcInputs(rondeNr), 10);
}

function renderMcOpties(rondeNr, opties, labels) {
  const kanToevoegen = opties.length < 4;
  return `
    <div class="form-section">
      <label>
        Multiple choice opties
        <span style="font-weight:400;color:var(--muted);">
          — klik ○ voor correcte optie · 🕵️ markeert het Mol-argument · pas punten aan (0–10)
        </span>
      </label>
      <div class="mc-opties-wrap" id="mc-wrap-${rondeNr}">
        ${opties.map((o, i) => `
          <div class="mc-optie-rij${o.is_correct ? ' is-correct' : ''}${o.is_mol ? ' is-mol-arg' : ''}"
            id="mc-rij-${o.id}"
            style="${o.is_mol ? 'border-color:rgba(232,92,92,0.4);background:rgba(232,92,92,0.06);' : ''}">
            <span class="mc-optie-label">${labels[i]}</span>
            <button class="mc-correctness-btn${o.is_correct ? ' correct' : ''}"
              onclick="toggleMcCorrect(${rondeNr},'${o.id}')" title="Markeer als beste antwoord">
              ${o.is_correct ? '✓' : ''}
            </button>
            <textarea class="mc-optie-input"
              oninput="updateMcOptie(${rondeNr},'${o.id}','tekst',this.value);autoResizeMcInput(this)"
              placeholder="Optie ${labels[i]}..."
              rows="1">${escH(o.tekst)}</textarea>
            <button
              style="font-size:0.7rem;background:none;border:none;cursor:pointer;padding:0 0.2rem;color:${o.is_mol ? 'var(--red-l)' : 'var(--muted)'};"
              onclick="toggleMcMol(${rondeNr},'${o.id}')"
              title="${o.is_mol ? 'Mol-argument (klik om te verwijderen)' : 'Markeer als Mol-argument (0 pt)'}">
              🕵️
            </button>
            <input class="mc-punten-input" type="number" min="0" max="10" value="${o.punten ?? 0}"
              oninput="updateMcOptie(${rondeNr},'${o.id}','punten',parseInt(this.value)||0)"
              title="Punten voor deze optie (0–10)">
            ${opties.length > 2 ? `<button class="mc-verwijder-btn" onclick="verwijderMcOptie(${rondeNr},'${o.id}')">×</button>` : ''}
          </div>`).join('')}
        ${kanToevoegen ? `<button class="mc-voeg-toe-btn" onclick="voegMcOptieToe(${rondeNr})">+ Optie toevoegen</button>` : ''}
      </div>
    </div>`;
}


function autoResizeMcInput(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function autoResizeAllMcInputs(rondeNr) {
  const wrap = document.getElementById('mc-wrap-' + rondeNr);
  if (!wrap) return;
  wrap.querySelectorAll('.mc-optie-input').forEach(ta => autoResizeMcInput(ta));
}


function updateVraag(rondeNr, veld, waarde) {
  const v = vragenData.find(x => x.ronde_nr === rondeNr);
  if (v) v[veld] = waarde;
  // Header preview updaten zonder volledige re-render
  if (veld === 'vraag') {
    const header = document.querySelector(`#vraag-kaart-${rondeNr} .vraag-kaart-header span`);
    if (header) header.textContent = waarde.substring(0,60) + (waarde.length > 60 ? '…' : '');
  }
}

function setVraagtype(rondeNr, type) {
  const v = vragenData.find(x => x.ronde_nr === rondeNr);
  if (!v) return;
  v.vraagtype = type;
  // Init MC opties als nog leeg
  if (type === 'mc' && v.mc_opties.length === 0) {
    v.mc_opties = [
      {id: uid(), tekst: v.correct_uitleg.substring(0,80) || '', is_correct: true,  is_mol: false, punten: 10},
      {id: uid(), tekst: v.fout_uitleg.substring(0,80) || '',   is_correct: false, is_mol: true,  punten: 0},
    ];
  }
  renderVraagKaart(rondeNr);
}

function toggleMcCorrect(rondeNr, optieId) {
  const v = vragenData.find(x => x.ronde_nr === rondeNr);
  if (!v) return;
  v.mc_opties.forEach(o => { o.is_correct = o.id === optieId; });
  renderVraagKaart(rondeNr);
}

function toggleMcMol(rondeNr, optieId) {
  const v = vragenData.find(x => x.ronde_nr === rondeNr);
  if (!v) return;
  const o = v.mc_opties.find(x => x.id === optieId);
  if (!o) return;
  // Toggle mol-markering; zet punten automatisch op 0 bij aanwijzen
  const wordtMol = !o.is_mol;
  v.mc_opties.forEach(x => { x.is_mol = false; });
  o.is_mol = wordtMol;
  if (wordtMol) o.punten = 0;
  renderVraagKaart(rondeNr);
}

function updateMcOptie(rondeNr, optieId, veld, waarde) {
  const v = vragenData.find(x => x.ronde_nr === rondeNr);
  const o = v?.mc_opties.find(x => x.id === optieId);
  if (o) o[veld] = waarde;
}

function voegMcOptieToe(rondeNr) {
  const v = vragenData.find(x => x.ronde_nr === rondeNr);
  if (!v || v.mc_opties.length >= 4) return;
  v.mc_opties.push({id: uid(), tekst: '', is_correct: false});
  renderVraagKaart(rondeNr);
}

function verwijderMcOptie(rondeNr, optieId) {
  const v = vragenData.find(x => x.ronde_nr === rondeNr);
  if (!v || v.mc_opties.length <= 2) return;
  v.mc_opties = v.mc_opties.filter(o => o.id !== optieId);
  // Zorg dat er altijd één correct is
  if (!v.mc_opties.some(o => o.is_correct)) v.mc_opties[0].is_correct = true;
  renderVraagKaart(rondeNr);
}


// ── Nieuwe-flow helpers (stap 1-4 + spelcodes + feedback + mol-voorstel) ──

async function laadMolVoorstel(groepId) {
  // Haal voorstel op voor één groep: GET /api/mol/sessies/:id/mol-voorstel
  try {
    return await apiFetch(
      '/api/mol/sessies/' + sessieId + '/mol-voorstel?groep_id=' +
      encodeURIComponent(groepId)
    );
  } catch(e) { return null; }
}

async function genereerFeedbackVoorOptie(vraag, optieTekst, correct, lesContent) {
  // Roept POST /api/mol/genereer-feedback aan, vult .feedback-input textarea
  const res = await apiFetch('/api/mol/genereer-feedback', {
    method: 'POST',
    body: JSON.stringify({
      vraag, optie: optieTekst, correct, les_content: lesContent || '',
    }),
  });
  return res.feedback || '';
}

async function laadEnToonSpelcodes() {
  // Genereer spelcodes en toon screen-spelcodes
  const res = await apiFetch(
    '/api/mol/sessies/' + sessieId + '/genereer-spelcodes',
    { method: 'POST' }
  );
  const codeEl = document.getElementById('spelcodes-sessiecode');
  if (codeEl) codeEl.textContent = sessieCode || '';
  const container = document.getElementById('spelcodes-groepen-container');
  if (container && res.spelcodes) {
    container.innerHTML = res.spelcodes.map(s =>
      '<div class="spelcode-rij" style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);">' +
      '<span>' + escH(s.naam) + '</span>' +
      '<span style="font-family:\'DM Mono\',monospace;font-weight:700;color:var(--gold);">' + escH(s.spelcode) + '</span>' +
      '</div>'
    ).join('');
  }
  showScreen('screen-spelcodes');
}

// ── Navigatie-stubs voor sessie-stappen ──

function naarStap2Leerlingen() { showScreen('screen-sessie-stap2'); }
function naarStap3Mol() { initStap4(); showScreen('screen-sessie-stap4'); }
function naarStap4Vragen() { showScreen('screen-sessie-stap4'); }
function nieuweSessie() { showScreen('screen-sessie-stap1'); }
function sessieAanmakenEnStart() { maakSessie(); }

function voegRondeToe() {
  const container = document.getElementById('sessie-vragen-container');
  if (!container) return;
  const n = container.children.length + 1;
  container.appendChild(renderRondeKaart(n));
}

function kiesRondes(n) {
  document.getElementById('setup-n-rondes').value = n;
  document.querySelectorAll('.rondes-btn').forEach(btn => {
    btn.classList.toggle('actief', parseInt(btn.dataset.n) === n);
  });
}

function kiesGroepGrootte(n) {
  setupData.groepGrootte = n;
  document.querySelectorAll('.grootte-btn').forEach(btn => {
    btn.classList.toggle('actief', parseInt(btn.dataset.n) === n);
  });
}

function renderRondeKaart(n) {
  const tmpl = document.getElementById('ronde-kaart-template');
  const clone = tmpl.content.cloneNode(true);
  const kaart = clone.querySelector('.ronde-kaart');
  kaart.id = 'ronde-kaart-' + n;
  clone.querySelector('.ronde-nr').textContent = n;
  clone.querySelector('.ronde-ai-btn').onclick = () => genereerRondeAI(n);
  clone.querySelector('.ronde-ai-groot-btn').onclick = () => genereerRondeAI(n);
  clone.querySelector('.ronde-zelf-btn').onclick = () => toonRondeInvoer(n);
  clone.querySelector('.ronde-optie-toevoegen').onclick = () => voegOptieToe(n);
  return clone;
}

function toonRondeInvoer(n) {
  const kaart = document.getElementById('ronde-kaart-' + n);
  if (!kaart) return;
  kaart.querySelector('.ronde-leeg').style.display = 'none';
  kaart.querySelector('.ronde-invoer').style.display = 'block';
  voegOptieToe(n);
  voegOptieToe(n);
}

function voegOptieToe(n) {
  const kaart = document.getElementById('ronde-kaart-' + n);
  if (!kaart) return;
  const container = kaart.querySelector('.ronde-opties-container');
  const tmpl = document.getElementById('optie-template');
  const clone = tmpl.content.cloneNode(true);
  koppelOptieHandlers(clone, n);
  container.appendChild(clone);
}

function koppelOptieHandlers(clone, n) {
  clone.querySelector('.optie-correct-btn').onclick = function() { toggleCorrect(this); };
  clone.querySelector('.optie-punten-min').onclick = function() { passPuntenAan(this, -1); };
  clone.querySelector('.optie-punten-plus').onclick = function() { passPuntenAan(this, 1); };
  clone.querySelector('.optie-del-btn').onclick = function() { verwijderOptie(this); };
  clone.querySelector('.optie-ai-feedback-btn').onclick = function() { genereerFeedbackOptie(this, n); };
}

function toggleCorrect(btn) {
  const isActief = btn.classList.contains('actief');
  btn.classList.toggle('actief', !isActief);
  const wrap = btn.closest('.optie-rij').querySelector('.optie-punten-wrap');
  if (!wrap) return;
  wrap.style.borderColor = isActief ? '#dde4f0' : '#2a8a5a';
  if (!isActief) {
    const val = wrap.querySelector('.optie-punten-val');
    if (val && val.textContent === '0') val.textContent = '10';
  }
}

function passPuntenAan(btn, delta) {
  const val = btn.closest('.optie-punten-wrap').querySelector('.optie-punten-val');
  if (!val) return;
  const huidig = parseInt(val.textContent) || 0;
  val.textContent = Math.max(0, Math.min(10, huidig + delta));
}

function verwijderOptie(btn) {
  btn.closest('.optie-blok')?.remove();
}

function initStap4() {
  const n = parseInt(document.getElementById('setup-n-rondes')?.value) || 3;
  const container = document.getElementById('sessie-vragen-container');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 1; i <= n; i++) {
    container.appendChild(renderRondeKaart(i));
  }
  showScreen('screen-sessie-stap4');
}

async function genereerRondeAI(n) {
  const kaart = document.getElementById('ronde-kaart-' + n);
  if (!kaart) return;
  const btn = kaart.querySelector('.ronde-ai-btn');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  try {
    const lesContent = document.getElementById('setup-les-content')?.value || '';
    const res = await apiFetch('/api/mol/genereer-vraag', {
      method: 'POST',
      body: JSON.stringify({ ronde_nr: n, les_content: lesContent }),
    });
    toonRondeInvoer(n);
    vulRondeMetAIData(n, res);
  } catch(e) {
    toast('Genereren mislukt: ' + e.message);
  } finally {
    if (btn) { btn.textContent = '✦ Genereer met AI'; btn.disabled = false; }
  }
}

function vulRondeMetAIData(n, res) {
  const kaart = document.getElementById('ronde-kaart-' + n);
  if (!kaart) return;
  const vraagInput = kaart.querySelector('.ronde-vraag-input');
  if (vraagInput) vraagInput.value = res.vraag || '';
  const container = kaart.querySelector('.ronde-opties-container');
  if (container) container.innerHTML = '';
  (res.opties || []).forEach(opt => {
    voegOptieToe(n);
    const blok = container.lastElementChild;
    if (blok) vulOptieMetData(blok, opt);
  });
}

function vulOptieMetData(blok, opt) {
  const input = blok.querySelector('.optie-tekst-input');
  if (input) input.value = opt.tekst || '';
  const val = blok.querySelector('.optie-punten-val');
  if (val) val.textContent = opt.punten || 0;
  const feedback = blok.querySelector('.optie-feedback-input');
  if (feedback) feedback.value = opt.feedback || '';
  if (opt.correct) {
    const btn = blok.querySelector('.optie-correct-btn');
    if (btn) toggleCorrect(btn);
  }
}
