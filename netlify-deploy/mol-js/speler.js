// Preview in login-scherm: zoek speler op basis van sessiecode + spelcode
async function onSpelerLoginInput() {
  const sc  = (document.getElementById('speler-sessiecode')?.value || '').trim().toUpperCase();
  const spc = (document.getElementById('speler-spelcode')?.value || '').trim().toUpperCase();
  const preview = document.getElementById('speler-login-preview');
  const btn     = document.getElementById('speler-aanmeld-btn');
  if (sc.length < 4 || spc.length < 4) {
    if (preview) preview.style.display = 'none';
    if (btn) btn.disabled = true;
    return;
  }
  try {
    // Zoek sessie via sessiecode — voor nu gebruiken we sessieId uit URL param als fallback
    const sid = new URLSearchParams(window.location.search).get('sessie') || sessieId;
    if (!sid) { if (btn) btn.disabled = true; return; }
    const res = await apiFetch('/api/mol/sessies/' + sid + '/login', {
      method: 'POST',
      body: JSON.stringify({ sessiecode: sc, spelcode: spc }),
    });
    sessieId = sid;
    speler = res;
    if (preview) preview.style.display = 'block';
    const nEl = document.getElementById('speler-login-naam');
    const gEl = document.getElementById('speler-login-groep');
    if (nEl) nEl.textContent = res.naam;
    if (gEl) gEl.textContent = res.groep_naam || '';
    if (btn) btn.disabled = false;
  } catch(e) {
    if (preview) preview.style.display = 'none';
    if (btn) btn.disabled = true;
  }
}

async function spelerLogin() {
  await onSpelerLoginInput();
  if (speler) spelerAanmelden();
}

async function spelerAanmelden() {
  if (!speler) return;
  // Verlaat screen-speler-login en start de speler-flow
  localStorage.setItem('mol_speler_id', speler.id);
  localStorage.setItem('mol_sessie_id', sessieId);
  initSpelerFlow();
  startHeartbeat();
}


function startHeartbeat() {
  stopHeartbeat();
  // Meteen één keer sturen
  sendHeartbeat();
  // Daarna elke 20 seconden
  heartbeatTimer = setInterval(sendHeartbeat, 10000);
}

function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

async function sendHeartbeat() {
  if (!speler?.id || !sessieId) return;
  try {
    await apiFetch('/api/mol/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ leerling_id: speler.id }),
    });
  } catch(e) { /* stil falen */ }
}

function initSpelerFlow() {
  // Reset alle sessie-state voor een schone start
  lastRenderedFase       = null;
  geselecteerdeOptie     = null;
  geselecteerdeLidId     = null;
  geselecteerdeMcOptieId = null;
  testIngediend          = false;
  testVerdachteId        = null;
  testRondeNr            = null;
  briefingGedrukt        = false;
  briefingGerenderd      = false;
  bekendmakingGetoond    = false;
  const naamEl = document.getElementById('wacht-briefing-naam');
  if (naamEl) naamEl.textContent = speler.naam;
  const topbarEl = document.getElementById('speler-topbar-right');
  if (topbarEl && speler.is_mol) {
    topbarEl.innerHTML += '<span class="topbar-tag tag-mol">🕵️ Mol</span>';
  }
  showScreen('screen-speler-wacht-briefing');
  startPoll(pollSpelerStatus, 3500);
}

async function pollSpelerStatus() {
  let groepStatus;
  try {
    sessieState = await apiFetch('/api/mol/sessie/' + sessieId);
    groepStatus = await apiFetch(
      '/api/mol/sessies/' + sessieId + '/groep-status?groep_id=' + encodeURIComponent(speler.groep_id)
    );
  } catch(e) { return; }

  const { sessie, cases, antwoorden, groepStemmen, leerlingen, groepen,
          briefingKlaar, groepVotes, scores } = sessieState || {};
  if (!sessie) return;

  if (speler && leerlingen) {
    const vers = leerlingen.find(l => l.id === speler.id);
    if (vers) speler = { ...speler, ...vers };
  }

  const fase = groepStatus.fase;
  const ronde = groepStatus.ronde_nr || 1;

  if (sessie.status === 'setup') {
    const mijnGroep = leerlingen.filter(l => l.groep_id === speler.groep_id);
    const nu3 = Date.now();
    const onlineInGroep = mijnGroep.filter(l => l.online_at && (nu3 - l.online_at) < 30000).length;
    const wTitle = document.querySelector('#screen-speler-wacht-briefing .page-title');
    const wSub   = document.querySelector('#screen-speler-wacht-briefing .page-sub');
    if (wTitle) wTitle.textContent = 'Wachten op groepsleden...';
    if (wSub)   wSub.textContent  = `${onlineInGroep} van ${mijnGroep.length} groepsleden online.`;
    showScreen('screen-speler-wacht-briefing');
    return;
  }

  if (fase === 'briefing') {
    const mijnGroep = leerlingen.filter(l => l.groep_id === speler.groep_id);
    if (!briefingGedrukt) {
      renderSpelerBriefing(leerlingen, groepen, sessie);
      showScreen('screen-speler-briefing');
    } else {
      updateBriefingWachtGrid(mijnGroep, briefingKlaar);
      showScreen('screen-speler-wacht-briefing');
    }
    return;
  }

  if (fase === 'ronde_1') {
    renderGroepshoofBekendmaking(leerlingen, sessieState);
    showScreen('screen-speler-groepshoofd-bekendmaking');
    return;
  }

  if (fase === 'invoer') {
    if (!lastRenderedFase || !lastRenderedFase.startsWith(`ronde_${ronde}_invoer`)) {
      lastRenderedFase = null;
      geselecteerdeOptie = null;
      geselecteerdeLidId = null;
      geselecteerdeMcOptieId = null;
    }
    const mijnGroep  = leerlingen.filter(l => l.groep_id === speler.groep_id);
    const caseRonde  = cases.find(c => c.ronde_nr === ronde);
    const mijnAntwoord   = antwoorden.find(a => a.leerling_id === speler.id && a.ronde_nr === ronde);
    const alleAntwoorden = antwoorden.filter(a => a.ronde_nr === ronde && mijnGroep.some(l => l.id === a.leerling_id));
    const alleIngediend  = mijnGroep.every(l => antwoorden.some(a => a.leerling_id === l.id && a.ronde_nr === ronde));
    const groepStem      = groepStemmen.find(s => s.groep_id === speler.groep_id && s.ronde_nr === ronde);
    const timerDiscSec   = getFaseTimerSec(sessie, cases, ronde, 'discussie');
    const timerStemSec   = getFaseTimerSec(sessie, cases, ronde, 'stem');
    const faseTijd       = sessie.fase_gestart_op || Date.now();
    const mijnGroepVotes = (groepVotes || []).filter(v => v.groep_id === speler.groep_id && v.ronde_nr === ronde);
    renderSpelerRonde(ronde, sessie.n_rondes, caseRonde, mijnAntwoord, alleIngediend,
      alleAntwoorden, groepStem, mijnGroep, leerlingen,
      'invoer', faseTijd, timerDiscSec, timerStemSec, mijnGroepVotes, scores || []);
    showScreen('screen-speler-ronde');
    return;
  }

  if (fase === 'discussie') {
    await renderDiscussiescherm();
    return;
  }

  if (fase === 'resultaat') {
    await renderFeedbackScherm();
    return;
  }

  if (fase === 'test') {
    if (!testIngediend) {
      lastRenderedFase = null;
      renderSpelerTest(leerlingen, sessieState);
      showScreen('screen-speler-test');
      clearInterval(pollTimer);
    }
    return;
  }

  if (fase === 'reveal' || sessie.status === 'reveal' || sessie.status === 'afgelopen') {
    clearInterval(pollTimer);
    renderSpelerReveal(sessieState, scores || []);
    showScreen('screen-speler-reveal');
    return;
  }
}

