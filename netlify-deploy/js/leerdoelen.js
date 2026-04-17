// TODO: confirm() vervangen door custom modal




// ════════════════════════════════════════════════════════════
//  LEERDOELEN MODULE
// ════════════════════════════════════════════════════════════

// ── Laden ──────────────────────────────────────────────────
async function laadLeerdoelenTab() {
  const wrap = document.getElementById('ld-tabel-wrap');
  if (wrap) wrap.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);"><span class="spinner" style="border-top-color:var(--navy);display:inline-block;margin-right:8px;"></span>Leerdoelen laden...</div>';
  try {
    alleLeerdoelen = await apiFetch('/api/leerdoelen');
    vulLdFilterDropdowns(alleLeerdoelen);
    renderLeerdoelenTabel(alleLeerdoelen);
  } catch(e) {
    if (wrap) wrap.innerHTML = '<p style="color:var(--red);font-size:0.85rem;">Laden mislukt: ' + e.message + '</p>';
  }
}

function vulLdFilterDropdowns(ld) {
  // Lesbrief dropdown
  const lesbrieven = [...new Set(ld.map(l => l.lesbrief).filter(Boolean))].sort();
  const lbSel = document.getElementById('ld-filter-lesbrief');
  if (lbSel) {
    const huidig = lbSel.value;
    lbSel.innerHTML = '<option value="">— Alle lesbrieven —</option>'
      + lesbrieven.map(lb => `<option value="${lb}" ${lb === huidig ? 'selected' : ''}>${lb}</option>`).join('');
  }
  // Hoofdstuk dropdown (leeg — wordt gevuld na lesbrief-keuze)
  vulHoofdstukDropdown(lbSel?.value || '');
}

function vulHoofdstukDropdown(lesbrief) {
  const bron = lesbrief
    ? alleLeerdoelen.filter(l => l.lesbrief === lesbrief)
    : alleLeerdoelen;
  const hoofdstukken = [...new Set(bron.map(l => l.hoofdstuk).filter(Boolean))].sort((a, b) => {
    // Sorteer: H1, H2, ... voor leesbaar overzicht
    const n1 = parseInt(a.replace(/\D/g, '')) || 0;
    const n2 = parseInt(b.replace(/\D/g, '')) || 0;
    return n1 !== n2 ? n1 - n2 : a.localeCompare(b);
  });
  const hfstSel = document.getElementById('ld-filter-hoofdstuk');
  if (hfstSel) {
    const huidig = hfstSel.value;
    hfstSel.innerHTML = '<option value="">— Alle hfst. —</option>'
      + hoofdstukken.map(h => `<option value="${h}" ${h === huidig ? 'selected' : ''}>${h}</option>`).join('');
  }
}

function onLdLesbriefFilter() {
  // Herlaad hoofdstuk-dropdown op basis van gekozen lesbrief, dan filter
  const lb = document.getElementById('ld-filter-lesbrief')?.value || '';
  vulHoofdstukDropdown(lb);
  filterLeerdoelen();
}

