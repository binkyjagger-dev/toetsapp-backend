// TODO: confirm() vervangen door custom modal

async function laadLeerlingenTab() {
  // Toon loader direct — niet wachten
  const wrap = document.getElementById('ll-tabel-wrap');
  if (wrap) wrap.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);"><span class="spinner" style="border-top-color:var(--navy);display:inline-block;margin-right:8px;"></span>Leerlingen laden...</div>';
  await laadPeriodes();
  await laadKlassenEnFilters();
  await laadLeerlingen();
}

async function laadPeriodes() {
  try {
    const periodes = await apiFetch('/api/leerlingen/periodes');
    const sel = document.getElementById('ll-filter-periode');
    const huidig = sel.value;
    sel.innerHTML = '<option value="">— Alle periodes —</option>'
      + periodes.map(p => `<option value="${p}" ${p === huidig ? 'selected' : ''}>${p}</option>`).join('');
    // Stel default in op meest recent
    if (!huidig && periodes.length > 0) sel.value = periodes[0];
    // Update ook import-veld
    const impInp = document.getElementById('import-lesperiode');
    if (impInp && !impInp.value && periodes.length > 0) impInp.value = periodes[0];
  } catch(e) {}
}

async function laadKlassenFilter() {
  // Wordt nog aangeroepen via onchange — herlaad alleen klas-filter
  await laadKlassenEnFilters();
}

async function laadKlassenEnFilters() {
  try {
    const periode = document.getElementById('ll-filter-periode')?.value || '';
    const data = await apiFetch('/api/leerlingen/klassen' + (periode ? '?lesperiode=' + encodeURIComponent(periode) : ''));
    // Server geeft { klassen: [], leerjaren: [], niveaus: [] }
    // OF (als oud endpoint) gewoon een array
    const klassen  = Array.isArray(data) ? data : (data.klassen  || []);
    const niveaus  = Array.isArray(data) ? []   : (data.niveaus  || []);
    const leerjaren= Array.isArray(data) ? []   : (data.leerjaren|| []);

    // Vul klas-dropdown
    const klasSel = document.getElementById('ll-filter-klas');
    if (klasSel) {
      const huidigKlas = klasSel.value;
      klasSel.innerHTML = '<option value="">— Alle klassen —</option>'
        + klassen.map(k => `<option value="${k}" ${k === huidigKlas ? 'selected' : ''}>${k}</option>`).join('');
    }

    // Vul niveau-dropdown dynamisch als server niveaus geeft
    if (niveaus.length) {
      const nvSel = document.getElementById('ll-filter-niveau');
      if (nvSel) {
        const huidigNv = nvSel.value;
        nvSel.innerHTML = '<option value="">— Alle niveaus —</option>'
          + niveaus.map(n => `<option value="${n}" ${n === huidigNv ? 'selected' : ''}>${n}</option>`).join('');
      }
    }

    // Vul leerjaar-dropdown dynamisch als server leerjaren geeft
    if (leerjaren.length) {
      const ljSel = document.getElementById('ll-filter-leerjaar');
      if (ljSel) {
        const huidigLj = ljSel.value;
        ljSel.innerHTML = '<option value="">— Alle jaren —</option>'
          + leerjaren.map(j => `<option value="${j}" ${j === huidigLj ? 'selected' : ''}>${j}</option>`).join('');
      }
    }
  } catch(e) { console.error('laadKlassenEnFilters fout:', e); }
}

// Lees actieve pill-filters
function getActievePills(groep) {
  return [...document.querySelectorAll('#ll-filter-' + groep + '-pills .pill-filter.actief')]
    .map(el => el.dataset.val);
}

function togglePillFilter(el, groep) {
  el.classList.toggle('actief');
  laadLeerlingen();
}

async function laadLeerlingen() {
  const wrap    = document.getElementById('ll-tabel-wrap');
  const periode = document.getElementById('ll-filter-periode')?.value || '';
  const klas    = document.getElementById('ll-filter-klas')?.value    || '';
  const niveaus = getActievePills('niveau');
  const jaren   = getActievePills('leerjaar');

  if (wrap) wrap.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);"><span class="spinner" style="border-top-color:var(--navy);display:inline-block;margin-right:8px;"></span>Laden...</div>';

  // Bouw meerdere requests als meerdere niveaus/jaren geselecteerd
  const niveauLijst  = niveaus.length  ? niveaus  : [''];
  const jaarLijst    = jaren.length    ? jaren    : [''];

  const combis = [];
  for (const nv of niveauLijst) {
    for (const jr of jaarLijst) {
      const qs = new URLSearchParams();
      if (periode) qs.set('lesperiode', periode);
      if (klas)    qs.set('klas', klas);
      if (nv)      qs.set('leerniveau', nv);
      if (jr)      qs.set('leerjaar', jr);
      combis.push(qs.toString());
    }
  }

  try {
    // Parallel ophalen als meerdere combinaties
    const resultaten = await Promise.all(
      combis.map(q => apiFetch('/api/leerlingen' + (q ? '?' + q : '')))
    );
    // Dedup op id
    const gededup = new Map();
    resultaten.flat().forEach(l => gededup.set(l.id, l));
    alleLeerlingen = [...gededup.values()].sort((a,b) => a.achternaam.localeCompare(b.achternaam));
    renderLeerlingenTabel(alleLeerlingen);
  } catch(e) {
    if (wrap) wrap.innerHTML = '<p style="color:var(--red);font-size:0.82rem;">Laden mislukt: ' + e.message + '</p>';
  }
}