async function renderDiscussiescherm() {
  const res = await apiFetch(
    '/api/mol/sessies/' + sessieId +
    '/discussie-data?leerling_id=' + encodeURIComponent(speler.id) +
    '&groep_id=' + encodeURIComponent(speler.groep_id)
  );

  const vraagEl = document.getElementById('discussie-vraag');
  const eigenEl = document.getElementById('disc-eigen-antwoord');
  const hoofdEl = document.getElementById('disc-groepshoofd-naam');
  const instrEl = document.getElementById('disc-instructie');
  const btnEl   = document.getElementById('disc-groepsantwoord-knop');
  const container = document.getElementById('disc-vraag-container');

  const vraagTekst = res.vraag?.vraag || res.vraag_tekst || '';
  const opties     = res.opties || res.vraag?.opties || [];
  const eigenId    = res.eigen_antwoord?.mc_optie_id || res.eigen_antwoord?.antwoord;

  if (vraagEl) vraagEl.textContent = vraagTekst;
  if (eigenEl) eigenEl.textContent = res.eigen_antwoord?.antwoord || '';

  if (container) {
    if (res.is_groepshoofd) {
      // Groepshoofd: opties klikbaar in discussie-gh-opties
      container.innerHTML = `
        <div id="discussie-vraag" class="card" style="margin-bottom:1rem;">${escH(vraagTekst)}</div>
        <div id="discussie-gh-opties">` +
        opties.map(o => `
          <div class="gh-optie" data-optie="${escH(o.id || o.tekst)}" style="cursor:pointer;padding:0.65rem 0.85rem;border:1px solid var(--border);border-radius:8px;margin-bottom:0.4rem;" onclick="geselecteerdeOptie='${escH(o.id || o.tekst)}'">
            <span>${escH(o.tekst)}</span>
            ${(o.id === eigenId || o.tekst === eigenId) ? '<span class="tag-jij" style="margin-left:0.5rem;color:var(--gold);">jij</span>' : ''}
          </div>`).join('') +
        `</div>`;
    } else {
      // Gewone speler: discussie-opties niet klikbaar
      container.innerHTML = `
        <div id="discussie-vraag" class="card" style="margin-bottom:1rem;">${escH(vraagTekst)}</div>
        <div id="discussie-opties">` +
        opties.map(o => `
          <div class="discussie-optie" style="padding:0.65rem 0.85rem;border:1px solid var(--border);border-radius:8px;margin-bottom:0.4rem;opacity:0.85;">
            <span>${escH(o.tekst)}</span>
            ${(o.id === eigenId || o.tekst === eigenId) ? '<span class="tag-jij" style="margin-left:0.5rem;color:var(--gold);">jij</span>' : ''}
          </div>`).join('') +
        `</div>`;
    }
  }

  if (res.is_groepshoofd) {
    if (instrEl) instrEl.textContent = 'Kies het groepsantwoord en druk op Groepsantwoord';
    if (btnEl) btnEl.style.display = 'block';
  } else {
    if (hoofdEl) hoofdEl.textContent = res.groepshoofd_naam || '';
    if (instrEl) instrEl.textContent = 'Kies als groep voor een uniform antwoord en bespreek wat het antwoord wordt';
    if (btnEl) btnEl.style.display = 'none';
  }
  showScreen('screen-speler-discussie');
}

