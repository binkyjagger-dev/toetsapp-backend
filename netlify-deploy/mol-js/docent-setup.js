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
  setupData.groepGrootte = 3;
  const actiefBtn = document.querySelector('#setup-groep-grootte .grootte-btn.actief');
  if (actiefBtn) { setupData.groepGrootte = parseInt(actiefBtn.dataset.n) || 3; }
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

function naarStap2Leerlingen() {
  const naam = (document.getElementById('sessie-naam')?.value || '').trim();
  if (!naam) { toast('Vul een sessie-naam in'); return; }
  setupData.lesNaam    = naam;
  setupData.lesContent = (document.getElementById('setup-les-content')?.value || '').trim();
  setupData.nRondes    = parseInt(document.getElementById('setup-n-rondes')?.value) || 3;
  showScreen('screen-sessie-stap2');
}
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

async function genereerFeedbackOptie(btn, n) {
  const blok = btn.closest('.optie-blok');
  if (!blok) return;
  const kaart = document.getElementById('ronde-kaart-' + n);
  const vraag = kaart?.querySelector('.ronde-vraag-input')?.value || '';
  const optie = blok.querySelector('.optie-tekst-input')?.value || '';
  const correct = blok.querySelector('.optie-correct-btn')?.classList.contains('actief') || false;
  const lesContent = document.getElementById('setup-les-content')?.value || '';
  btn.textContent = '⏳';
  try {
    const res = await apiFetch('/api/mol/genereer-feedback', {
      method: 'POST',
      body: JSON.stringify({ vraag, optie, correct, les_content: lesContent }),
    });
    const textarea = blok.querySelector('.optie-feedback-input');
    if (textarea) textarea.value = res.feedback || '';
  } catch(e) {
    toast('Feedback mislukt: ' + e.message);
  } finally {
    btn.textContent = '✦ Genereer';
  }
}