function filterLeerlingenLokaal() {
  const zoek = (document.getElementById('ll-zoek')?.value || '').toLowerCase();
  const gefilterd = zoek
    ? alleLeerlingen.filter(l =>
        (l.roepnaam + ' ' + (l.tussenvoegsel||'') + ' ' + l.achternaam).toLowerCase().includes(zoek)
        || (l.stamnummer||'').includes(zoek)
        || (l.klas||'').toLowerCase().includes(zoek))
    : alleLeerlingen;
  renderLeerlingenTabel(gefilterd);
}

function renderLeerlingenTabel(leerlingen) {
  const wrap = document.getElementById('ll-tabel-wrap');
  const count = document.getElementById('ll-count');
  if (count) count.textContent = leerlingen.length + ' leerlingen';
  if (!leerlingen.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>Geen leerlingen gevonden.</p></div>';
    return;
  }
  const rijen = leerlingen.map(l => {
    const naam = [l.roepnaam, l.tussenvoegsel, l.achternaam].filter(Boolean).join(' ');
    const safeId = (l.id || '').replace(/'/g, "\'");
    const safeNaam = naam.replace(/'/g, "\'");
    return `<tr>
      <td style="font-size:0.78rem;color:var(--muted);padding:0.55rem 0.5rem;">${l.stamnummer || '—'}</td>
      <td style="font-weight:600;padding:0.55rem 0.5rem;">${naam}</td>
      <td style="padding:0.55rem 0.5rem;">
        <span style="font-size:0.75rem;background:rgba(79,163,232,0.12);color:var(--blue);
          padding:0.1rem 0.4rem;border-radius:4px;">${l.klas || '—'}</span>
      </td>
      <td style="font-size:0.75rem;padding:0.55rem 0.5rem;">
        ${l.leerniveau ? `<span style="font-size:0.7rem;background:var(--navy-glow);color:var(--navy);
          padding:0.1rem 0.4rem;border-radius:4px;">${l.leerniveau}</span>` : '—'}
      </td>
      <td style="font-size:0.78rem;color:var(--muted);padding:0.55rem 0.5rem;">${l.leerjaar || '—'}</td>
      <td style="font-size:0.78rem;color:var(--muted);padding:0.55rem 0.5rem;">${l.lesperiode || '—'}</td>
      <td style="padding:0.55rem 0.5rem;text-align:right;">
        <button onclick="verwijderLeerling('${safeId}','${safeNaam}')"
          style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.8rem;
            padding:3px 6px;border-radius:4px;transition:all 0.12s;"
          onmouseover="this.style.color='var(--red)';this.style.background='rgba(192,57,43,0.08)'"
          onmouseout="this.style.color='var(--muted)';this.style.background='none'"
          title="Leerling verwijderen">✕</button>
      </td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:0.83rem;">
    <thead><tr style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);
      border-bottom:1.5px solid var(--border);">
      <th style="text-align:left;padding:0.4rem 0.5rem 0.6rem;font-weight:600;">Stamnr.</th>
      <th style="text-align:left;padding:0.4rem 0.5rem 0.6rem;font-weight:600;">Naam</th>
      <th style="text-align:left;padding:0.4rem 0.5rem 0.6rem;font-weight:600;">Klas</th>
      <th style="text-align:left;padding:0.4rem 0.5rem 0.6rem;font-weight:600;">Niveau</th>
      <th style="text-align:left;padding:0.4rem 0.5rem 0.6rem;font-weight:600;">Leerjaar</th>
      <th style="text-align:left;padding:0.4rem 0.5rem 0.6rem;font-weight:600;">Periode</th>
      <th style="padding:0.4rem 0.5rem 0.6rem;"></th>
    </tr></thead>
    <tbody>${rijen}</tbody>
  </table>`;
}

async function verwijderLeerling(id, naam) {
  if (!confirm('Leerling "' + naam + '" verwijderen uit het systeem? Dit kan niet ongedaan worden gemaakt.')) return;
  try {
    await apiFetch('/api/leerlingen/' + encodeURIComponent(id), { method: 'DELETE' });
    showToast('✓ ' + naam + ' verwijderd.');
    // Verwijder uit lokale array en herrender
    alleLeerlingen = alleLeerlingen.filter(l => l.id !== id);
    renderLeerlingenTabel(alleLeerlingen);
    const count = document.getElementById('ll-count');
    if (count) count.textContent = alleLeerlingen.length + ' leerlingen';
  } catch(e) {
    showToast('Verwijderen mislukt: ' + e.message);
  }
}

// ── XLSX Upload ───────────────────────────────────────────────
function handleXlsxUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb   = XLSX.read(data, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Zoek header-rij met 'Stamnummer' of 'Roepnaam'
      let headerIdx = raw.findIndex(row =>
        row.some(c => String(c).toLowerCase().includes('stamnummer') ||
                      String(c).toLowerCase().includes('roepnaam')));
      if (headerIdx === -1) headerIdx = 0;

      const headers = raw[headerIdx].map(h => String(h).trim().toLowerCase());
      const rijen   = raw.slice(headerIdx + 1).filter(r => r.some(c => c));

      const leerlingen = rijen.map(r => {
        const get = (...keys) => {
          for (const k of keys) {
            const i = headers.findIndex(h => h.includes(k));
            if (i !== -1 && r[i]) return String(r[i]).trim();
          }
          return '';
        };
        // Leerjaar uit studie (laatste cijfer)
        const studie    = get('studie');
        const leerjaar  = studie.match(/(\d)$/)?.[1] || '';
        const niveauMap = { 'AT': 'Atheneum', 'GY': 'Gymnasium', 'HA': 'HAVO' };
        const niveauCode = studie.match(/W-([A-Z]{2})\d/)?.[1] || '';
        const leerniveau = niveauMap[niveauCode] || '';
        return {
          stamnummer:    get('stamnummer'),
          roepnaam:      get('roepnaam'),
          tussenvoegsel: get('tussenvoegsel', 'tussen'),
          achternaam:    get('achternaam'),
          klas:          get('klas'),
          studie,
          leerjaar,
          email:         get('email'),
          telefoon:      get('telefoon', 'tel'),
          leerniveau,
        };
      }).filter(l => l.roepnaam || l.achternaam);

      // Detecteer lesperiode
      const periodeRij = raw.find(r => r.some(c => String(c).match(/\d{4}-\d{4}/)));
      const periodeVoorstel = periodeRij
        ? periodeRij.find(c => String(c).match(/\d{4}-\d{4}/))
        : new Date().getFullYear() + '-' + (new Date().getFullYear() + 1);

      xlsxImportData = { leerlingen, periodeVoorstel };

      // Toon preview
      const prev = document.getElementById('import-preview');
      const info = document.getElementById('import-preview-info');
      const perInp = document.getElementById('import-lesperiode');
      info.innerHTML = `<strong>${leerlingen.length}</strong> leerlingen gevonden · ` +
        `<strong>${[...new Set(leerlingen.map(l => l.klas).filter(Boolean))].length}</strong> klassen`;
      if (perInp && periodeVoorstel) perInp.value = periodeVoorstel;
      prev.style.display = 'block';
    } catch(ex) {
      showToast('Fout bij lezen bestand: ' + ex.message);
    }
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
}

async function bevestigImport() {
  const periode = document.getElementById('import-lesperiode').value.trim();
  const err     = document.getElementById('import-error');
  const btn     = document.getElementById('import-bevestig-btn');
  if (!periode) { err.textContent = 'Vul een lesperiode in.'; err.style.display='block'; return; }
  if (!xlsxImportData?.leerlingen?.length) return;
  err.style.display = 'none';
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Importeren...';
  try {
    const result = await apiFetch('/api/leerlingen/import', {
      method: 'POST',
      body: JSON.stringify({ lesperiode: periode, leerlingen: xlsxImportData.leerlingen }),
    });
    xlsxImportData = null;
    document.getElementById('import-preview').style.display = 'none';
    showToast(result.aantalImported + ' leerlingen geïmporteerd voor ' + periode + '!');
    await laadLeerlingenTab();
  } catch(e) {
    err.textContent = 'Importeren mislukt: ' + e.message;
    err.style.display = 'block';
  } finally {
    btn.disabled = false; btn.innerHTML = '✅ Importeren';
  }
}

function annuleerImport() {
  xlsxImportData = null;
  document.getElementById('import-preview').style.display = 'none';
}

async function verwijderPeriode() {
  const periode = document.getElementById('ll-filter-periode').value;
  if (!periode) { showToast('Kies eerst een lesperiode.'); return; }
  if (!confirm('Alle leerlingen van ' + periode + ' verwijderen?')) return;
  try {
    await apiFetch('/api/leerlingen/periode/' + encodeURIComponent(periode), { method: 'DELETE' });
    showToast('Lesperiode ' + periode + ' verwijderd.');
    await laadLeerlingenTab();
  } catch(e) { showToast('Verwijderen mislukt: ' + e.message); }
}