async function renderFeedbackScherm() {
  const data = await apiFetch(
    '/api/mol/sessies/' + sessieId +
    '/ronde-feedback?leerling_id=' + encodeURIComponent(speler.id) +
    '&groep_id=' + encodeURIComponent(speler.groep_id) +
    '&ronde_nr=' + (speler.ronde_nr || 1)
  );

  const scoreVal = document.getElementById('feedback-score-val');
  if (scoreVal) scoreVal.textContent = (data.eigen_score || 0) + ' punten';

  const content = document.getElementById('feedback-content');
  if (content) {
    content.innerHTML = `
      <div class="card" style="margin-bottom:1rem;">
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);margin-bottom:0.3rem;">Vraag</div>
        <div>${escH(data.vraag_tekst || '')}</div>
      </div>
      ${(data.opties || []).map(opt => `
        <div class="feedback-optie ${opt.correct ? 'correct' : ''} ${opt.is_eigen_antwoord ? 'eigen' : ''}"
          style="padding:0.85rem 1rem;border:1px solid var(--border);border-radius:10px;margin-bottom:0.5rem;">
          <div class="feedback-optie-rij" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
            <span>${escH(opt.tekst)}</span>
            <span>
              ${opt.correct ? '<span class="tag-correct" style="color:var(--green);">✓ correct</span>' : ''}
              ${opt.is_eigen_antwoord && opt.correct ? '<span class="tag-jij-correct" style="color:var(--green);">jij · correct</span>' : ''}
              ${opt.is_eigen_antwoord && !opt.correct ? '<span class="tag-jij-fout" style="color:var(--red-l);">jij</span>' : ''}
              ${opt.is_groepsantwoord ? '<span class="tag-groep" style="color:var(--gold);">👑 groep</span>' : ''}
            </span>
          </div>
          <div class="feedback-uitleg" style="font-size:0.82rem;color:var(--muted);margin-top:0.35rem;">${escH(opt.feedback || '')}</div>
        </div>`).join('')}`;
  }
  showScreen('screen-speler-feedback');
}

function naarVolgendeRondeOfTest() {
  const ronde   = sessieState?.sessie?.huidige_ronde || 1;
  const nRondes = sessieState?.sessie?.n_rondes || 1;
  if (ronde < nRondes) {
    startPoll(pollSpelerStatus, 3500);
  } else {
    renderSpelerTest(sessieState.leerlingen, sessieState);
    showScreen('screen-speler-test');
    clearInterval(pollTimer);
  }
}

async function submitGroepsantwoord() {
  const antwoord = geselecteerdeOptie;
  if (!antwoord) { toast('Kies eerst een antwoord'); return; }
  await apiFetch('/api/mol/sessies/' + sessieId + '/groepsantwoord', {
    method: 'POST',
    body: JSON.stringify({
      leerling_id: speler.id,
      groep_id: speler.groep_id,
      antwoord,
      ronde_nr: speler.ronde_nr || 1,
    }),
  });
  renderGroepsantwoordBevestiging(antwoord);
  showScreen('screen-speler-groepsantwoord');
}

// Scherm 8: bevestiging na indiening groepsantwoord (alleen voor groepshoofd).
// Gewone spelers gaan via de poll direct naar scherm 9 (fase 'resultaat').
function renderGroepsantwoordBevestiging(antwoord) {
  const tekstEl = document.getElementById('groepsantwoord-tekst');
  const doorEl  = document.getElementById('groepsantwoord-door');
  const leerlingen = sessieState?.leerlingen || [];
  const mijnGroep  = leerlingen.filter(l => l.groep_id === speler.groep_id);
  const hoofd = mijnGroep.find(l => l.is_groepshoofd);
  if (tekstEl) tekstEl.textContent = antwoord;
  if (doorEl)  doorEl.textContent  = hoofd ? hoofd.naam : '---';
  startCountdown('groepsantwoord-countdown', 5, () => { pollSpelerStatus(); });
}


