// ── Analyse tab ─────────────────────────────────────────────

function vulAnalyseFilters() {
  const klasSel = document.getElementById('an-filter-klas');
  if (klasSel) {
    klasSel.innerHTML = '<option value="">Alle klassen</option>';
    (classesCache || []).forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.id;
      opt.textContent = k.name;
      klasSel.appendChild(opt);
    });
  }
}

function switchTab(tab) {
  if (tab === 'leerlingen') { laadLeerlingenTab(); }
  ['overzicht','lessen','klassen','leerlingen','analyse'].forEach(t => {
    document.getElementById('tab-content-' + t).style.display = t === tab ? 'block' : 'none';
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'klassen') loadClassesTab();
  if (tab === 'analyse') initAnalyseTab();
}


// ═══════════════════════════════════════════════════════════
//  ANALYSE-TAB
// ═══════════════════════════════════════════════════════════

async function initAnalyseTab() {
  document.getElementById('an-loading').style.display = 'block';
  document.getElementById('an-empty').style.display = 'none';
  document.getElementById('an-summary-row').style.display = 'none';
  document.getElementById('an-section-leerling').style.display = 'none';
  document.getElementById('an-section-klas').style.display = 'none';
  document.getElementById('an-section-hiaten').style.display = 'none';

  try {
    const [allResults, allLessons] = await Promise.all([
      apiFetch('/api/results'),
      apiFetch('/api/lessons')
    ]);
    analyseData = allResults.map(r => ({
      id:          r.id,
      studentName: r.student_name,
      lessonId:    r.lesson_id,
      lessonName:  r.lesson_name,
      classId:     r.class_id,
      className:   r.class_name,
      lesvorm:     r.lesvorm || 'socratisch',
      scoreNorm:   r.score_norm != null ? r.score_norm
                   : (r.scores && r.scores.length
                      ? r.scores.reduce((s,x) => s+(x.score||0), 0) / r.scores.length * 10
                      : null),
      timestamp:   r.timestamp,
    }));

    // Populeer filters
    const klassen  = [...new Set(analyseData.map(r => r.className).filter(Boolean))].sort();
    const lessen   = [...new Set(analyseData.map(r => r.lessonName).filter(Boolean))].sort();
    const lesvormen= [...new Set(analyseData.map(r => r.lesvorm).filter(Boolean))].sort();
    const leerlingen=[...new Set(analyseData.map(r => r.studentName).filter(Boolean))].sort();

    populeerSelect('an-filter-klas',     klassen,   'Alle klassen');
    populeerSelect('an-filter-les',      lessen,    'Alle lessen');
    populeerSelect('an-filter-lesvorm',  lesvormen, 'Alle lesvormen');
    populeerSelect('an-filter-leerling', leerlingen,'Alle leerlingen');

  } catch(e) {
    document.getElementById('an-loading').style.display = 'none';
    document.getElementById('an-empty').style.display = 'block';
    document.getElementById('an-empty').querySelector('p').textContent = 'Laden mislukt: ' + e.message;
    return;
  }
  document.getElementById('an-loading').style.display = 'none';
  runAnalyse();
}

function populeerSelect(id, values, allLabel) {
  const sel = document.getElementById(id);
  const cur = sel.value;
  sel.innerHTML = `<option value="">${allLabel}</option>`;
  values.forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    if (v === cur) o.selected = true;
    sel.appendChild(o);
  });
}

function getAnFilters() {
  return {
    klas:     document.getElementById('an-filter-klas').value,
    les:      document.getElementById('an-filter-les').value,
    lesvorm:  document.getElementById('an-filter-lesvorm').value,
    leerling: document.getElementById('an-filter-leerling').value,
  };
}

function filterAnalyseData(data, f) {
  return data.filter(r =>
    (!f.klas     || r.className   === f.klas)     &&
    (!f.les      || r.lessonName  === f.les)       &&
    (!f.lesvorm  || r.lesvorm     === f.lesvorm)   &&
    (!f.leerling || r.studentName === f.leerling)
  );
}

