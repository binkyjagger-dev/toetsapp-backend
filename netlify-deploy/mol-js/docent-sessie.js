function naarSessieLijst() {
  clearInterval(pollTimer);
  showScreen('screen-sessie-lijst');
  laadSessieLijst();
}

function sluitLeerlingAf() {
  clearInterval(pollTimer);
  stopHeartbeat();
  showScreen('screen-sessie-lijst');
}



// ════════════════════════════════════════════════════════════
// SETUP — DOCENT
// ════════════════════════════════════════════════════════════
function leesVragenUitDOM() {
  const container = document.getElementById('sessie-vragen-container');
  if (!container) return [];
  return Array.from(container.querySelectorAll('.ronde-kaart')).map((kaart, i) => {
    const vraag = kaart.querySelector('.ronde-vraag-input')?.value || '';
    const opties = Array.from(kaart.querySelectorAll('.optie-blok')).map(blok => ({
      tekst:    blok.querySelector('.optie-tekst-input')?.value || '',
      correct:  blok.querySelector('.optie-correct-btn')?.classList.contains('actief') || false,
      punten:   parseInt(blok.querySelector('.optie-punten-val')?.textContent) || 0,
      feedback: blok.querySelector('.optie-feedback-input')?.value || '',
    }));
    const correctOptie = opties.find(o => o.correct);
    const foutOptie    = opties.find(o => !o.correct);
    return {
      ronde_nr: i + 1,
      vraag,
      vraagtype: 'mc',
      correct_uitleg: correctOptie?.feedback || '',
      fout_uitleg:    foutOptie?.feedback || '',
      mc_opties: opties.map(o => ({
        id:         crypto.randomUUID(),
        tekst:      o.tekst,
        is_correct: o.correct,
        punten:     o.punten,
        feedback:   o.feedback,
      })),
    };
  });
}

async function maakSessie() {
  const leerlingen = setupData.leerlingen || parseLeerlingen();
  const err = document.getElementById('vragen-error') || document.getElementById('leerlingen-error');
  if (!leerlingen || leerlingen.length < setupData.groepGrootte) {
    if (err) { err.textContent = `Minimaal ${setupData.groepGrootte} leerlingen nodig.`; err.style.display = 'block'; }
    return;
  }
  if (err) err.style.display = 'none';
  const btn = document.querySelector('#vragen-actie-row .btn-gold') || document.getElementById('naar-vragen-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Aanmaken...'; }

  try {
    const result = await apiFetch('/api/mol/sessie', {
      method: 'POST',
      body: JSON.stringify({
        les_naam:        setupData.lesNaam,
        les_content:     setupData.lesContent,
        n_rondes:        setupData.nRondes,
        groep_grootte:   setupData.groepGrootte,
        timer_discussie: setupData.timerDiscussie || 120,
        timer_stem:      setupData.timerStem      || 60,
        leerlingen:     setupData.leerlingen || leerlingen,
        groepsindeling: setupData.groepsindeling || null,
        vragen:         leesVragenUitDOM(),
        klas_id:        document.getElementById('setup-klas-id')?.value   || null,
        klas_naam:      document.getElementById('setup-klas-naam')?.value || null,
      }),
    });
    sessieId   = result.sessieId;
    sessieCode = result.sessieCode;
    docentCode = result.docentCode;
    localStorage.setItem('mol_docent_code', docentCode);
    localStorage.setItem('mol_sessie_id',   sessieId);
    laadDocentSessie();
    await laadSessieLijst();
  } catch(e) {
    if (err) {
      err.textContent = 'Fout: ' + e.message;
      err.style.display = 'block';
    } else {
      toast('Sessie aanmaken mislukt: ' + e.message);
    }
    if (btn) { btn.disabled = false; btn.innerHTML = 'Sessie starten →'; }
  }
}

// hervat() vervangen door sessie-lijst UI