function renderSpelerBriefing(leerlingen, groepen, sessie) {
  const mijnGroep = leerlingen.filter(l => l.groep_id === speler.groep_id);
  const groepNaam = mijnGroep.length > 0 ? mijnGroep[0].groep_naam : 'Jouw groep';
  const sec = document.getElementById('speler-briefing-sectie');
  if (!sec) return;
  document.getElementById('briefing-speler-naam').textContent = speler.naam || '—';
  document.getElementById('briefing-groep-naam').textContent = groepNaam;

  // ── Eerste keer: volledige render ────────────────────────────────────────────
  if (!briefingGerenderd) {
    briefingGerenderd = true;

    let html = '<div class="card highlight-' + (speler.is_mol ? 'red' : 'green') + '" style="margin-bottom:1rem;">';
    if (speler.is_mol) {
      html += '<div class="mol-secret"><div class="mol-secret-title">🕵️ Jij bent de Mol</div>'
        + '<p style="font-size:0.83rem;color:var(--text2);line-height:1.6;margin-bottom:0.75rem;">'
        + 'Jouw missie: laat de groep zoveel mogelijk punten verspillen. Breng per ronde een plausibel fout argument in en verdedig het in de discussie — zonder te opvallen.'
        + '</p><div class="mol-fout-arg"><div class="mol-fout-label">Jouw instructie per ronde</div>'
        + '<div class="mol-fout-text">Je ziet per ronde een fout argument dat jij moet verdedigen. Jouw individuele antwoord moet dit argument bevatten.</div></div></div>';
    } else {
      html += '<div style="padding:0.5rem 0;"><div style="font-size:1.3rem;margin-bottom:0.5rem;">🎓</div>'
        + '<div style="font-weight:700;font-size:0.9rem;margin-bottom:0.3rem;color:#fff;">Jij bent een gewone deelnemer</div>'
        + '<div style="font-size:0.82rem;color:var(--text2);line-height:1.6;">Werk samen om punten te verdienen. Pas op — '
        + '<strong style="color:var(--red-l);">er is een Mol in jouw groep</strong>. Ontmasker hem of haar in de moltest.</div></div>';
    }
    html += '</div>';
    html += '<div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--text2);margin-bottom:0.5rem;">Jouw groep: ' + escH(groepNaam) + '</div>';
    html += mijnGroep.map(l =>
      '<div class="leerling-rij" style="margin-bottom:0.4rem;">'
      + '<div style="width:32px;height:32px;border-radius:50%;background:var(--bg3);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1rem;">'
      + (l.id === speler.id ? '👤' : '🎓') + '</div>'
      + '<div style="flex:1;font-weight:' + (l.id === speler.id ? '700' : '500') + ';font-size:0.85rem;">'
      + escH(l.naam) + (l.id === speler.id ? ' (jij)' : '') + '</div></div>'
    ).join('');

    // Groepshoofd-sectie
    html += '<div id="groepshoofd-sectie" style="margin-top:1.25rem;"><div class="card">'
      + '<div style="font-weight:700;font-size:0.88rem;margin-bottom:0.25rem;color:#fff;">👑 Stap 1 — Kies een groepshoofd</div>'
      + '<p style="font-size:0.75rem;color:var(--text2);margin-bottom:0.75rem;">'
      + 'Het groepshoofd dient namens de groep het antwoord in. Je kunt niet op jezelf stemmen.</p>'
      + '<div id="gh-keuze-lijst">';
    // Je kunt niet op jezelf stemmen — filter eigen speler uit
    const kiesbaar = mijnGroep.filter(l => l.id !== speler.id);
    kiesbaar.forEach(l => {
      html += '<div class="gh-kandidaat" id="gh-' + l.id + '" data-kandidaat="' + l.id + '" style="cursor:pointer;">'
        + '<span style="font-size:1.1rem;">🎓</span>'
        + '<span style="font-weight:600;font-size:0.88rem;">' + escH(l.naam) + '</span>'
        + '</div>';
    });
    html += '</div>'
      + '<div id="gh-status" style="margin-top:0.65rem;font-size:0.78rem;color:var(--muted);"></div>'
      + '</div></div>';

    // Start-knop
    html += '<div id="briefing-start-wrap" style="margin-top:1rem;">'
      + '<button class="btn btn-gold btn-full" id="briefing-start-btn" disabled style="opacity:0.5;" onclick="drukOpStart()">'
      + '⏳ Stem eerst op een groepshoofd</button>'
      + '<div style="font-size:0.68rem;color:var(--muted);text-align:center;margin-top:0.4rem;">Stap 2 — Bevestig dat je de briefing hebt gelezen</div>'
      + '</div>'
      + '<div id="briefing-wacht" style="display:none;margin-top:1rem;">'
      + '<div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);margin-bottom:0.5rem;">Wachten op groepsleden...</div>'
      + '<div class="wacht-grid" id="briefing-wacht-grid"></div></div>';

    sec.innerHTML = html;

    // Event listener — één keer, stabiel
    const ghLijst = document.getElementById('gh-keuze-lijst');
    if (ghLijst) {
      ghLijst.addEventListener('click', function(e) {
        const el = e.target.closest('[data-kandidaat]');
        if (el && !el.classList.contains('mijn-keuze')) {
          stemOpGroepshoofd(el.getAttribute('data-kandidaat'));
        }
      });
    }
  }

  // ── Altijd: update dynamische delen zonder innerHTML te vervangen ──────────
  updateBriefingDynamisch(mijnGroep, leerlingen);
}

function updateBriefingDynamisch(mijnGroep, alleLeerlingen) {
  const groepshoofd    = mijnGroep.find(l => l.is_groepshoofd);
  const heeftGestemd   = !!speler.groepshoofd_stem;
  const ghStatus       = document.getElementById('gh-status');
  const startBtn       = document.getElementById('briefing-start-btn');

  // Update kandidaat-highlights
  mijnGroep.forEach(l => {
    const el = document.getElementById('gh-' + l.id);
    if (!el) return;
    const isGekozen = heeftGestemd && speler.groepshoofd_stem === l.id;
    const isGH      = l.is_groepshoofd;
    el.classList.toggle('mijn-keuze', isGekozen);
    // Verwijder oude badge, voeg nieuwe toe indien groepshoofd
    const bestaandBadge = el.querySelector('.gh-badge');
    if (bestaandBadge) bestaandBadge.remove();
    if (isGH) {
      const badge = document.createElement('span');
      badge.className = 'gh-badge';
      badge.textContent = '👑 Groepshoofd';
      el.appendChild(badge);
    }
  });

  // Update status tekst
  if (ghStatus) {
    if (groepshoofd) {
      ghStatus.style.color = 'var(--gold-l)';
      ghStatus.innerHTML = '👑 Groepshoofd: <strong>' + escH(groepshoofd.naam) + '</strong>';
    } else if (heeftGestemd) {
      ghStatus.style.color = 'var(--muted)';
      ghStatus.textContent = 'Jouw stem is ingediend. Wachten tot iedereen gestemd heeft...';
    }
  }

  // Update start-knop
  if (startBtn && !briefingGedrukt) {
    const kanStarten = heeftGestemd && !!groepshoofd;
    startBtn.disabled = !kanStarten;
    startBtn.style.opacity = kanStarten ? '1' : '0.5';
    startBtn.innerHTML = kanStarten
      ? '✅ Briefing gelezen — Start!'
      : (heeftGestemd ? '⏳ Wachten op andere groepsleden...' : '⏳ Stem eerst op een groepshoofd');
  }
}


async function drukOpStart() {
  if (briefingGedrukt) return;
  if (!speler.groepshoofd_stem) {
    toast('Kies eerst een groepshoofd');
    return;
  }
  briefingGedrukt = true;
  const btn = document.getElementById('briefing-start-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Wachten op groep...'; }
  document.getElementById('briefing-wacht').style.display = 'block';

  try {
    await apiFetch('/api/mol/sessies/' + sessieId + '/briefing-start', {
      method: 'POST',
      body: JSON.stringify({
        leerling_id: speler.id,
        groepshoofd_stem: speler.groepshoofd_stem,
      }),
    });
  } catch(e) { console.error('briefing-start fout:', e.message); }
}


