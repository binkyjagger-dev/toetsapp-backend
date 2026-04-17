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