function scoreKleur(s) {
  if (s == null) return 'var(--muted)';
  if (s >= 70)   return '#22c55e';
  if (s >= 50)   return '#f59e0b';
  return '#ef4444';
}
function scoreKleurClass(s) {
  if (s == null) return 'hm-none';
  if (s >= 70)   return 'hm-high';
  if (s >= 50)   return 'hm-mid';
  return 'hm-low';
}

function runAnalyse() {
  if (!analyseData) return;
  const f    = getAnFilters();
  const data = filterAnalyseData(analyseData, f);

  // Verberg alles eerst
  ['an-summary-row','an-section-leerling','an-section-klas','an-section-hiaten']
    .forEach(id => document.getElementById(id).style.display = 'none');

  if (data.length === 0) {
    document.getElementById('an-empty').style.display = 'block';
    return;
  }
  document.getElementById('an-empty').style.display = 'none';

  // ── Samenvattingscijfers ──────────────────────────────────────────────
  const metScore = data.filter(r => r.scoreNorm != null);
  const gemScore = metScore.length
    ? Math.round(metScore.reduce((s,r) => s + r.scoreNorm, 0) / metScore.length)
    : null;
  const uniLeerlingen = new Set(data.map(r => r.studentName)).size;
  const uniLessen     = new Set(data.map(r => r.lessonName)).size;

  document.getElementById('an-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${data.length}</div>
      <div class="stat-label">Sessies</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${uniLeerlingen}</div>
      <div class="stat-label">Leerlingen</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${uniLessen}</div>
      <div class="stat-label">Lessen</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color:${scoreKleur(gemScore)}">${gemScore != null ? gemScore : '—'}</div>
      <div class="stat-label">Gem. score</div>
    </div>`;
  document.getElementById('an-summary-row').style.display = 'block';

  // ── A: Voortgang per leerling ─────────────────────────────────────────
  renderVoortgangLeerling(data, f);

  // ── B: Klasgemiddelden per les ────────────────────────────────────────
  renderKlasGemiddelden(data, f);

  // ── C: Hiatenkaart ───────────────────────────────────────────────────
  renderHiatenKaart(data, f);
}

// ── A: Voortgang per leerling ────────────────────────────────────────────────
function renderVoortgangLeerling(data, f) {
  const sec = document.getElementById('an-section-leerling');

  // Groepeer op leerling
  const byLeerling = {};
  data.forEach(r => {
    if (!byLeerling[r.studentName]) byLeerling[r.studentName] = [];
    byLeerling[r.studentName].push(r);
  });
  // Sorteer iedere leerling op tijd
  Object.values(byLeerling).forEach(arr => arr.sort((a,b) => a.timestamp - b.timestamp));

  const leerlingen = Object.keys(byLeerling).sort();
  const wrap = document.getElementById('an-leerling-chart');
  wrap.innerHTML = '';

  leerlingen.forEach(naam => {
    const sessies = byLeerling[naam];
    const scores  = sessies.map(s => s.scoreNorm);
    const metS    = scores.filter(s => s != null);
    const gem     = metS.length ? Math.round(metS.reduce((a,b) => a+b,0)/metS.length) : null;

    const row = document.createElement('div');
    row.className = 'an-leerling-row';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'an-leerling-naam';
    nameDiv.textContent = naam;
    nameDiv.title = naam;

    const sparkDiv = document.createElement('div');
    sparkDiv.className = 'an-sparkline';
    scores.forEach((s, i) => {
      const bar = document.createElement('div');
      bar.className = 'an-spark-bar';
      const h = s != null ? Math.max(4, Math.round((s/100)*32)) : 4;
      bar.style.height    = h + 'px';
      bar.style.background = scoreKleur(s);
      bar.style.opacity   = s == null ? '0.25' : '1';
      // Tooltip
      const les = sessies[i]?.lessonName || '';
      const lv  = sessies[i]?.lesvorm    || '';
      bar.title = `${les} (${lv}): ${s != null ? Math.round(s) : '—'}`;
      sparkDiv.appendChild(bar);
    });

    const avgDiv = document.createElement('div');
    avgDiv.className = 'an-avg-badge';
    avgDiv.style.color = scoreKleur(gem);
    avgDiv.textContent = gem != null ? gem : '—';

    row.appendChild(nameDiv);
    row.appendChild(sparkDiv);
    row.appendChild(avgDiv);
    wrap.appendChild(row);
  });

  sec.style.display = 'block';
}

// ── B: Klasgemiddelden per les ───────────────────────────────────────────────
function renderKlasGemiddelden(data, f) {
  const sec  = document.getElementById('an-section-klas');
  const wrap = document.getElementById('an-klas-chart');
  wrap.innerHTML = '';

  // Groepeer op les
  const byLes = {};
  data.forEach(r => {
    if (!byLes[r.lessonName]) byLes[r.lessonName] = [];
    byLes[r.lessonName].push(r);
  });

  const lessen = Object.keys(byLes).sort();
  lessen.forEach(les => {
    const sessies = byLes[les];
    const metS    = sessies.filter(r => r.scoreNorm != null);
    const gem     = metS.length
      ? Math.round(metS.reduce((s,r) => s+r.scoreNorm,0)/metS.length)
      : null;

    const row = document.createElement('div');
    row.className = 'an-bar-row';
    row.innerHTML = `
      <div class="an-bar-label" title="${les}">${les}</div>
      <div class="an-bar-track">
        <div class="an-bar-fill" style="width:${gem != null ? gem : 0}%;background:${gem != null ? `linear-gradient(90deg,${scoreKleur(gem)}99,${scoreKleur(gem)})` : 'none'}"></div>
      </div>
      <div class="an-bar-val" style="color:${scoreKleur(gem)}">${gem != null ? gem : '—'}</div>
      <div style="font-size:0.68rem;color:var(--muted);width:50px;text-align:right;">${sessies.length} sess.</div>`;
    wrap.appendChild(row);
  });

  sec.style.display = 'block';
}

// ── C: Hiatenkaart ───────────────────────────────────────────────────────────
function renderHiatenKaart(data, f) {
  const sec  = document.getElementById('an-section-hiaten');
  const wrap = document.getElementById('an-hiaten-wrap');

  const leerlingen = [...new Set(data.map(r => r.studentName))].sort();
  const lessen     = [...new Set(data.map(r => r.lessonName))].sort();

  // Bouw matrix: leerling → les → gemiddelde score
  const matrix = {};
  leerlingen.forEach(l => { matrix[l] = {}; });
  data.forEach(r => {
    if (r.scoreNorm == null) return;
    if (!matrix[r.studentName][r.lessonName]) {
      matrix[r.studentName][r.lessonName] = { sum: 0, count: 0 };
    }
    matrix[r.studentName][r.lessonName].sum   += r.scoreNorm;
    matrix[r.studentName][r.lessonName].count += 1;
  });

  // Max 20 lessen tonen voor leesbaarheid
  const lessenSlice = lessen.slice(0, 20);

  let tableHTML = '<table class="heatmap-table"><thead><tr>';
  tableHTML += '<th class="row-header">Leerling</th>';
  lessenSlice.forEach(les => {
    const kort = les.length > 14 ? les.substring(0,13) + '…' : les;
    tableHTML += `<th title="${les}">${kort}</th>`;
  });
  tableHTML += '</tr></thead><tbody>';

  leerlingen.forEach(leerling => {
    tableHTML += `<tr><td class="row-header">${leerling}</td>`;
    lessenSlice.forEach(les => {
      const cel = matrix[leerling][les];
      if (!cel) {
        tableHTML += `<td><span class="hm-cell hm-none" title="${leerling} — ${les}: geen data">·</span></td>`;
      } else {
        const gem = Math.round(cel.sum / cel.count);
        tableHTML += `<td><span class="hm-cell ${scoreKleurClass(gem)}" title="${leerling} — ${les}: ${gem}">${gem}</span></td>`;
      }
    });
    tableHTML += '</tr>';
  });

  tableHTML += '</tbody></table>';
  if (lessen.length > 20) {
    tableHTML += `<div style="font-size:0.72rem;color:var(--muted);margin-top:0.5rem;">Toont eerste 20 van ${lessen.length} lessen. Filter op les voor detail.</div>`;
  }
  wrap.innerHTML = tableHTML;
  sec.style.display = 'block';
}

// ═══════════════════════════════════════════════════════════
//  KLASBEHEER
// ═══════════════════════════════════════════════════════════