async function stemOpGroepshoofd(kandidaatId) {
  if (groepshoofGedrukt) return;
  groepshoofGedrukt = true;
  // Directe visuele feedback — markeer gekozen kandidaat meteen
  document.querySelectorAll('.gh-kandidaat[data-kandidaat]').forEach(el => {
    el.style.opacity = '0.5';
  });
  const gekozene = document.getElementById('gh-' + kandidaatId);
  if (gekozene) { gekozene.classList.add('mijn-keuze'); gekozene.style.opacity = '1'; }

  // Update start-knop naar "wachten" toestand
  const startBtn = document.getElementById('briefing-start-btn');
  if (startBtn) { startBtn.disabled = true; startBtn.style.opacity = '0.5'; startBtn.innerHTML = '⏳ Wachten op andere groepsleden...'; }

  try {
    await apiFetch('/api/mol/groepshoofd-stem', {
      method: 'POST',
      body: JSON.stringify({ sessie_id: sessieId, leerling_id: speler.id, kandidaat_id: kandidaatId }),
    });
    // Poll haalt verse data op en update de start-knop via updateBriefingDynamisch
    await pollSpelerStatus();
  } catch(e) {
    groepshoofGedrukt = false; // reset zodat opnieuw geprobeerd kan worden
    toast('Stemmen mislukt: ' + e.message);
  }
}

function updateBriefingWachtGrid(mijnGroep, briefingKlaar) {
  // Update dynamische briefing-delen (groepshoofd, start-knop)
  updateBriefingDynamisch(mijnGroep, null);
  const grid = document.getElementById('briefing-wacht-grid');
  if (!grid) return;
  const klaarIds = new Set((briefingKlaar || []).map(b => b.leerling_id));
  grid.innerHTML = mijnGroep.map(l => {
    const klaar = klaarIds.has(l.id);
    return `<div class="wacht-chip ${klaar ? 'klaar' : ''}">
      <div class="dot"></div>${escH(l.naam.split(' ')[0])}
    </div>`;
  }).join('');

  // Toon groepshoofd badge als bekend
  const groepshoofd = mijnGroep.find(l => l.is_groepshoofd);
  if (groepshoofd) {
    const ghSectie = document.getElementById('groepshoofd-sectie');
    if (ghSectie && briefingGedrukt) ghSectie.style.display = 'block';
    const bestaandBadge = document.getElementById('gh-winnaar-badge');
    if (!bestaandBadge && groepshoofd) {
      const ghWacht = document.getElementById('gh-wacht');
      if (ghWacht) ghWacht.insertAdjacentHTML('afterend',
        `<div id="gh-winnaar-badge" style="margin-top:0.65rem;padding:0.5rem 0.75rem;
          background:rgba(212,168,67,0.08);border-radius:8px;font-size:0.78rem;color:var(--gold-l);">
          👑 Groepshoofd: <strong>${escH(groepshoofd.naam)}</strong>
        </div>`);
    }
  }
}

function startCountdown(elementId, seconden, callback) {
  let resterend = seconden;
  const el = document.getElementById(elementId);
  if (el) el.textContent = resterend;
  const timer = setInterval(() => {
    resterend--;
    if (el) el.textContent = resterend;
    if (resterend <= 0) { clearInterval(timer); callback(); }
  }, 1000);
}

function renderGroepshoofBekendmaking(leerlingen, state) {
  if (bekendmakingGetoond) return;
  bekendmakingGetoond = true;
  const mijnGroep = leerlingen.filter(l => l.groep_id === speler.groep_id);
  const hoofd = mijnGroep.find(l => l.is_groepshoofd);
  const naamEl  = document.getElementById('groepshoofd-naam');
  const badgeEl = document.getElementById('groepshoofd-eigen-badge');
  if (naamEl)  naamEl.textContent  = hoofd ? hoofd.naam : '—';
  if (badgeEl) badgeEl.style.display = speler.is_groepshoofd ? 'block' : 'none';
  startCountdown('groepshoofd-countdown', 10, () => {});
}