// ════════════════════════════════════════════════════════════
// DOCENT — SESSIE BEHEER
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// SESSIE-LIJST (docent)
// ════════════════════════════════════════════════════════════
async function laadSessieLijst() {
  const loading = document.getElementById('sessie-lijst-loading');
  const wrap    = document.getElementById('sessie-lijst-wrap');
  const leeg    = document.getElementById('sessie-lijst-leeg');
  if (!loading) return;

  loading.style.display = 'block';
  wrap.style.display    = 'none';
  leeg.style.display    = 'none';

  try {
    const sessies = await apiFetch(`/api/mol/sessies?docent_token=${encodeURIComponent(docentToken)}`);
    loading.style.display = 'none';

    if (!sessies || sessies.length === 0) {
      leeg.style.display = 'block';
      return;
    }

    const statusLabel = {
      setup: 'Setup', briefing: 'Briefing', test: 'Moltest',
      reveal: 'Onthuld', afgelopen: 'Afgelopen',
    };
    const statusClass = {
      setup: 'ss-setup', briefing: 'ss-briefing', test: 'ss-test',
      reveal: 'ss-reveal', afgelopen: 'ss-afgelopen',
    };

    wrap.innerHTML = sessies.map(s => {
      const datum  = s.created_at ? new Date(s.created_at).toLocaleDateString('nl-NL', { day:'numeric', month:'short', year:'numeric' }) : '—';
      const isRonde = s.status && s.status.startsWith('ronde_');
      const statusTxt = isRonde ? `Ronde ${s.status.split('_')[1]}` : (statusLabel[s.status] || s.status);
      const statusCls = isRonde ? 'ss-ronde' : (statusClass[s.status] || 'ss-setup');
      return `<div class="sessie-rij">
        <div class="sessie-info">
          <div class="sessie-les-naam">${escH(s.les_naam || 'Naamloos')}</div>
          <div class="sessie-meta">
            <span>${datum}</span>
            <span>Code: <strong style="color:var(--gold-l);font-family:'DM Mono',monospace;">${s.sessie_code}</strong></span>
            <span>${s.n_rondes} rondes · groep ${s.groep_grootte}</span>
          </div>
        </div>
        <span class="sessie-status ${statusCls}">${statusTxt}</span>
        <div class="sessie-acties">
          ${s.status !== 'afgelopen' ? `
            <button class="btn btn-gold btn-sm" onclick="startSessie('${s.id}','${s.docent_code}','${s.sessie_code}')">▶ Starten</button>
            <button class="btn btn-ghost btn-sm" onclick="openSessie('${s.id}','${s.docent_code}','${s.sessie_code}')">Openen</button>
            <button class="btn btn-ghost btn-sm" onclick="bewerkSessie('${s.id}')">✏ Bewerken</button>
          ` : `
            <button class="btn btn-ghost btn-sm" onclick="bekijkResultaten('${s.id}')">📊 Resultaten</button>
          `}
          <button class="btn btn-ghost btn-sm" onclick="openHergebruik('${s.id}','${s.docent_code}','${escH(s.les_naam||'')}')">↺ Hergebruik</button>
          <button class="btn btn-ghost btn-sm btn-danger" onclick="verwijderSessie('${s.id}','${escH(s.les_naam||'deze sessie')}')">🗑</button>
        </div>
      </div>`;
    }).join('');
    wrap.style.display = 'block';

  } catch(e) {
    if (loading) loading.style.display = 'none';
    const err = document.getElementById('hervatten-error');
    if (err) { err.textContent = 'Laden mislukt: ' + e.message; err.style.display = 'block'; }
  }
}

function openSessie(id, dCode, sCode) {
  sessieId   = id;
  docentCode = dCode;
  sessieCode = sCode;
  localStorage.setItem('mol_docent_code', dCode);
  localStorage.setItem('mol_sessie_id',   id);
  laadDocentSessie();
}

async function verwijderSessie(id, naam) {
  if (!confirm(`Sessie "${naam}" definitief verwijderen? Alle leerlingdata gaat verloren.`)) return;
  try {
    await apiFetch(`/api/mol/sessie/${id}?docent_token=${encodeURIComponent(docentToken)}`, { method: 'DELETE' });
    toast(`✓ Sessie "${naam}" verwijderd`);
    laadSessieLijst();
  } catch(e) {
    toast('Verwijderen mislukt: ' + e.message);
  }
}