// ── Renderen ───────────────────────────────────────────────
function renderLeerdoelenTabel(ld) {
  const wrap  = document.getElementById('ld-tabel-wrap');
  const count = document.getElementById('ld-count');
  if (count) count.textContent = ld.length + ' leerdoelen';
  if (!ld.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">🎯</div><p>Geen leerdoelen gevonden.</p></div>';
    return;
  }
  const rijen = ld.map(l => {
    const safeId = (l.id || '').replace(/'/g, "\'");
    return `<tr>
      <td><span class="ld-badge ld-badge-niveau">${l.niveau || '—'}</span></td>
      <td style="font-size:0.78rem;color:var(--muted);">${l.lesbrief || '—'}</td>
      <td style="font-size:0.78rem;color:var(--muted);">${l.hoofdstuk || '—'}</td>
      <td><span class="ld-badge ld-badge-${l.type || 'kennen'}">${l.type || '—'}</span></td>
      <td style="max-width:340px;line-height:1.4;">${l.lesdoel || '—'}</td>
      <td style="white-space:nowrap;">
        <button class="ld-actie-btn" onclick="openLdModal('${safeId}')" title="Bewerken">✏</button>
        <button class="ld-actie-btn del" onclick="verwijderLeerdoel('${safeId}')" title="Verwijderen">🗑</button>
      </td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<div style="overflow-x:auto;">
    <table class="ld-tabel">
      <thead><tr>
        <th>Niveau</th><th>Lesbrief</th><th>Hoofdstuk</th><th>Type</th>
        <th>Lesdoel</th><th></th>
      </tr></thead>
      <tbody>${rijen}</tbody>
    </table>
  </div>`;
}

// ── Filteren ───────────────────────────────────────────────
function filterLeerdoelen() {
  const zoek      = (document.getElementById('ld-zoek')?.value || '').toLowerCase();
  const niveau    = document.getElementById('ld-filter-niveau')?.value    || '';
  const lesbrief  = document.getElementById('ld-filter-lesbrief')?.value  || '';
  const hoofdstuk = document.getElementById('ld-filter-hoofdstuk')?.value || '';
  const type      = document.getElementById('ld-filter-type')?.value      || '';
  const gefilterd = alleLeerdoelen.filter(l => {
    const matchZoek      = !zoek      || (l.lesdoel + ' ' + l.lesbrief + ' ' + l.hoofdstuk).toLowerCase().includes(zoek);
    const matchNiveau    = !niveau    || (l.niveau    || '') === niveau;
    const matchLesbrief  = !lesbrief  || (l.lesbrief  || '') === lesbrief;
    const matchHoofdstuk = !hoofdstuk || (l.hoofdstuk || '') === hoofdstuk;
    const matchType      = !type      || (l.type      || '') === type;
    return matchZoek && matchNiveau && matchLesbrief && matchHoofdstuk && matchType;
  });
  const count = document.getElementById('ld-count');
  if (count) count.textContent = gefilterd.length + ' leerdoelen';
  renderLeerdoelenTabel(gefilterd);
}

// ── Modal: open / opslaan ──────────────────────────────────
function openLdModal(id) {
  const ld = id ? alleLeerdoelen.find(l => l.id === id) : null;
  document.getElementById('ld-modal-titel').textContent = ld ? 'Leerdoel bewerken' : 'Leerdoel toevoegen';
  document.getElementById('ld-edit-id').value   = ld?.id    || '';
  document.getElementById('ld-niveau').value    = ld?.niveau || '';
  document.getElementById('ld-type').value      = ld?.type  || '';
  document.getElementById('ld-lesbrief').value  = ld?.lesbrief  || '';
  document.getElementById('ld-hoofdstuk').value = ld?.hoofdstuk || '';
  document.getElementById('ld-lesdoel').value   = ld?.lesdoel   || '';
  document.getElementById('ld-modal-error').style.display = 'none';
  openModal('modal-leerdoel');
}

async function slaLeerdoelOp() {
  const id       = document.getElementById('ld-edit-id').value;
  const niveau   = document.getElementById('ld-niveau').value;
  const type     = document.getElementById('ld-type').value;
  const lesbrief = document.getElementById('ld-lesbrief').value.trim();
  const hoofdstuk= document.getElementById('ld-hoofdstuk').value.trim();
  const lesdoel  = document.getElementById('ld-lesdoel').value.trim();
  const errEl    = document.getElementById('ld-modal-error');
  if (!niveau || !type || !lesdoel) {
    errEl.textContent = 'Niveau, type en lesdoel zijn verplicht.';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  const body = { niveau, type, lesbrief, hoofdstuk, lesdoel };
  try {
    if (id) {
      await apiFetch('/api/leerdoelen/' + id, { method: 'PATCH', body: JSON.stringify(body) });
      alleLeerdoelen = alleLeerdoelen.map(l => l.id === id ? { ...l, ...body } : l);
    } else {
      const nieuw = await apiFetch('/api/leerdoelen', { method: 'POST', body: JSON.stringify(body) });
      alleLeerdoelen = [...alleLeerdoelen, nieuw];
    }
    closeModal('modal-leerdoel');
    renderLeerdoelenTabel(alleLeerdoelen);
    showToast('✓ Leerdoel ' + (id ? 'bijgewerkt' : 'toegevoegd') + '.');
  } catch(e) { errEl.textContent = 'Opslaan mislukt: ' + e.message; errEl.style.display = 'block'; }
}

// ── Verwijderen ────────────────────────────────────────────
async function verwijderLeerdoel(id) {
  const ld = alleLeerdoelen.find(l => l.id === id);
  if (!confirm('Leerdoel "' + (ld?.lesdoel?.slice(0, 60) || id) + '..." verwijderen?')) return;
  try {
    await apiFetch('/api/leerdoelen/' + id, { method: 'DELETE' });
    alleLeerdoelen = alleLeerdoelen.filter(l => l.id !== id);
    renderLeerdoelenTabel(alleLeerdoelen);
    showToast('Leerdoel verwijderd.');
  } catch(e) { showToast('Verwijderen mislukt: ' + e.message); }
}

// ── Excel import ───────────────────────────────────────────
function importeerLeerdoelenXlsx(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb  = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      // header:1 geeft arrays zodat we kolomnamen zelf kunnen lezen
      const rawArr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rawArr.length < 2) { showToast('Bestand is leeg of heeft geen data.'); return; }

      // Zoek header-rij (eerste rij met herkenbare kolomnamen)
      const norm = s => String(s).toLowerCase().trim()
        .replace(/[^a-z0-9]/g, '');

      const headers = rawArr[0].map(norm);

      // Vind kolomindices flexibel
      const idx = {
        niveau:    headers.findIndex(h => h.includes('niveau')),
        lesbrief:  headers.findIndex(h => h.includes('lesbrief')),
        hoofdstuk: headers.findIndex(h => h.includes('hoofdstuk')),
        // Kennen/Kunnen indicator kolom (bijv. "Kennen/Kunnen" of "Type")
        type:      headers.findIndex(h => h.includes('kennenkun') || h.includes('type') || (h.includes('kennen') && h.includes('kun'))),
        // Lesdoel kolom (bijv. "Lesdoel", "Omschrijving", "Doel")
        lesdoel:   headers.findIndex(h => h.includes('lesdoel') || h.includes('omschrijving') || (h.includes('doel') && !h.includes('leerdoel'))),
        // Aparte Kennen-kolom
        kennen:    headers.findIndex(h => h === 'kennen'),
        // Aparte Kunnen-kolom
        kunnen:    headers.findIndex(h => h === 'kunnen'),
      };

      const rijen = [];

      // ── Formaat A: aparte Kennen + Kunnen kolommen ───────
      // (structuur uit leerdoelen_v2.xlsx: Niveau | Lesbrief | Hoofdstuk | Kennen | Kunnen)
      if (idx.kennen >= 0 || idx.kunnen >= 0) {
        for (let i = 1; i < rawArr.length; i++) {
          const r = rawArr[i];
          const niveau    = String(r[idx.niveau]    ?? '').trim();
          const lesbrief  = String(r[idx.lesbrief]  ?? '').trim();
          const hoofdstuk = String(r[idx.hoofdstuk] ?? '').trim();
          if (idx.kennen >= 0) {
            const tekst = String(r[idx.kennen] ?? '').trim();
            if (tekst) rijen.push({ niveau, lesbrief, hoofdstuk, type: 'kennen', lesdoel: tekst });
          }
          if (idx.kunnen >= 0) {
            const tekst = String(r[idx.kunnen] ?? '').trim();
            if (tekst) rijen.push({ niveau, lesbrief, hoofdstuk, type: 'kunnen', lesdoel: tekst });
          }
        }
      }
      // ── Formaat B: één Lesdoel kolom + Type/Kennen/Kunnen indicator ──
      else if (idx.lesdoel >= 0) {
        for (let i = 1; i < rawArr.length; i++) {
          const r = rawArr[i];
          const lesdoel = String(r[idx.lesdoel] ?? '').trim();
          if (!lesdoel) continue;
          const rawType = String(r[idx.type] ?? '').toLowerCase();
          const type    = rawType.includes('kun') ? 'kunnen' : 'kennen';
          rijen.push({
            niveau:    String(r[idx.niveau]    ?? '').trim(),
            lesbrief:  String(r[idx.lesbrief]  ?? '').trim(),
            hoofdstuk: String(r[idx.hoofdstuk] ?? '').trim(),
            type,
            lesdoel,
          });
        }
      }
      else {
        // Toon debug-info zodat we kunnen zien welke kolommen gevonden zijn
        showToast('Kolommen herkend: ' + rawArr[0].join(', ') + '. Verwacht: Niveau, Lesbrief, Hoofdstuk, Kennen, Kunnen (of Lesdoel + Type).');
        return;
      }

      if (!rijen.length) {
        showToast('Geen geldige leerdoelen gevonden. Controleer of de kolommen Kennen en/of Kunnen gevuld zijn.');
        return;
      }

      ldImportBuffer = rijen;
      document.getElementById('ld-import-info').textContent =
        rijen.length + ' leerdoelen gevonden in ' +
        rijen.filter(r => r.type === 'kennen').length + ' kennen + ' +
        rijen.filter(r => r.type === 'kunnen').length + ' kunnen. Klik op Importeren om te bevestigen.';
      document.getElementById('ld-import-error').style.display = 'none';
      document.getElementById('ld-import-preview').style.display = 'block';

    } catch(err) {
      showToast('Fout bij lezen bestand: ' + err.message);
      console.error('Leerdoelen import fout:', err);
    }
  };
  reader.readAsArrayBuffer(file);
}

async function bevestigLdImport() {
  if (!ldImportBuffer.length) return;
  const btn = document.querySelector('#ld-import-preview .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Importeren...'; }
  try {
    const result = await apiFetch('/api/leerdoelen/import', {
      method: 'POST',
      body: JSON.stringify({ leerdoelen: ldImportBuffer }),
    });
    annuleerLdImport();
    showToast('✓ ' + (result.aangemaakt || ldImportBuffer.length) + ' leerdoelen geïmporteerd.');
    ldImportBuffer = [];
    await laadLeerdoelenTab();
  } catch(e) {
    document.getElementById('ld-import-error').textContent = 'Import mislukt: ' + e.message;
    document.getElementById('ld-import-error').style.display = 'block';
    if (btn) { btn.disabled = false; btn.textContent = '✅ Importeren'; }
  }
}

function annuleerLdImport() {
  ldImportBuffer = [];
  document.getElementById('ld-import-preview').style.display = 'none';
}