function renderSpelerRonde(rondeNr, nRondes, caseData, mijnAntwoord, alleIngediend,
  alleAntwoorden, groepStem, mijnGroep, alleLeerlingen,
  faseSrv, faseTijd, timerDiscSec, timerStemSec, groepVotesRonde, scoresArr) {
  groepVotesRonde = groepVotesRonde || [];
  scoresArr       = scoresArr       || [];
  faseSrv      = faseSrv  || 'invoer';
  faseTijd     = faseTijd || Date.now();
  timerDiscSec = timerDiscSec || 120;
  timerStemSec = timerStemSec || 60;

  // Huidige fase: server-fase heeft prioriteit boven lokale afleiding
  let huidigeRenderFase = `ronde_${rondeNr}_${faseSrv}`;

  // Altijd topbar en progress updaten
  document.getElementById('ronde-topbar-label').textContent = `Ronde ${rondeNr}/${nRondes}`;
  document.getElementById('ronde-progress').style.width = `${40 + (rondeNr / nRondes) * 40}%`;

  // Sla volledige re-render over als fase niet veranderd is
  // (voorkomt dat poll het invulveld en de geselecteerde optie wist)
  if (huidigeRenderFase === lastRenderedFase) return;
  lastRenderedFase = huidigeRenderFase;

  const content = document.getElementById('ronde-content');
  const faseLabel = document.getElementById('ronde-fase-label');

  if (!caseData) {
    // Niet cachen in lastRenderedFase — zodat volgende poll opnieuw controleert
    lastRenderedFase = null;
    faseLabel.textContent = 'Ronde ' + rondeNr;
    content.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--muted);">
      <span class="spinner"></span> Case wordt geladen...
    </div>`;
    return;
  }

  // FASE A: Nog niet iedereen ingediend — individueel antwoord
  if (!mijnAntwoord) {
    faseLabel.textContent = `Ronde ${rondeNr} — Stap ① Jouw antwoord`;
    let html = `<div class="case-card">
      <div class="case-ronde">Ronde ${rondeNr} van ${nRondes}</div>
      <div class="case-vraag">${escH(caseData.vraag)}</div>
      ${caseData.context ? `<div class="case-context">${escH(caseData.context)}</div>` : ''}
    </div>`;

    // Mol ziet het foute argument
    if (speler.is_mol) {
      html += `<div class="mol-secret" style="margin-bottom:1rem;">
        <div class="mol-secret-title" style="font-size:0.88rem;">🕵️ Jouw sabotage-instructie</div>
        <div class="mol-fout-arg">
          <div class="mol-fout-label">Argument dat jij moet verdedigen</div>
          <div class="mol-fout-text">${escH(caseData.fout_uitleg)}</div>
        </div>
      </div>`;
    }

    const isMc = caseData.vraagtype === 'mc' && caseData.mc_opties && caseData.mc_opties.length > 0;
    html += `<div class="card">
      <div style="font-weight:700;font-size:0.88rem;margin-bottom:0.75rem;color:#fff;">${isMc ? 'Kies het juiste antwoord' : 'Kies jouw standpunt'}</div>
      <div class="antwoord-opties" id="keuze-opties">
        ${isMc
          ? caseData.mc_opties.map((o, i) =>
              `<button class="antwoord-optie" id="opt-${o.id}" onclick="selecteerMcOptie('${o.id}','${o.is_correct ? 'correct' : 'fout'}')">
                <strong style="color:var(--text2);margin-right:0.4rem;">${['A','B','C','D'][i]}</strong> ${escH(o.tekst)}
              </button>`).join('')
          : `<button class="antwoord-optie" id="opt-correct" onclick="selecteerOptie('correct')">
              ✅ Het correcte economische antwoord
            </button>
            <button class="antwoord-optie" id="opt-fout" onclick="selecteerOptie('fout')">
              ❌ Het alternatieve antwoord
            </button>`
        }
      </div>
    </div>
    <div class="card" id="argument-sectie" style="display:none;">
      <div style="font-weight:700;font-size:0.88rem;margin-bottom:0.5rem;color:#fff;">Onderbouw jouw keuze</div>
      <textarea id="argument-input" rows="4" placeholder="Leg uit waarom jij dit antwoord kiest. Gebruik economische begrippen uit de les." autocomplete="off"></textarea>
      <button class="btn btn-gold btn-full" style="margin-top:0.75rem;" id="submit-antwoord-btn" onclick="submitAntwoord(${rondeNr})">
        Antwoord indienen →
      </button>
      <div id="antwoord-error" class="error-msg"></div>
    </div>`;

    content.innerHTML = html;

    // Leeg het tekstveld altijd bij een nieuwe render van de invoer-fase
    setTimeout(() => {
      const ta = document.getElementById('argument-input');
      if (ta) ta.value = '';
      const sec = document.getElementById('argument-sectie');
      if (sec) sec.style.display = 'none';
    }, 10);

    // Mol heeft vaste keuze (fout)
    if (speler.is_mol) {
      setTimeout(() => selecteerOptie('fout'), 100);
    }
    // Update opties naar MC als vraagtype mc is
    if (caseData.vraagtype === 'mc' && caseData.mc_opties && caseData.mc_opties.length > 0) {
      setTimeout(() => renderMcKeuzeVoorSpeler(caseData, rondeNr), 50);
    }

  } else if (!alleIngediend) {
    // FASE B: Eigen antwoord ingediend — wachten op anderen
    faseLabel.textContent = `Ronde ${rondeNr} — Stap ② Wachten`;
    const wachtLijst = mijnGroep.map(l => {
      const isKlaar = alleAntwoorden.some(a => a.leerling_id === l.id);
      return `<div class="wacht-chip ${isKlaar ? 'klaar' : ''}">
        <div class="dot"></div>${escH(l.naam.split(' ')[0])}
      </div>`;
    }).join('');

    content.innerHTML = `<div style="text-align:center;padding:1.5rem 0 1rem;">
      <div style="font-size:2rem;margin-bottom:0.75rem;">✅</div>
      <div style="font-weight:700;font-size:0.95rem;color:#fff;margin-bottom:0.3rem;">Jouw antwoord is ingediend</div>
      <p style="font-size:0.8rem;color:var(--muted);margin-bottom:1.25rem;">Wachten tot iedereen klaar is...</p>
      <div class="wacht-grid">${wachtLijst}</div>
    </div>`;

  } else if (!groepStem && (faseSrv === 'stem' || (faseSrv === 'invoer' && alleIngediend))) {
    // STEM: kies groepsantwoord (direct na invoer, geen discussiefase)
    faseLabel.textContent = `Ronde ${rondeNr} — Stap ③ Groepsstemming`;
    const verstrekenStem = Math.floor((Date.now() - faseTijd) / 1000);
    const resterendStem  = Math.max(0, timerStemSec - verstrekenStem);
    const groepsleden = mijnGroep.map(l => {
      const ant = alleAntwoorden.find(a => a.leerling_id === l.id);
      return { leerling: l, ant };
    });

    // Groepshoofd bepalen
    const isGroepshoofd = speler.is_groepshoofd === true;
    const groepshoofdNaam = mijnGroep.find(l => l.is_groepshoofd)?.naam || '?';

    const isMc = caseData?.vraagtype === 'mc' && caseData?.mc_opties?.length > 0;
    const stemOpties = isMc
      ? caseData.mc_opties.map((o, i) => ({ id: o.id, label: ['A','B','C','D'][i], tekst: o.tekst }))
      : [{ id: 'correct', label: '✅', tekst: 'Het correcte antwoord' },
         { id: 'fout',    label: '❌', tekst: 'Het alternatieve antwoord' }];

    let html = `<div class="case-card">
      <div class="case-ronde">Ronde ${rondeNr} — Groepskeuze</div>
      <div class="case-vraag">${escH(caseData.vraag)}</div>
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
        <div style="font-weight:700;font-size:0.88rem;color:#fff;">
          ${isGroepshoofd ? '👑 Jij bent het groepshoofd — kies het groepsantwoord' : '👀 Wachten op het groepshoofd'}
        </div>
        ${!isGroepshoofd ? `<span class="gh-badge">👑 ${escH(groepshoofdNaam)}</span>` : ''}
      </div>
      <p style="font-size:0.75rem;color:var(--text2);margin-bottom:0.75rem;">
        ${isGroepshoofd
          ? 'Bespreek met je groep. Klik dan op het gekozen antwoord om het in te dienen.'
          : 'Bekijk de opties. Het groepshoofd dient het antwoord in na de discussie.'}
      </p>
      <div id="stem-opties-lijst">`;

    stemOpties.forEach(opt => {
      html += `<div class="vote-optie" id="stemopt-${opt.id}"
        ${isGroepshoofd ? `onclick="groepshoofIndienen('${opt.id}', ${rondeNr})"` : ''}
        style="${isGroepshoofd ? '' : 'cursor:default;'}">
        <span class="vote-label">${opt.label}</span>
        <span class="vote-tekst">${escH(opt.tekst)}</span>
      </div>`;
    });

    html += `</div>
      <div id="stem-error" class="error-msg"></div>
    </div>`;

    html += buildTimerRing(timerStemSec, resterendStem, 'stem');
    html += `<div class="timer-label" style="text-align:center;margin-top:-0.25rem;">Stemtijd</div>`;
    content.innerHTML = html;

  } else if (faseSrv === 'resultaat_5sec' && groepStem) {
    // 5-sec countdown na groepskeuze
    faseLabel.textContent = `Ronde ${rondeNr} — Groepskeuze ingediend`;
    const verstreken5 = Math.floor((Date.now() - faseTijd) / 1000);
    const resterend5  = Math.max(0, 5 - verstreken5);
    const gekozenOptieId = groepStem.gekozen_argument;
    const isMc2 = caseData?.vraagtype === 'mc' && caseData?.mc_opties?.length > 0;
    const gekozenTekst = isMc2
      ? caseData.mc_opties.find(o => o.id === gekozenOptieId)?.tekst || gekozenOptieId
      : (gekozenOptieId === 'correct' ? 'Correct antwoord' : 'Alternatief antwoord');

    content.innerHTML = `
      <div class="card" style="text-align:center;padding:1.5rem;">
        <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--gold);margin-bottom:0.5rem;">
          👑 Groepskeuze
        </div>
        <div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:1rem;">${escH(gekozenTekst)}</div>
        <div class="countdown-groot">${resterend5}</div>
        <div style="font-size:0.72rem;color:var(--muted);margin-top:0.5rem;">seconden zichtbaar voor iedereen</div>
      </div>`;

  } else {
    // FASE D: Stem ingediend — resultaat tonen
    faseLabel.textContent = `Ronde ${rondeNr} — Resultaat`;
    const isCorrect = groepStem.is_correct;

    content.innerHTML = `
      <div class="card ${isCorrect ? 'highlight-green' : 'highlight-red'}" style="text-align:center;padding:2rem 1.5rem;margin-bottom:1rem;">
        <div style="font-size:2.5rem;margin-bottom:0.75rem;">${isCorrect ? '✅' : '❌'}</div>
        <div style="font-family:'Syne',sans-serif;font-size:1.3rem;font-weight:800;color:${isCorrect ? 'var(--green-l)' : 'var(--red-l)'};margin-bottom:0.3rem;">
          ${isCorrect ? 'Goed!' : 'Helaas — fout antwoord'}
        </div>
      </div>
      <div class="card">
        <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:var(--green);margin-bottom:0.4rem;">✅ Correct antwoord</div>
        <div style="font-size:0.85rem;color:var(--text);line-height:1.6;">${escH(caseData.correct_uitleg)}</div>
      </div>
      <div style="text-align:center;font-size:0.8rem;color:var(--muted);padding:1rem;">
        Wacht op je leraar voor de volgende ronde...
      </div>`;
  }
}

function selecteerOptie(optie) {
  geselecteerdeOptie = optie;
  document.querySelectorAll('.antwoord-optie').forEach(b => b.classList.remove('selected'));
  document.getElementById('opt-' + optie)?.classList.add('selected');
  document.getElementById('argument-sectie').style.display = 'block';
}

function selecteerMcOptie(optieId, correctheid) {
  geselecteerdeOptie     = correctheid;
  geselecteerdeMcOptieId = optieId;
  document.querySelectorAll('.antwoord-optie').forEach(b => b.classList.remove('selected'));
  document.getElementById('opt-' + optieId)?.classList.add('selected');
  // Bij MC geen open tekstveld — pre-fill argument met optie-tekst
  const argInput = document.getElementById('argument-input');
  const gekozenOptie = document.querySelector(`#opt-${optieId}`);
  if (argInput && gekozenOptie) {
    argInput.value = gekozenOptie.innerText.trim().replace(/^[A-D]\s+/, '');
  }
  document.getElementById('argument-sectie').style.display = 'block';
}

