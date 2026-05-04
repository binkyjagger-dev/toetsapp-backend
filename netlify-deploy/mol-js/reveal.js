function renderSpelerReveal(state, scoresArr) {
  scoresArr = scoresArr || [];
  const { sessie, leerlingen, cases, antwoorden, groepStemmen, testAntwoorden } = state;
  const mol          = leerlingen.find(l => l.is_mol);
  const isMol        = speler.is_mol;
  const heeftGeraden = testAntwoorden.find(a =>
    a.leerling_id === speler.id &&
    (a.verdachte_id === mol?.id || a.mol_verdachte_id === mol?.id)
  );
  const mijnTest = testAntwoorden.find(a => a.leerling_id === speler.id);

  // reveal-rol-tag bestaat alleen in de docent-view — null-safe
  const rolTagEl = document.getElementById('reveal-rol-tag');
  if (rolTagEl) {
    rolTagEl.className   = 'topbar-tag ' + (isMol ? 'tag-mol' : 'tag-speler');
    rolTagEl.textContent = isMol ? '\u{1F575}\uFE0F Mol' : '\u{1F393} Speler';
  }

  // Schrijf mol-naam direct naar bestaand DOM-element
  document.getElementById('reveal-mol-naam').textContent = mol?.naam || '?';

  // Eigen gok — korte samenvatting in #reveal-eigen-gok
  let eigenGokHtml = '';
  if (!isMol) {
    eigenGokHtml = `<span style="color:${heeftGeraden ? 'var(--green-l)' : 'var(--red-l)'};">${heeftGeraden ? '\u{1F389} Jij had de Mol geraden!' : '\u{1F605} Jij had de Mol niet geraden'}</span>`
      + `<div style="font-size:0.78rem;color:var(--text2);margin-top:0.25rem;">Jij verdacht: ${escH(leerlingen.find(l => l.id === (mijnTest?.verdachte_id || mijnTest?.mol_verdachte_id))?.naam || '?')}</div>`;
  } else {
    eigenGokHtml = '<span style="color:var(--red-l);">\u{1F575}\uFE0F Jij was de Mol</span>';
  }
  const eigenGokEl = document.getElementById('reveal-eigen-gok');
  if (eigenGokEl) eigenGokEl.innerHTML = eigenGokHtml;

  // Toon afsluitknop indien aanwezig
  const afsluiting = document.getElementById('reveal-afsluiting');
  if (afsluiting) afsluiting.style.display = 'block';

  renderEindstand(leerlingen, scoresArr);
}