async function laadDocentSessie() {
  await genereerSpelcodesEnToon();
  await laadSessieLijst();
  showScreen('screen-spelcodes');
}

async function genereerSpelcodesEnToon() {
  if (!sessieId) return;
  try {
    const res = await apiFetch(
      '/api/mol/sessies/' + sessieId + '/genereer-spelcodes',
      { method: 'POST' }
    );
    const sessiecodeEl = document.getElementById('spelcodes-sessiecode');
    if (sessiecodeEl) sessiecodeEl.textContent = sessieCode || '';
    const groepenEl = document.getElementById('spelcodes-groepen-container');
    if (groepenEl && res.spelcodes) {
      const perGroep = {};
      res.spelcodes.forEach(s => {
        const g = s.groep_naam || 'Groep';
        if (!perGroep[g]) perGroep[g] = [];
        perGroep[g].push(s);
      });
      groepenEl.innerHTML = Object.entries(perGroep).map(([groep, spelers]) => `
        <div style="margin-bottom:16px;">
          <div style="font-size:13px;font-weight:700;color:#C8A951;margin-bottom:8px;">${groep}</div>
          ${spelers.map(s => `
            <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
              <span style="font-size:14px;color:#fff;flex:1;">${s.naam}</span>
              <span style="font-family:monospace;font-size:16px;font-weight:700;color:#C8A951;letter-spacing:0.2em;">${s.spelcode}</span>
            </div>
          `).join('')}
        </div>
      `).join('');
    }
  } catch(e) {
    toast('Spelcodes genereren mislukt: ' + e.message);
  }
}

function startPoll(fn, interval = 4000) {
  clearInterval(pollTimer);
  fn();
  pollTimer = setInterval(fn, interval);
}

async function renderDocentSessie() {
  // Dashboard nog niet geimplementeerd — wordt gebouwd in een latere sessie
}