function selecteerGroepsLid(id) {
  geselecteerdeLidId = id;
  document.querySelectorAll('.groepslid-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('stem-' + id)?.classList.add('selected');
  const btn = document.getElementById('submit-stem-btn');
  if (btn) btn.disabled = false;
}

async function submitAntwoord(rondeNr) {
  const arg = document.getElementById('argument-input')?.value.trim();
  const err = document.getElementById('antwoord-error');
  if (!geselecteerdeOptie) { err.textContent = 'Kies een standpunt.'; err.style.display='block'; return; }
  if (!arg || arg.length < 10) { err.textContent = 'Geef een onderbouwing (minimaal 10 tekens).'; err.style.display='block'; return; }
  err.style.display = 'none';
  const btn = document.getElementById('submit-antwoord-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Indienen...';
  try {
    await apiFetch('/api/mol/antwoord', {
      method: 'POST',
      body: JSON.stringify({
        sessie_id:    sessieId,
        ronde_nr:     rondeNr,
        leerling_id:  speler.id,
        antwoord:     geselecteerdeOptie,
        argument:     arg,
        mc_optie_id:  geselecteerdeMcOptieId || null,
      }),
    });
    geselecteerdeOptie = null;
    // Meteen re-poll zodat de overgang naar discussie snel zichtbaar is
    await pollSpelerStatus();
  } catch(e) {
    err.textContent = e.message; err.style.display = 'block';
    btn.disabled = false; btn.innerHTML = 'Antwoord indienen →';
  }
}

async function groepshoofIndienen(optieId, rondeNr) {
  if (!speler.is_groepshoofd) return;
  // Highlight de gekozen optie
  document.querySelectorAll('.vote-optie').forEach(el => {
    el.style.opacity = '0.5'; el.style.cursor = 'default';
    el.onclick = null;
  });
  const gekozen = document.getElementById('stemopt-' + optieId);
  if (gekozen) { gekozen.style.opacity = '1'; gekozen.classList.add('mijn-keuze'); }

  try {
    await apiFetch('/api/mol/groep-stem-hoofd', {
      method: 'POST',
      body: JSON.stringify({
        sessie_id:        sessieId,
        ronde_nr:         rondeNr,
        groep_id:         speler.groep_id,
        leerling_id:      speler.id,
        gekozen_optie_id: optieId,
      }),
    });
    await pollSpelerStatus();
  } catch(e) {
    const err = document.getElementById('stem-error');
    if (err) { err.textContent = e.message; err.style.display = 'block'; }
  }
}

async function submitGroepsStem(rondeNr) {
  const err = document.getElementById('stem-error');
  if (!geselecteerdeLidId) { err.textContent = 'Kies een groepslid.'; err.style.display='block'; return; }
  err.style.display = 'none';
  const btn = document.getElementById('submit-stem-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    await apiFetch('/api/mol/groep-stem', {
      method: 'POST',
      body: JSON.stringify({ sessie_id: sessieId, ronde_nr: rondeNr, groep_id: speler.groep_id, gekozen_leerling_id: geselecteerdeLidId }),
    });
    geselecteerdeLidId = null;
    pollSpelerStatus();
  } catch(e) {
    err.textContent = e.message; err.style.display = 'block';
    btn.disabled = false; btn.innerHTML = 'Groepskeuze indienen →';
  }
}