function renderEindstand(leerlingen, scoresArr) {
  const container = document.getElementById('reveal-scores-lijst');
  if (!container) return;

  const mijnGroep = (leerlingen || []).filter(
    l => l.groep_id === speler.groep_id
  );
  const totaalMap = {};
  (scoresArr || []).forEach(s => {
    totaalMap[s.leerling_id] = s.totaal || 0;
  });

  const gesorteerd = mijnGroep
    .map(l => ({ ...l, punten: totaalMap[l.id] || 0 }))
    .sort((a, b) => b.punten - a.punten);

  container.innerHTML = gesorteerd.map((l, i) => {
    const positie = i === 0 ? '🥇' : `${i + 1}.`;
    const tag = l.is_mol
      ? '<span style="font-size:0.65rem;color:var(--red-l);font-weight:700;margin-left:0.4rem;">MOL</span>'
      : '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;
        padding:0.5rem 0;border-bottom:1px solid var(--border);">
      <span>${positie} ${escH(l.naam)}${tag}</span>
      <span style="font-family:'DM Mono',monospace;font-weight:700;">${l.punten} pt</span>
    </div>`;
  }).join('');
}

function bouwScoreOpbouw(score, isMol, nRondes) {
  if (!score) return '<p style="color:var(--muted);font-size:0.8rem;">Scores worden berekend...</p>';
  const opbouw = score.opbouw || {};
  const rijen = [];

  if (!isMol) {
    for (let r = 1; r <= nRondes; r++) {
      const ind  = opbouw['ronde_' + r + '_individueel'];
      const groep = opbouw['ronde_' + r + '_groep'];
      if (ind !== undefined) rijen.push({ label: `Ronde ${r} — individueel antwoord`, val: ind });
      if (groep !== undefined) rijen.push({ label: `Ronde ${r} — groepsantwoord`, val: groep });
    }
    const molPt = opbouw['mol_geraden'];
    if (molPt !== undefined) rijen.push({ label: 'Mol correct geraden', val: molPt });
  } else {
    for (let r = 1; r <= nRondes; r++) {
      const ind = opbouw['ronde_' + r + '_individueel'];
      if (ind !== undefined) rijen.push({ label: `Ronde ${r} — individueel antwoord`, val: ind });
    }
    const rol = opbouw['mol_rolbonus'];
    if (rol !== undefined) rijen.push({ label: 'Mol-rolbonus', val: rol });
    for (let r = 1; r <= nRondes; r++) {
      const sab = opbouw['ronde_' + r + '_sabotage'];
      if (sab !== undefined) rijen.push({ label: `Ronde ${r} — sabotage geslaagd`, val: sab });
    }
    const ontm = opbouw['niet_ontmaskerd'];
    if (ontm !== undefined) rijen.push({ label: 'Niet ontmaskerd', val: ontm });
  }

  const html = rijen.map(r => {
    const cls = r.val > 0 ? 'pos' : r.val < 0 ? 'neg' : 'nul';
    return `<div class="score-opbouw-rij">
      <span class="score-opbouw-label">${escH(r.label)}</span>
      <span class="score-opbouw-val ${cls}">${r.val > 0 ? '+' : ''}${r.val} pt</span>
    </div>`;
  }).join('');

  const pct = Math.min(100, Math.round((score.totaal / 100) * 100));
  const kleur = pct >= 70 ? 'var(--green-l)' : pct >= 40 ? 'var(--gold-l)' : 'var(--red-l)';

  return `
    <div class="score-totaal-balk">
      <div class="score-totaal-label">
        <span class="score-totaal-naam">Jouw totaalscore</span>
        <span class="score-totaal-num" style="color:${kleur};">${score.totaal} pt</span>
      </div>
      <div class="score-track">
        <div class="score-fill" style="width:${pct}%;background:${kleur};"></div>
      </div>
    </div>
    <div style="margin-top:0.75rem;">${html}</div>`;
}


// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);

  if (params.get('rol') === 'speler') {
    showScreen('screen-speler-login');
    return;
  }

  // Lees JWT-token uit URL (gezet door index.html) of localStorage
  docentToken = params.get('leraar') ? decodeURIComponent(params.get('leraar'))
    : localStorage.getItem('leraar_token') || localStorage.getItem('mol_docent_token') || 'leraar123';
  if (params.get('leraar')) {
    localStorage.setItem('mol_docent_token', docentToken);
  }

  // klas_id + klas_naam vanuit index.html
  const voorafKlasId   = params.get('klas_id')   ? decodeURIComponent(params.get('klas_id'))   : '';
  const voorafKlasNaam = params.get('klas_naam')  ? decodeURIComponent(params.get('klas_naam')) : '';

  // open_sessie: ga direct naar resultaten van een sessie
  const openSessieId = params.get('open_sessie');

  // Verwerk URL-params voor directe koppeling vanuit leerplatform
  const lesNaamParam    = params.get('les_naam')    ? decodeURIComponent(params.get('les_naam'))    : '';
  const lesContentParam = params.get('les_content') ? decodeURIComponent(params.get('les_content')) : '';
  const directSetup     = params.get('direct_setup') === '1';

  if (directSetup && lesNaamParam) {
    // Direct naar setup met les al ingevuld
    showScreen('screen-sessie-stap1');
    setTimeout(() => {
      const naamEl    = document.getElementById('setup-les-naam');
      const contentEl = document.getElementById('setup-les-content');
      if (naamEl)    naamEl.value    = lesNaamParam;
      if (contentEl) contentEl.value = lesContentParam;
      // Toon badge
      const preview = document.getElementById('les-kiezer-preview');
      if (preview) {
        preview.textContent = '✓ Gekoppeld vanuit leerplatform: ' + lesNaamParam;
        preview.style.display = 'block';
      }
    }, 200);
    // Laad ook les-lijst op de achtergrond voor dropdown
    laadMolLessenDropdown();
  } else {
    showScreen('screen-sessie-lijst');
    await laadSessieLijst();
    // Laad les-dropdown op de achtergrond
    laadMolLessenDropdown();
  }

  if (openSessieId) {
    // Open direct de resultaten voor deze sessie
    setTimeout(() => toonResultaten(openSessieId), 400);
  }

  if (voorafKlasId || voorafKlasNaam) {
    setTimeout(() => {
      const klasIdIn   = document.getElementById('setup-klas-id');
      const klasNaamIn = document.getElementById('setup-klas-naam');
      if (klasIdIn)   klasIdIn.value   = voorafKlasId;
      if (klasNaamIn) klasNaamIn.value = voorafKlasNaam;
      // Toon klas-badge in setup-scherm
      if (voorafKlasNaam) {
        const badge = document.createElement('div');
        badge.style.cssText = 'margin-bottom:0.75rem;padding:6px 12px;background:rgba(200,169,81,0.1);border:1px solid rgba(200,169,81,0.3);border-radius:7px;font-size:0.78rem;color:var(--gold);display:inline-flex;align-items:center;gap:6px;';
        badge.innerHTML = '🏫 Gestart vanuit klas <strong>' + voorafKlasNaam + '</strong>';
        const setupErr = document.getElementById('setup-error');
        if (setupErr) setupErr.parentNode.insertBefore(badge, setupErr);
      }
    }, 400);
  }
});

function renderResultaten(data) {
  const { sessie, leerlingen, groepen, cases, antwoorden, groepStemmen, testAntwoorden, scores } = data;
  document.getElementById('resultaten-loading').style.display = 'none';
  const div = document.getElementById('resultaten-content');
  div.style.display = 'block';
  const datum = sessie.created_at
    ? new Date(sessie.created_at).toLocaleDateString('nl-NL', {day:'numeric',month:'long',year:'numeric'}) : '—';
  let html = `<div class="page-eyebrow">Archief</div>
    <h2 class="page-title">${escH(sessie.les_naam || 'Sessie')}</h2>
    <p class="page-sub">${datum} · ${sessie.n_rondes} rondes · ${leerlingen.length} leerlingen</p>
    <div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.18em;color:var(--gold);margin-bottom:0.85rem;display:flex;align-items:center;gap:0.5rem;">Groepsresultaten <span style="flex:1;height:1px;background:var(--border);"></span></div>`;
  groepen.forEach(g => {
    const leden=leerlingen.filter(l=>l.groep_id===g.id), mol=leden.find(l=>l.is_mol);
    const stammen=groepStemmen.filter(s=>s.groep_id===g.id);
    const potTotaal=stammen.reduce((s,x)=>s+(x.punten||0),0), maxTotaal=stammen.reduce((s,x)=>s+(x.max_punten||10),0);
    const pct=maxTotaal>0?Math.round(potTotaal/maxTotaal*100):0;
    const pctKleur=pct>=70?'var(--green-l)':pct>=40?'var(--gold-l)':'var(--red-l)';
    html+=`<div class="res-groep-blok"><div class="res-groep-header"><span class="res-groep-naam">${escH(g.naam)}</span><span style="font-size:0.8rem;font-family:'DM Mono',monospace;font-weight:700;color:${pctKleur};">${potTotaal}/${maxTotaal} pt (${pct}%)</span></div>`;
    html+=leden.map(l=>{
      const test = testAntwoorden.find(t => t.leerling_id === l.id);
      const heeftGeraden = test && mol &&
        (test.verdachte_id === mol.id || test.mol_verdachte_id === mol.id);
      return `<div class="res-leerling-rij"><span class="res-leerling-naam">${escH(l.naam)}${l.is_mol?' <span class="res-mol-tag">🕵️ Mol</span>':''}</span>${!l.is_mol?`<span class="${heeftGeraden?'res-mol-correct':'res-mol-fout'}">${heeftGeraden?'✓ Mol geraden':'✗ Mol gemist'}</span>`:'<span style="font-size:0.72rem;color:var(--muted);">saboteur</span>'}${test&&test.mol_argument?`<span class="res-arg-tekst" title="${escH(test.mol_argument)}">"${escH(test.mol_argument.substring(0,60))}${test.mol_argument.length>60?'…':''}"</span>`:''}</div>`;
    }).join('');
    html+='</div>';
  });
  html+=`<div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.18em;color:var(--blue);margin:1.25rem 0 0.85rem;display:flex;align-items:center;gap:0.5rem;">Rondes <span style="flex:1;height:1px;background:var(--border);"></span></div>`;
  cases.forEach(c=>{
    const stammen=groepStemmen.filter(s=>s.ronde_nr===c.ronde_nr);
    html+=`<div class="card" style="margin-bottom:0.65rem;"><div class="res-ronde-titel">Ronde ${c.ronde_nr}</div><div style="font-weight:700;font-size:0.88rem;margin-bottom:0.65rem;">${escH(c.vraag)}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:0.65rem;margin-bottom:0.75rem;"><div><div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--green);margin-bottom:0.25rem;">✅ Correct</div><div style="font-size:0.77rem;color:var(--green-l);line-height:1.5;">${escH(c.correct_uitleg)}</div></div><div><div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--red);margin-bottom:0.25rem;">🕵️ Mol-argument</div><div style="font-size:0.77rem;color:var(--red-l);line-height:1.5;">${escH(c.fout_uitleg)}</div></div></div><div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);margin-bottom:0.35rem;">Groepsscores</div>${stammen.map(st=>{const g=groepen.find(x=>x.id===st.groep_id);const kleur=(st.punten||0)>=7?'var(--green-l)':(st.punten||0)>=4?'var(--gold-l)':'var(--red-l)';return `<div class="res-score-row"><span class="res-score-label">${escH(g?.naam||'?')}</span><span class="res-score-val" style="color:${kleur};">${st.punten??'—'} pt</span></div>`;}).join('')}</div>`;
  });
  div.innerHTML=html;
}