function renderDocentFase(sessie, leerlingen, groepen, cases, antwoorden, groepStemmen, testAntwoorden, online) {
  const status = sessie.status;
  const ronde  = sessie.huidige_ronde;
  const faseDiv  = document.getElementById('docent-fase-titel');
  const subDiv   = document.getElementById('docent-fase-sub');
  const stepsDiv = document.getElementById('docent-phase-steps');
  const actieDiv = document.getElementById('docent-actie-btns');
  const antSec   = document.getElementById('docent-antwoorden-sectie');
  const nabespreek = document.getElementById('docent-nabespreek-sectie');

  const casesKlaar = cases && cases.length >= sessie.n_rondes;

  // Status-badge
  const badges = { setup:'🟡 Setup', briefing:'🟢 Briefing', test:'🟣 Moltest', reveal:'🔴 Reveal', afgelopen:'⚫ Afgelopen' };
  document.getElementById('docent-status-badge').innerHTML =
    `<span class="status-badge" style="background:rgba(255,255,255,0.06);border:1px solid var(--border);color:var(--text2);">
      <span class="pulse-dot" style="background:var(--green);"></span>
      ${badges[status] || status}
    </span>`;

  if (status === 'setup') {
    const nu2 = Date.now();
    // Check welke groepen compleet online zijn
    const groepStatus = groepen.map(g => {
      const leden = leerlingen.filter(l => l.groep_id === g.id);
      const onlineCount = leden.filter(l => l.online_at && (nu2 - l.online_at) < 90000).length;
      return { naam: g.naam, online: onlineCount, totaal: leden.length, compleet: onlineCount === leden.length && leden.length > 0 };
    });
    const eenCompleet = groepStatus.some(g => g.compleet);
    const groepBadges = groepStatus.map(g =>
      `<span style="font-size:0.72rem;padding:0.15rem 0.5rem;border-radius:5px;
        background:${g.compleet ? 'rgba(62,201,138,0.15)' : 'rgba(255,255,255,0.05)'};
        border:1px solid ${g.compleet ? 'rgba(62,201,138,0.35)' : 'var(--border)'};
        color:${g.compleet ? 'var(--green)' : 'var(--muted)'};">
        ${g.naam}: ${g.online}/${g.totaal}
      </span>`).join(' ');

    faseDiv.textContent = casesKlaar
      ? (eenCompleet ? '🟢 Sessie start automatisch...' : '⏳ Wachten op leerlingen')
      : '⏳ AI genereert cases...';
    subDiv.innerHTML = `<div style="margin-bottom:0.5rem;">${online.length}/${leerlingen.length} leerlingen online</div>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">${groepBadges}</div>
      ${casesKlaar && eenCompleet ? '<div style="font-size:0.72rem;color:var(--green);margin-top:0.4rem;">✓ Minstens één volledige groep online — spel start automatisch</div>' : ''}`;
    stepsDiv.innerHTML  = renderPhaseSteps(['Setup','Briefing','Rondes','Moltest','Onthulling'], 0);
    actieDiv.innerHTML  = casesKlaar
      ? `<button class="btn btn-ghost btn-sm" onclick="docentActie('briefing', 0)" style="opacity:0.7;">▶ Handmatig starten</button>`
      : `<button class="btn btn-ghost" disabled><span class="spinner"></span> Cases worden gegenereerd...</button>`;
    antSec.style.display = 'none';
    nabespreek.style.display = 'none';

  } else if (status === 'briefing') {
    faseDiv.textContent = '📋 Leerlingen lezen briefing';
    subDiv.textContent  = 'Leerlingen zien hun rol en groep. Start ronde 1 als iedereen gereed is.';
    stepsDiv.innerHTML  = renderPhaseSteps(['Setup','Briefing','Rondes','Moltest','Onthulling'], 1);
    actieDiv.innerHTML  = `<button class="btn btn-gold" onclick="startSessieAuto()">▶ Start sessie — alles loopt automatisch →</button>`;
    antSec.style.display = 'none';

  } else if (status.startsWith('ronde_')) {
    const r = parseInt(status.split('_')[1]);
    const caseRonde = cases.find(c => c.ronde_nr === r);
    const antInRonde = antwoorden.filter(a => a.ronde_nr === r);
    const alIngediend = antInRonde.length >= leerlingen.length;

    faseDiv.textContent = `Ronde ${r} van ${sessie.n_rondes} — ${alIngediend ? 'iedereen ingediend' : 'individuele antwoorden'}`;
    subDiv.textContent  = caseRonde ? `Case: "${caseRonde.vraag.substring(0, 80)}..."` : 'Case laden...';
    stepsDiv.innerHTML  = renderPhaseSteps(['Setup','Briefing',`Ronde ${r}`,'Moltest','Onthulling'], 2);

    // Antwoorden-overzicht
    antSec.style.display = 'block';
    document.getElementById('docent-ronde-label').textContent = r;
    const antDiv = document.getElementById('docent-antwoorden-lijst');
    antDiv.innerHTML = leerlingen.map(l => {
      const ant = antInRonde.find(a => a.leerling_id === l.id);
      return `<div class="leerling-rij">
        <div class="leerling-naam">${escH(l.naam)}</div>
        <div style="font-size:0.75rem;color:${ant ? 'var(--green)' : 'var(--muted)'};">${ant ? '✓ Ingediend' : '⏳ Wacht...'}</div>
      </div>`;
    }).join('');

    // Open scoring panel als vraagtype open is
    const caseVraagtype = caseRonde?.vraagtype || 'open';
    const openScoringHtml = (caseVraagtype === 'open' && alIngediend)
      ? renderOpenScorePanel(r, groepen, groepStemmen)
      : '';

    // Extra sectie voor open scoring
    let openScoreSec = document.getElementById('docent-open-score');
    if (!openScoreSec) {
      openScoreSec = document.createElement('div');
      openScoreSec.id = 'docent-open-score';
      antSec.parentNode.insertBefore(openScoreSec, antSec.nextSibling);
    }
    openScoreSec.innerHTML = openScoringHtml;

    // Knoppen
    const volgendeRonde = r < sessie.n_rondes;
    actieDiv.innerHTML = `
      ${alIngediend
        ? (volgendeRonde
            ? `<button class="btn btn-gold" onclick="docentActie('ronde', ${r+1})">▶ Start ronde ${r+1} →</button>`
            : `<button class="btn btn-gold" onclick="docentActie('test', 0)">▶ Start moltest →</button>`)
        : `<button class="btn btn-ghost" onclick="docentActie('ronde', ${volgendeRonde ? r+1 : -1})" style="opacity:0.6;">⏭ Volgende fase (overslaan)</button>`
      }
      ${alIngediend ? '' : `<span style="font-size:0.75rem;color:var(--muted);">${antInRonde.length}/${leerlingen.length} ingediend</span>`}`;

  } else if (status === 'test') {
    const alIngediend = testAntwoorden.length >= leerlingen.length;
    faseDiv.textContent = `🧪 Moltest — ${testAntwoorden.length}/${leerlingen.length} ingediend`;
    subDiv.textContent  = alIngediend ? 'Iedereen heeft de test ingestuurd. Onthul de Mol!' : 'Leerlingen vullen de moltest in...';
    stepsDiv.innerHTML  = renderPhaseSteps(['Setup','Briefing','Rondes','Moltest','Onthulling'], 3);
    actieDiv.innerHTML  = `<button class="btn btn-red" onclick="docentActie('reveal', 0)">🎭 Onthul de Mol →</button>`;
    antSec.style.display = 'none';

  } else if (status === 'reveal' || status === 'afgelopen') {
    faseDiv.textContent = '🎭 De Mol is onthuld';
    subDiv.textContent  = 'Bespreek klassikaal de sabotage-momenten.';
    stepsDiv.innerHTML  = renderPhaseSteps(['Setup','Briefing','Rondes','Moltest','Onthulling'], 4);
    actieDiv.innerHTML  = `<button class="btn btn-ghost" onclick="docentActie('afgelopen', 0)">✓ Sessie afsluiten</button>`;
    antSec.style.display = 'none';

    // Nabespreek
    nabespreek.style.display = 'block';
    renderNabespreek(cases, antwoorden, leerlingen, groepen);
  }
}