function renderSpelerTest(leerlingen, state) {
  clearInterval(pollTimer);
  const mijnGroep = leerlingen.filter(l => l.groep_id === speler.groep_id && l.id !== speler.id);

  // Verdachte keuze
  const vc = document.getElementById('test-verdachte-keuze');
  vc.innerHTML = mijnGroep.map(l => `
    <button class="groepslid-btn" id="verd-${l.id}" onclick="selecteerVerdachte('${l.id}')">
      <div class="groepslid-avatar">🎓</div>
      <div style="font-weight:700;font-size:0.88rem;">${escH(l.naam)}</div>
    </button>`).join('');
}

function selecteerVerdachte(id) {
  testVerdachteId = id;
  document.querySelectorAll('.groepslid-btn[id^="verd-"]').forEach(b => b.classList.remove('selected'));
  document.getElementById('verd-' + id)?.classList.add('selected');
}
function selecteerTestRonde(r) {
  testRondeNr = r;
  document.querySelectorAll('.antwoord-optie[id^="ronde-opt-"]').forEach(b => b.classList.remove('selected'));
  document.getElementById('ronde-opt-' + r)?.classList.add('selected');
}

function renderWachtTest(leerlingen) {
  const mijnGroep = (leerlingen || []).filter(
    l => l.groep_id === speler.groep_id
  );
  const grid = document.getElementById('wacht-test-grid');
  if (!grid) return;
  grid.innerHTML = mijnGroep.map(l => {
    const klaar = l.id === speler.id;
    return `<div class="wacht-chip ${klaar ? 'klaar' : ''}">
      <div class="dot"></div>${escH(l.naam.split(' ')[0])}
    </div>`;
  }).join('');
}

async function submitTest() {
  const err = document.getElementById('test-error');
  if (!testVerdachteId) { err.textContent = 'Kies wie de Mol is.'; err.style.display='block'; return; }
  err.style.display = 'none';

  try {
    await apiFetch('/api/mol/sessies/' + sessieId + '/test', {
      method: 'POST',
      body: JSON.stringify({
        leerling_id: speler.id,
        verdachte_id: testVerdachteId,
      }),
    });
    // Zet flag zodat poll het test-scherm niet opnieuw toont
    testIngediend = true;
    renderWachtTest(sessieState?.leerlingen || []);
    showScreen('screen-speler-wacht-test');
    startPoll(pollSpelerStatus, 3000);
  } catch(e) {
    err.textContent = e.message; err.style.display = 'block';
  }
}


// ── Navigatie-stub ──
function submitRondeAntwoord() { submitAntwoord(); }