function renderOpenScorePanel(rondeNr, groepen, groepStemmen) {
  return `<div class="open-score-panel">
    <div class="open-score-titel">📝 Open antwoord — stel score per groep in (0–10)</div>
    ${groepen.map(g => {
      const bestaand = groepStemmen.find(s => s.groep_id === g.id && s.ronde_nr === rondeNr);
      const val = bestaand?.punten ?? 5;
      return `<div class="open-score-groep-rij">
        <span class="open-score-groep-naam">${escH(g.naam)}</span>
        <input class="open-score-slider" type="range" min="0" max="10" step="1"
          value="${val}" id="slider-${rondeNr}-${g.id}"
          oninput="document.getElementById('val-${rondeNr}-${g.id}').textContent=this.value">
        <span class="open-score-val" id="val-${rondeNr}-${g.id}">${val}</span>
      </div>`;
    }).join('')}
    <button class="btn btn-ghost btn-sm open-score-opslaan"
      onclick="slaOpenScoresOp(${rondeNr}, ${JSON.stringify(groepen.map(g => g.id))})">
      💾 Scores opslaan
    </button>
  </div>`;
}

async function slaOpenScoresOp(rondeNr, groepIds) {
  const btn = document.querySelector('.open-score-opslaan');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
  try {
    await Promise.all(groepIds.map(gid => {
      const slider = document.getElementById(`slider-${rondeNr}-${gid}`);
      const punten = slider ? parseInt(slider.value) : 5;
      return apiFetch('/api/mol/score-open', {
        method: 'POST',
        body: JSON.stringify({ sessie_id: sessieId, ronde_nr: rondeNr, groep_id: gid, punten, docent_code: docentCode }),
      });
    }));
    toast('✅ Scores opgeslagen');
    if (btn) { btn.disabled = false; btn.innerHTML = '💾 Scores opgeslagen ✓'; }
  } catch(e) {
    toast('Fout: ' + e.message);
    if (btn) { btn.disabled = false; btn.innerHTML = '💾 Scores opslaan'; }
  }
}

function renderPhaseSteps(stappen, actief) {
  return stappen.map((s, i) =>
    `<span class="phase-step ${i < actief ? 'done' : i === actief ? 'active' : ''}">${i < actief ? '✓' : ''} ${s}</span>`
  ).join('');
}

async function docentActie(actie, ronde) {
  let newStatus = actie;
  if (actie === 'ronde') newStatus = `ronde_${ronde}`;
  if (actie === 'test')  newStatus = 'test';
  if (actie === 'reveal') {
    newStatus = 'reveal';
    // Bereken scores
    await apiFetch('/api/mol/bereken-scores', { method: 'POST', body: JSON.stringify({ sessie_id: sessieId }) }).catch(() => {});
  }
  if (actie === 'afgelopen') newStatus = 'afgelopen';

  try {
    await apiFetch('/api/mol/sessie/' + sessieId + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ docent_code: docentCode, status: newStatus, huidige_ronde: ronde }),
    });
    renderDocentSessie();
  } catch(e) { toast('Fout: ' + e.message); }
}

function renderNabespreek(cases, antwoorden, leerlingen, groepen) {
  const mol = leerlingen.find(l => l.is_mol);
  const div = document.getElementById('docent-nabespreek-content');
  if (!cases || cases.length === 0) { div.innerHTML = '<p style="color:var(--muted);">Geen cases gevonden.</p>'; return; }

  div.innerHTML = cases.map(c => {
    const molAntw = antwoorden.find(a => a.leerling_id === mol?.id && a.ronde_nr === c.ronde_nr);
    return `<div class="nabespreek-case">
      <div class="nabespreek-vraag">Ronde ${c.ronde_nr}: ${escH(c.vraag)}</div>
      <div class="nabespreek-kolommen">
        <div>
          <div class="nb-col-title" style="color:var(--green);">✅ Correct antwoord</div>
          <div class="nb-col-body" style="color:var(--green-l);">${escH(c.correct_uitleg)}</div>
        </div>
        <div>
          <div class="nb-col-title" style="color:var(--red);">🕵️ Mol's sabotage-argument</div>
          <div class="nb-col-body" style="color:var(--red-l);">${escH(c.fout_uitleg)}</div>
          ${molAntw ? `<div style="margin-top:0.5rem;font-size:0.72rem;color:var(--muted);">Ingediend door ${escH(mol?.naam)}: "${escH(molAntw.argument)}"</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}


function getSpelerUrl() {
  return window.location.href.split('?')[0] + '?rol=speler';
}

async function ensureSessieState() {
  if (!sessieState && sessieId) {
    try {
      sessieState = await apiFetch('/api/mol/sessie/' + sessieId);
    } catch(e) { toast('Fout bij laden sessie: ' + e.message); return false; }
  }
  return !!sessieState;
}

async function openProjectie() {
  if (!(await ensureSessieState())) { toast('Sessie niet gevonden'); return; }
  const leerlingen = sessieState.leerlingen || [];
  const url = getSpelerUrl();

  document.getElementById('proj-sessie-code').textContent = sessieCode || '—';
  document.getElementById('proj-url').textContent = url;

  const grid = document.getElementById('proj-leerlingen-grid');
  grid.innerHTML = leerlingen
    .slice().sort((a, b) => (a.groep_naam||'').localeCompare(b.groep_naam||'') || a.naam.localeCompare(b.naam))
    .map(l => `
      <div class="proj-kaart">
        <div class="proj-groep-tag">${escH(l.groep_naam)}</div>
        <div class="proj-leerling-naam">${escH(l.naam)}</div>
        <div class="proj-code-rij">
          <span class="proj-code-label">Sessie</span>
          <span class="proj-code-val">${sessieCode}</span>
        </div>
        <div class="proj-code-rij">
          <span class="proj-code-label">Spelcode</span>
          <span class="proj-code-val proj-spelcode-val">${escH(l.speler_code)}</span>
        </div>
      </div>`).join('');

  showScreen('screen-sessie-lijst');
}

function sluitProjectie() {
  showScreen('screen-sessie-lijst');
}

async function printBriefjes() {
  if (!(await ensureSessieState())) { toast('Sessie niet gevonden'); return; }
  const leerlingen = sessieState.leerlingen || [];
  const sessie     = sessieState.sessie || {};
  const url  = getSpelerUrl();
  const naam = sessie.les_naam || 'Wie is de Mol';

  const grid = document.getElementById('briefjes-grid');
  grid.innerHTML = leerlingen
    .slice().sort((a, b) => (a.groep_naam||'').localeCompare(b.groep_naam||'') || a.naam.localeCompare(b.naam))
    .map(l => `
      <div class="briefje">
        <div class="briefje-les">${escH(naam)} · ${escH(l.groep_naam||'')}</div>
        <div class="briefje-naam">${escH(l.naam)}</div>
        <div class="briefje-url">${url}</div>
        <div class="briefje-codes">
          <div class="briefje-code-blok">
            <div class="briefje-code-label">Sessie-code</div>
            <div class="briefje-code-val">${sessieCode}</div>
          </div>
          <div class="briefje-code-blok spelcode">
            <div class="briefje-code-label">Jouw spelcode</div>
            <div class="briefje-code-val">${escH(l.speler_code)}</div>
          </div>
        </div>
      </div>`).join('');

  document.getElementById('print-briefjes').style.display = 'block';
  window.print();
  document.getElementById('print-briefjes').style.display = 'none';
}


function getTimer(sessie, cases, rondeNr, type) {
  const c = (cases || []).find(x => x.ronde_nr === rondeNr);
  if (type === 'discussie') return (c?.timer_discussie_override || sessie.timer_discussie || 120) * 1000;
  if (type === 'stem')      return (c?.timer_stem_override      || sessie.timer_stem      || 60)  * 1000;
  return 0;
}

function getFaseTimerSec(sessie, cases, r, fase) {
  if (fase === 'discussie') return getTimer(sessie, cases, r, 'discussie') / 1000;
  if (fase === 'stem')      return getTimer(sessie, cases, r, 'stem')      / 1000;
  return 0;
}

async function advanceFase(newFase, newStatus) {
  // Fase-overgangen lopen nu per groep via
  // /api/mol/sessies/:id/groep-status — deze globale
  // fase-update is niet meer nodig.
}


async function checkAutoAdvance(state) {
  // Fase-overgangen lopen nu per groep via
  // /api/mol/sessies/:id/groep-status — server berekent per-groep
  // wat de volgende fase is.
}

async function startSessieAuto() {
  lastAutoAdvance = '';
  await apiFetch('/api/mol/sessie/' + sessieId + '/status', {
    method: 'PATCH',
    body: JSON.stringify({ docent_code: docentCode, status: 'ronde_1', huidige_ronde: 1 }),
  });
  await advanceFase('invoer', 'ronde_1');
  renderDocentSessie();
}

function buildTimerRing(secTotaal, secResterend, type) {
  const r = 44; const circ = 2 * Math.PI * r;
  const pct    = Math.max(0, secResterend / secTotaal);
  const offset = circ * (1 - pct);
  const urgency = pct < 0.2 ? 'urgent' : pct < 0.4 ? 'warning' : type;
  const mm = String(Math.floor(secResterend / 60)).padStart(2,'0');
  const ss = String(Math.floor(secResterend % 60)).padStart(2,'0');
  return `
    <div class="timer-wrap">
      <div class="timer-container">
        <svg class="timer-ring-svg" width="110" height="110" viewBox="0 0 110 110">
          <circle class="timer-ring-bg" cx="55" cy="55" r="${r}" stroke-width="8"/>
          <circle class="timer-ring-fg ${urgency}" cx="55" cy="55" r="${r}"
            stroke-width="8" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
        </svg>
        <div class="timer-tekst">${mm}:${ss}</div>
      </div>
    </div>`;
}


// ════════════════════════════════════════════════════════════
// LEERLINGEN PICKER (kies uit klas)
// ════════════════════════════════════════════════════════════


// ── Navigatie-stubs voor nieuwe schermen ──

function openSessieNaAanmaken() {
  showScreen('screen-sessie-lijst');
  laadSessieLijst();
}

function printSpelcodes() {
  printBriefjes();
}

function startSessie(id, dCode, sCode) {
  sessieId   = id;
  docentCode = dCode;
  sessieCode = sCode;
  laadDocentSessie();
}

function bewerkSessie(id) {
  toast('Bewerken komt binnenkort beschikbaar.');
}
