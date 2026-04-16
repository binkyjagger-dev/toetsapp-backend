// TODO: confirm() vervangen door custom modal

// ── Klasactiviteiten ────────────────────────────────────────
async function renderKlasActiviteiten(klas, wrap) {
  // Lessen voor deze klas
  const klasLessen = (lessonsCache || []).filter(l => (l.class_ids || []).includes(klas?.id));

  // Mol-sessies voor deze klas ophalen
  let molSessies = [];
  try {
    const alle = await apiFetch('/api/mol/sessies?docent_token=' + encodeURIComponent(docentToken || 'leraar123'));
    molSessies = (Array.isArray(alle) ? alle : []).filter(s => s.klas_id === klas?.id || s.klas_naam === klas?.name);
  } catch(e) { /* geen mol-sessies beschikbaar */ }

  // Sorteer alle activiteiten op datum (nieuwste eerst)
  const activiteiten = [
    ...klasLessen.map(l => ({ type: 'socratisch', id: l.id, naam: l.name, datum: l.lesson_date || l.created_at, status: 'klaar', data: l })),
    ...molSessies.map(s => ({ type: 'mol', id: s.id, naam: s.les_naam, datum: s.created_at, status: s.status, data: s })),
  ].sort((a, b) => (b.datum || 0) - (a.datum || 0));

  // Beschikbare lessen: nog niet aan deze klas gekoppeld
  const beschikbareLessen = (lessonsCache || []).filter(l => !(l.class_ids || []).includes(klas?.id));

  let html = `<div style="margin-bottom:1rem;">
    <button class="btn btn-ghost-navy btn-sm" onclick="document.getElementById('plan-form-${klas?.id}').style.display=
      document.getElementById('plan-form-${klas?.id}').style.display==='none'?'block':'none'">
      + Les toevoegen
    </button>
    <div id="plan-form-${klas?.id}" style="display:none;margin-top:10px;background:#fff;border:1.5px solid var(--border);
      border-radius:10px;padding:1rem;">
      <label style="font-size:0.78rem;font-weight:600;color:var(--text2);">Les</label>
      <select id="plan-les-${klas?.id}" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;
        margin:4px 0 10px;font-size:0.85rem;">
        ${beschikbareLessen.length
          ? beschikbareLessen.map(l => '<option value="' + l.id + '">' + l.name + '</option>').join('')
          : '<option disabled>Geen beschikbare lessen</option>'}
      </select>
      <label style="font-size:0.78rem;font-weight:600;color:var(--text2);">Datum</label>
      <input type="date" id="plan-datum-${klas?.id}" style="width:100%;padding:6px 8px;border:1px solid var(--border);
        border-radius:6px;margin:4px 0 10px;font-size:0.85rem;">
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn btn-primary btn-sm" onclick="planLesOpslaan('${klas?.id}')">Opslaan</button>
        <span id="plan-status-${klas?.id}" style="font-size:0.78rem;color:var(--green);"></span>
      </div>
    </div>
  </div>`;

  if (activiteiten.length === 0) {
    html += `<div class="empty-state" style="padding:2rem 0;">
      <div class="empty-icon">📋</div>
      <p>Nog geen lesactiviteiten. Start hieronder de eerste activiteit.</p>
    </div>`;
  } else {
    html += '<div class="act-lijst">';
    activiteiten.forEach(act => {
      const isMol = act.type === 'mol';
      const statusLabel = isMol
        ? ({ 'wachten':'Wachten', 'actief':'Actief', 'klaar':'Klaar', 'reveal':'Onthulling' }[act.status] || act.status)
        : 'Klaar';
      const statusCls = (act.status === 'actief') ? 'status-actief' : 'status-klaar';
      const datumStr = act.datum ? new Date(act.datum).toLocaleDateString('nl-NL', {day:'numeric',month:'short'}) : '';
      const resultatenLink = isMol
        ? `onclick="bekijkMolResultaten('${act.id}')" style="cursor:pointer;"`
        : `onclick="openLesResultaten('${act.id}')" style="cursor:pointer;"`;
      const safeActId = (act.id || '').replace(/'/g, "\\'");
      const safeKlasId = (klas?.id || '').replace(/'/g, "\\'");
      html += `<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:8px;">
        <div class="act-kaart" ${resultatenLink} style="border:none;margin:0;">
          <div class="act-icon ${isMol ? 'act-icon-mol' : 'act-icon-socratisch'}">${isMol ? '🕵️' : '💬'}</div>
          <div class="act-info">
            <div class="act-naam">${act.naam || '—'}</div>
            <div class="act-meta">${isMol ? 'Wie is de Mol' : 'Socratische toets'} · ${datumStr}
              ${!isMol ? `<span style="font-family:'DM Mono',monospace;font-size:0.68rem;color:var(--navy);
                background:var(--navy-glow);padding:1px 5px;border-radius:3px;margin-left:4px;">
                code: ${getLesCode(act.id)}</span>` : ''}
            </div>
          </div>
          <div class="act-status ${statusCls}">${statusLabel}</div>
        </div>
        ${!isMol ? `<div style="padding:0 12px 10px;border-top:1px solid var(--border);">
          <button class="btn btn-ghost-navy btn-sm" style="margin-top:8px;font-size:0.75rem;"
            onclick="event.stopPropagation();var s=document.getElementById('fb-${safeActId}');s.style.display=s.style.display==='none'?'block':'none'">
            Reflectie
          </button>
          <div id="fb-${safeActId}" style="display:none;margin-top:8px;">
            <textarea id="fb-text-${safeActId}" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);
              border-radius:6px;font-size:0.82rem;font-family:inherit;resize:vertical;"
              onclick="event.stopPropagation()">${act.data?.feedback || ''}</textarea>
            <div style="display:flex;gap:8px;align-items:center;margin-top:6px;">
              <button class="btn btn-primary btn-sm" style="font-size:0.75rem;"
                onclick="event.stopPropagation();saveFeedback('${safeActId}','${safeKlasId}')">Opslaan</button>
              <span id="fb-status-${safeActId}" style="font-size:0.75rem;color:var(--green);"></span>
            </div>
          </div>
        </div>` : ''}
      </div>`;
    });
    html += '</div>';
  }

  html += `<div style="margin-top:12px;">
    <button class="nieuwe-act-btn" onclick="toggleActDropdown()">
      <span style="font-size:18px;color:var(--navy);">+</span>
      Nieuwe lesactiviteit starten
      <span style="margin-left:auto;font-size:11px;color:var(--muted);">▾</span>
    </button>
    <div class="act-dropdown" id="act-dropdown">
      <div class="act-dropdown-item" onclick="openCreateLessonVoorKlas('${klas?.id}')">
        <span class="act-dropdown-item-icon">💬</span>
        <div><div class="act-dropdown-label">Socratische reflectie</div>
          <div class="act-dropdown-sub">Leerling-gestuurde reflectie op een les</div></div>
      </div>
      <div class="act-dropdown-item" onclick="openMolAppVoorKlas('${klas?.id}','${klas?.name}')">
        <span class="act-dropdown-item-icon">🕵️</span>
        <div><div class="act-dropdown-label">Wie is de Mol?</div>
          <div class="act-dropdown-sub">Groepsactiviteit met kennistoepassing</div></div>
      </div>
      <div class="act-dropdown-item soon">
        <span class="act-dropdown-item-icon" style="opacity:0.4;">✦</span>
        <div><div class="act-dropdown-label" style="color:var(--muted);">Toets aanmaken</div>
          <div class="act-dropdown-sub">Binnenkort beschikbaar</div></div>
      </div>
    </div>
  </div>`;
  wrap.innerHTML = html;
}

async function saveFeedback(lesId, klasId) {
  const text = document.getElementById('fb-text-' + lesId)?.value || '';
  const statusEl = document.getElementById('fb-status-' + lesId);
  try {
    await apiFetch('/api/lesson_classes/' + lesId + '/' + klasId, {
      method: 'PATCH',
      body: JSON.stringify({ feedback: text }),
    });
    if (statusEl) { statusEl.textContent = 'Opgeslagen \u2713'; statusEl.style.color = 'var(--green)'; }
  } catch(e) {
    if (statusEl) { statusEl.textContent = e.message || 'Fout'; statusEl.style.color = 'var(--red)'; }
  }
}

async function planLesOpslaan(klasId) {
  const lesId = document.getElementById('plan-les-' + klasId)?.value;
  const datum = document.getElementById('plan-datum-' + klasId)?.value || null;
  const statusEl = document.getElementById('plan-status-' + klasId);
  if (!lesId) return;
  try {
    await apiFetch('/api/lesson_classes', {
      method: 'POST',
      body: JSON.stringify({ lesson_id: lesId, class_id: klasId, lesson_date: datum }),
    });
    if (statusEl) statusEl.textContent = '';
    document.getElementById('plan-form-' + klasId).style.display = 'none';
    const lessen = await apiFetch('/api/lessons');
    lessonsCache = lessen || [];
    const wrap = document.getElementById('klas-activiteiten');
    const klas = classesCache.find(c => c.id === klasId);
    if (wrap && klas) renderKlasActiviteiten(klas, wrap);
  } catch(e) {
    if (statusEl) statusEl.textContent = e.message || 'Fout bij opslaan';
    if (statusEl) statusEl.style.color = 'var(--red)';
  }
}

function openMolAppVoorKlas(klasId, klasNaam) {
  document.getElementById('act-dropdown')?.classList.remove('open');
  if (!leraarToken) { showToast('Log eerst in als leraar.'); return; }
  const url = 'mol-lesvorm.html?leraar=' + encodeURIComponent(leraarToken)
    + '&klas_id=' + encodeURIComponent(klasId || '')
    + '&klas_naam=' + encodeURIComponent(klasNaam || '');
  window.open(url, '_blank');
}

function openLesResultaten(lesId) {
  // Navigeer naar Socratisch-view en laad resultaten voor deze les
  navNaar('socratisch');
  setTimeout(() => {
    const sel = document.getElementById('teacher-lesson-select');
    if (sel) { sel.value = lesId; loadStudentResults(); }
  }, 150);
}

function bekijkMolResultaten(sessieId) {
  // Open mol-app op het resultaten-scherm
  if (!leraarToken) { showToast('Log eerst in als leraar.'); return; }
  window.open('mol-lesvorm.html?leraar=' + encodeURIComponent(leraarToken) + '&open_sessie=' + sessieId, '_blank');
}

async function renderKlasLeerlingen(klas, wrap) {
  // Bouw de volledige leerlingenpagina voor een klas
  // met huidige leerlingen + toevoeg-sectie
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;flex-wrap:wrap;gap:0.5rem;">
      <div>
        <div class="page-eyebrow">Leerlingen</div>
        <h3 class="page-title" style="font-size:1.2rem;margin:0;">${klas?.name || ''}</h3>
      </div>
      <button class="btn btn-primary btn-sm" onclick="toggleLlToevoegSectie()">
        + Leerlingen toevoegen
      </button>
    </div>

    <!-- Toevoeg-sectie (initieel verborgen) -->
    <div id="ll-toevoeg-sectie" style="display:none;background:#fff;border:1.5px solid var(--border);
      border-radius:12px;padding:1.25rem;margin-bottom:1.25rem;">
      <div style="font-weight:700;font-size:0.88rem;color:var(--navy);margin-bottom:0.75rem;">
        Leerlingen toevoegen aan ${klas?.name || 'deze klas'}
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">
        <select id="klas-ll-periode" onchange="laadKlasLlKiezer()" style="flex:1;min-width:120px;">
          <option value="">— Alle periodes —</option>
        </select>
        <select id="klas-ll-niveau" onchange="laadKlasLlKiezer()" style="min-width:120px;">
          <option value="">— Alle niveaus —</option>
          <option value="Atheneum">Atheneum</option>
          <option value="Gymnasium">Gymnasium</option>
          <option value="HAVO">HAVO</option>
        </select>
        <select id="klas-ll-leerjaar" onchange="laadKlasLlKiezer()" style="min-width:100px;">
          <option value="">— Alle jaren —</option>
          <option value="1">Jaar 1</option><option value="2">Jaar 2</option>
          <option value="3">Jaar 3</option><option value="4">Jaar 4</option>
          <option value="5">Jaar 5</option><option value="6">Jaar 6</option>
        </select>
        <input type="text" id="klas-ll-zoek" placeholder="naam zoeken..."
          oninput="filterKlasLlKiezer()" style="min-width:140px;" />
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem;">
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-ghost-navy btn-sm" onclick="selecteerAlleKlasLl()" style="font-size:0.72rem;">Alles selecteren</button>
          <button class="btn btn-ghost-navy btn-sm" onclick="deselecteerAlleKlasLl()" style="font-size:0.72rem;">Deselecteren</button>
        </div>
        <span id="klas-ll-telling" style="font-size:0.75rem;color:var(--muted);"></span>
      </div>
      <div id="klas-ll-kiezer-lijst" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);
        border-radius:10px;padding:0.3rem;margin-bottom:0.75rem;">
        <div style="padding:1rem;text-align:center;color:var(--muted);font-size:0.82rem;">
          Stel filters in om leerlingen te tonen
        </div>
      </div>
      <div style="display:flex;gap:0.5rem;">
        <button class="btn btn-primary btn-sm" onclick="voegLlToeAanKlas('${klas?.id}','${klas?.name}')">
          Toevoegen aan klas →
        </button>
        <button class="btn btn-ghost-navy btn-sm" onclick="toggleLlToevoegSectie()">Annuleren</button>
      </div>
    </div>

    <!-- Huidige leerlingen -->
    <div id="klas-ll-huidig-wrap">
      <div style="text-align:center;padding:2rem;color:var(--muted);">
        <span class="spinner" style="border-top-color:var(--navy);display:inline-block;"></span>
      </div>
    </div>`;

  // Laad periodes voor de kiezer
  try {
    const periodes = await apiFetch('/api/leerlingen/periodes');
    const sel = document.getElementById('klas-ll-periode');
    if (sel) {
      periodes.forEach(p => sel.add(new Option(p, p)));
      if (periodes.length === 1) { sel.value = periodes[0]; laadKlasLlKiezer(); }
    }
  } catch(e) {}

  // Laad huidige leerlingen van deze klas
  await laadKlasLlHuidig(klas);
}

async function laadKlasLlHuidig(klas) {
  const wrap = document.getElementById('klas-ll-huidig-wrap');
  if (!wrap) return;
  try {
    const leerlingen = await apiFetch('/api/leerlingen?klas=' + encodeURIComponent(klas?.name || ''));
    if (!leerlingen?.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:2rem 0;">
        <div class="empty-icon">👥</div>
        <p>Nog geen leerlingen in deze klas.<br>
        Gebruik de knop "+ Leerlingen toevoegen" hierboven.</p>
      </div>`;
      return;
    }
    const rijen = leerlingen.map(l => {
      const naam = [l.roepnaam, l.tussenvoegsel, l.achternaam].filter(Boolean).join(' ');
      return `<tr>
        <td style="font-size:0.78rem;color:var(--muted);padding:0.6rem 0.75rem;">${l.stamnummer || '—'}</td>
        <td style="padding:0.6rem 0.75rem;font-weight:500;">${naam}</td>
        <td style="padding:0.6rem 0.75rem;">
          ${l.leerniveau ? `<span style="font-size:0.68rem;background:var(--navy-glow);color:var(--navy);padding:1px 6px;border-radius:4px;">${l.leerniveau}</span>` : '—'}
        </td>
        <td style="padding:0.6rem 0.75rem;font-size:0.78rem;color:var(--muted);">${l.email || '—'}</td>
        <td style="padding:0.6rem 0.75rem;text-align:right;">
          <button onclick="verwijderLlUitKlas('${l.id}','${klas?.id}','${klas?.name}')"
            style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.8rem;"
            title="Verwijder uit klas">✕</button>
        </td>
      </tr>`;
    }).join('');
    wrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
      <span style="font-size:13px;font-weight:600;color:var(--navy);">${leerlingen.length} leerlingen in deze klas</span>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
        <thead><tr style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:0.4rem 0.75rem 0.5rem;">Stamnr.</th>
          <th style="text-align:left;padding:0.4rem 0.75rem 0.5rem;">Naam</th>
          <th style="text-align:left;padding:0.4rem 0.75rem 0.5rem;">Niveau</th>
          <th style="text-align:left;padding:0.4rem 0.75rem 0.5rem;">E-mail</th>
          <th></th>
        </tr></thead>
        <tbody>${rijen}</tbody>
      </table>
    </div>`;
  } catch(e) {
    wrap.innerHTML = `<p style="color:var(--red);font-size:0.85rem;">Laden mislukt: ${e.message}</p>`;
  }
}

// Klas leerlingen kiezer state

function toggleLlToevoegSectie() {
  const s = document.getElementById('ll-toevoeg-sectie');
  if (s) s.style.display = s.style.display === 'none' ? 'block' : 'none';
}

async function laadKlasLlKiezer() {
  const periode  = document.getElementById('klas-ll-periode')?.value  || '';
  const niveau   = document.getElementById('klas-ll-niveau')?.value   || '';
  const leerjaar = document.getElementById('klas-ll-leerjaar')?.value || '';
  if (!periode && !niveau && !leerjaar) return;
  const qs = new URLSearchParams();
  if (periode)  qs.set('lesperiode', periode);
  if (niveau)   qs.set('leerniveau', niveau);
  if (leerjaar) qs.set('leerjaar', leerjaar);
  try {
    klasLlKiezerAlle = await apiFetch('/api/leerlingen?' + qs);
    renderKlasLlKiezer();
  } catch(e) {}
}

function filterKlasLlKiezer() { renderKlasLlKiezer(); }

function renderKlasLlKiezer() {
  const zoek = document.getElementById('klas-ll-zoek')?.value.toLowerCase() || '';
  const gefilterd = zoek
    ? klasLlKiezerAlle.filter(l => (l.roepnaam+' '+(l.tussenvoegsel||'')+' '+l.achternaam).toLowerCase().includes(zoek))
    : klasLlKiezerAlle;
  const lijst = document.getElementById('klas-ll-kiezer-lijst');
  if (!lijst) return;
  if (!gefilterd.length) {
    lijst.innerHTML = '<div style="padding:0.75rem;text-align:center;color:var(--muted);font-size:0.82rem;">Geen leerlingen gevonden</div>';
    updateKlasLlTelling(); return;
  }
  lijst.innerHTML = gefilterd.map(l => {
    const naam = [l.roepnaam, l.tussenvoegsel, l.achternaam].filter(Boolean).join(' ');
    const sel  = klasLlKiezerGeselecteerd.has(l.id);
    return `<div class="ll-picker-rij ${sel ? 'geselecteerd' : ''}" onclick="toggleKlasLl('${l.id}')" data-id="${l.id}">
      <div class="ll-picker-check">${sel ? '✓' : ''}</div>
      <span class="ll-picker-naam">${naam}</span>
      <span class="ll-picker-klas">${l.klas||''} ${l.leerniveau ? '· '+l.leerniveau : ''}</span>
    </div>`;
  }).join('');
  updateKlasLlTelling();
}

function toggleKlasLl(id) {
  if (klasLlKiezerGeselecteerd.has(id)) klasLlKiezerGeselecteerd.delete(id);
  else klasLlKiezerGeselecteerd.add(id);
  const el = document.querySelector(`#klas-ll-kiezer-lijst [data-id="${id}"]`);
  if (el) {
    const sel = klasLlKiezerGeselecteerd.has(id);
    el.classList.toggle('geselecteerd', sel);
    const check = el.querySelector('.ll-picker-check');
    if (check) check.textContent = sel ? '✓' : '';
  }
  updateKlasLlTelling();
}

function selecteerAlleKlasLl() { klasLlKiezerAlle.forEach(l => klasLlKiezerGeselecteerd.add(l.id)); renderKlasLlKiezer(); }
function deselecteerAlleKlasLl() { klasLlKiezerGeselecteerd.clear(); renderKlasLlKiezer(); }

function updateKlasLlTelling() {
  const el = document.getElementById('klas-ll-telling');
  if (el) el.textContent = klasLlKiezerGeselecteerd.size ? klasLlKiezerGeselecteerd.size + ' geselecteerd' : '';
}

async function voegLlToeAanKlas(klasId, klasNaam) {
  if (!klasLlKiezerGeselecteerd.size) { showToast('Selecteer eerst leerlingen.'); return; }
  try {
    await apiFetch('/api/leerlingen/koppel-klas', {
      method: 'POST',
      body: JSON.stringify({ leerling_ids: [...klasLlKiezerGeselecteerd], klas_naam: klasNaam }),
    });
    showToast('✓ ' + klasLlKiezerGeselecteerd.size + ' leerlingen toegevoegd aan ' + klasNaam);
    klasLlKiezerGeselecteerd = new Set();
    toggleLlToevoegSectie();
    // Herlaad huidig overzicht
    const klas = classesCache.find(c => c.id === klasId);
    if (klas) {
      await laadKlasLlHuidig(klas);
      // Update leerlingenaantal in header
      const sub = document.getElementById('klas-detail-sub');
      if (sub) {
        const ll = await apiFetch('/api/leerlingen?klas=' + encodeURIComponent(klasNaam)).catch(() => []);
        const niveauLbl = { atheneum:'Atheneum', gymnasium:'Gymnasium', havo:'HAVO' }[detecteerNiveau(klasNaam)] || '';
        const leerjaar  = detecteerLeerjaar(klasNaam);
        sub.textContent  = niveauLbl + (leerjaar ? ' ' + leerjaar : '') + (ll.length ? ' · ' + ll.length + ' leerlingen' : '');
      }
    }
  } catch(e) { showToast('Fout: ' + e.message); }
}

async function verwijderLlUitKlas(llId, klasId, klasNaam) {
  try {
    // Verwijder klas-koppeling door klas-veld leeg te maken
    await apiFetch('/api/leerlingen/koppel-klas', {
      method: 'POST',
      body: JSON.stringify({ leerling_ids: [llId], klas_naam: '' }),
    });
    const klas = classesCache.find(c => c.id === klasId);
    if (klas) await laadKlasLlHuidig(klas);
    showToast('Leerling verwijderd uit klas.');
  } catch(e) { showToast('Fout: ' + e.message); }
}

function renderKlasResultaten(klas, wrap) {
  const klasLessen = (lessonsCache || []).filter(l => (l.class_ids || []).includes(klas?.id));

  wrap.innerHTML = `<div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem;align-items:flex-end;">
    <div style="flex:1;min-width:180px;"><label>Filter op les</label>
      <select id="klas-res-les" onchange="laadKlasResultaten()">
        <option value="">— Kies een les —</option>
        ${klasLessen.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
      </select>
    </div>
    <div style="flex:1;min-width:180px;"><label>Filter op leerling</label>
      <input type="text" id="klas-res-zoek" placeholder="naam zoeken..." oninput="filterKlasResultaten()" />
    </div>
  </div>
  <div id="klas-resultaten-area">
    <div class="empty-state"><div class="empty-icon">📋</div><p>Selecteer een les om de resultaten te zien.</p></div>
  </div>`;

  // Als er maar één les is, direct laden
  if (klasLessen.length === 1) {
    const sel = document.getElementById('klas-res-les');
    if (sel) { sel.value = klasLessen[0].id; laadKlasResultaten(); }
  }
}


async function laadKlasResultaten() {
  const lesId = document.getElementById('klas-res-les')?.value;
  const area  = document.getElementById('klas-resultaten-area');
  if (!lesId || !area) return;
  area.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--muted);"><span class="spinner" style="border-top-color:var(--navy);"></span></div>`;
  try {
    const resultaten = await apiFetch('/api/results/' + lesId + '?class_id=' + (huidigKlasId || ''));
    _klasResultatenCache = resultaten || [];
    renderKlasResultatenTabel(_klasResultatenCache, area);
  } catch(e) {
    area.innerHTML = `<p style="color:var(--red);font-size:0.85rem;">Laden mislukt: ${e.message}</p>`;
  }
}

function filterKlasResultaten() {
  const zoek = document.getElementById('klas-res-zoek')?.value.toLowerCase() || '';
  const gefilterd = zoek ? _klasResultatenCache.filter(r => r.student_name?.toLowerCase().includes(zoek)) : _klasResultatenCache;
  const area = document.getElementById('klas-resultaten-area');
  if (area) renderKlasResultatenTabel(gefilterd, area);
}

function renderKlasResultatenTabel(resultaten, area) {
  if (!resultaten?.length) {
    area.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Geen resultaten gevonden.</p></div>`;
    return;
  }
  // Score gemiddelde
  const metScore = resultaten.filter(r => r.score_norm != null);
  const gemiddelde = metScore.length ? Math.round(metScore.reduce((s, r) => s + r.score_norm, 0) / metScore.length) : null;

  const rijen = resultaten.map(r => {
    const score = r.score_norm != null ? r.score_norm : '—';
    const scoreCls = r.score_norm >= 70 ? 'color:#1a6a40' : r.score_norm >= 50 ? 'color:#8a6200' : r.score_norm != null ? 'color:#c0392b' : 'color:var(--muted)';
    return `<tr class="clickable" onclick="showResultDetail('${r.id}')">
      <td style="padding:0.65rem 0.75rem;font-weight:500;">${r.student_name || '—'}</td>
      <td style="padding:0.65rem 0.75rem;font-size:0.82rem;color:var(--muted);">
        ${r.timestamp ? new Date(r.timestamp).toLocaleDateString('nl-NL', {day:'numeric',month:'short'}) : '—'}
      </td>
      <td style="padding:0.65rem 0.75rem;">
        <span style="font-family:'DM Mono',monospace;font-weight:700;${scoreCls}">${score}${r.score_norm != null ? '/100' : ''}</span>
      </td>
      <td style="padding:0.65rem 0.75rem;font-size:0.78rem;color:var(--muted);">
        ${r.understanding || '—'}
      </td>
    </tr>`;
  }).join('');

  area.innerHTML = `${gemiddelde !== null ? `<div style="margin-bottom:0.75rem;padding:10px 14px;background:var(--navy-glow);border-radius:8px;display:flex;gap:1.5rem;">
    <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:var(--navy);opacity:0.6;">Resultaten</div>
      <div style="font-size:18px;font-weight:700;color:var(--navy);font-family:'DM Mono',monospace;">${resultaten.length}</div></div>
    <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:var(--navy);opacity:0.6;">Gemiddelde score</div>
      <div style="font-size:18px;font-weight:700;color:var(--navy);font-family:'DM Mono',monospace;">${gemiddelde}/100</div></div>
  </div>` : ''}
  <table class="student-table">
    <thead><tr>
      <th>Leerling</th><th>Datum</th><th>Score</th><th>Begrip</th>
    </tr></thead>
    <tbody>${rijen}</tbody>
  </table>`;
}

function toggleActDropdown() {
  document.getElementById('act-dropdown')?.classList.toggle('open');
}

// ── Klas aanmaken/bewerken/verwijderen ──────────────────────
async function openCreateClass() {
  klasModalEditId = null;
  klasModalLlAlle = [];
  klasModalLlGeselecteerd = new Set();
  document.getElementById('new-class-name').value = '';
  document.getElementById('new-class-niveau').value = '';
  document.getElementById('new-class-leerjaar').value = '';
  document.getElementById('create-class-error').style.display = 'none';
  document.getElementById('edit-class-id').value = '';
  document.getElementById('klas-modal-titel').textContent = 'Nieuwe klas aanmaken';
  document.getElementById('klas-opslaan-btn').textContent = 'Klas opslaan';
  // Herstel knoppen naar "nieuwe klas" modus
  const volgendeBtn = document.getElementById('klas-stap1-volgende-btn');
  const directBtn   = document.getElementById('klas-stap1-direct-btn');
  if (volgendeBtn) volgendeBtn.style.display = '';
  if (directBtn) {
    directBtn.textContent = 'Opslaan zonder leerlingen te koppelen';
    directBtn.style.cssText = 'font-size:0.78rem;color:var(--muted);';
  }
  // Reset pill filters
  document.querySelectorAll('#klas-modal-niveau-pills .pill-filter, #klas-modal-leerjaar-pills .pill-filter')
    .forEach(el => el.classList.remove('actief'));
  zetKlasModalStap(1);
  openModal('modal-create-class');
}

async function openEditClass(id) {
  const klas = classesCache.find(c => c.id === id);
  if (!klas) return;
  klasModalEditId = id;
  klasModalLlAlle = [];
  klasModalLlGeselecteerd = new Set();
  document.getElementById('new-class-name').value     = klas.name     || '';
  document.getElementById('new-class-niveau').value   = klas.niveau   || '';
  document.getElementById('new-class-leerjaar').value = klas.leerjaar || '';
  document.getElementById('create-class-error').style.display = 'none';
  document.getElementById('edit-class-id').value      = id;
  document.getElementById('klas-modal-titel').textContent = 'Klas bewerken';

  // Herstel knoppen: toon beide stappen ook bij bewerken
  const volgendeBtn = document.getElementById('klas-stap1-volgende-btn');
  const directBtn   = document.getElementById('klas-stap1-direct-btn');
  if (volgendeBtn) { volgendeBtn.style.display = ''; volgendeBtn.textContent = 'Leerlingen bekijken / bewerken →'; }
  if (directBtn)   { directBtn.textContent = 'Opslaan zonder leerlingen te wijzigen'; directBtn.style.cssText = 'font-size:0.78rem;color:var(--muted);'; }

  // Reset pill filters
  document.querySelectorAll('#klas-modal-niveau-pills .pill-filter, #klas-modal-leerjaar-pills .pill-filter')
    .forEach(el => el.classList.remove('actief'));

  zetKlasModalStap(1);
  openModal('modal-create-class');
}

function zetKlasModalStap(stap) {
  document.getElementById('klas-stap-1').classList.toggle('actief', stap === 1);
  document.getElementById('klas-stap-2').classList.toggle('actief', stap === 2);
  document.getElementById('stap-dot-1').className = 'stap-dot ' + (stap === 1 ? 'actief' : 'klaar');
  document.getElementById('stap-dot-2').className = 'stap-dot ' + (stap === 2 ? 'actief' : '');
  document.getElementById('stap-lijn-1').className = 'stap-lijn ' + (stap === 2 ? 'klaar' : '');
}

async function klasNaarStap2() {
  const naam = document.getElementById('new-class-name').value.trim();
  const err  = document.getElementById('create-class-error');
  if (!naam) { err.textContent = 'Vul een klasnaam in.'; err.style.display = 'block'; return; }
  err.style.display = 'none';
  document.getElementById('klas-stap2-naam').textContent = naam;
  zetKlasModalStap(2);

  const lijst = document.getElementById('klas-modal-ll-lijst');

  // Laad periodes voor picker
  try {
    const periodes = await apiFetch('/api/leerlingen/periodes');
    const sel = document.getElementById('klas-modal-periode');
    sel.innerHTML = '<option value="">— Alle periodes —</option>'
      + periodes.map(p => `<option value="${p}">${p}</option>`).join('');
    if (periodes.length >= 1) sel.value = periodes[0];
  } catch(e) {}

  if (klasModalEditId) {
    // ── BEWERKEN: laad huidige leerlingen van de klas ──────
    const klas = classesCache.find(c => c.id === klasModalEditId);
    if (lijst) lijst.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--muted);font-size:0.82rem;"><span class="spinner" style="display:inline-block;border-top-color:var(--navy);"></span> Huidige leerlingen laden...</div>';

    try {
      // Haal eerst alle leerlingen van de klas op (de geselecteerde groep)
      const klasLl = await apiFetch('/api/leerlingen?klas=' + encodeURIComponent(klas?.name || ''));
      klasLl.forEach(l => klasModalLlGeselecteerd.add(l.id));

      // Haal ook alle leerlingen op voor de gekozen periode
      const periode = document.getElementById('klas-modal-periode')?.value || '';
      const qs = periode ? '?lesperiode=' + encodeURIComponent(periode) : '';
      const alleLl = await apiFetch('/api/leerlingen' + qs);

      // Combineer: klas-leerlingen + alle andere (voor toevoegen/verwijderen)
      // Dedup op id
      const map = new Map();
      alleLl.forEach(l => map.set(l.id, l));
      klasLl.forEach(l => map.set(l.id, l)); // klas-leerlingen overschrijven
      klasModalLlAlle = [...map.values()].sort((a, b) =>
        (a.achternaam || '').localeCompare(b.achternaam || ''));

      renderKlasModalLlLijst();
    } catch(e) {
      if (lijst) lijst.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--red);font-size:0.82rem;">Laden mislukt: ${e.message}</div>`;
    }
  } else {
    // ── NIEUW: laad op basis van geselecteerde filters ─────
    const periode = document.getElementById('klas-modal-periode')?.value || '';
    if (periode) laadKlasModalLl();
    else if (lijst) lijst.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--muted);font-size:0.82rem;">Selecteer een periode of kies niveau/leerjaar om leerlingen te zien</div>';
  }
}

function klasTerug() { zetKlasModalStap(1); }

function toggleModalPill(el, groep) {
  el.classList.toggle('actief');
  laadKlasModalLl();
}

function getModalPills(groep) {
  return [...document.querySelectorAll('#klas-modal-' + groep + '-pills .pill-filter.actief')]
    .map(el => el.dataset.val);
}

async function laadKlasModalLl() {
  const periode  = document.getElementById('klas-modal-periode')?.value || '';
  const niveaus  = getModalPills('niveau');
  const jaren    = getModalPills('leerjaar');
  const lijst    = document.getElementById('klas-modal-ll-lijst');

  if (!periode && !niveaus.length && !jaren.length) {
    if (lijst) lijst.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--muted);font-size:0.82rem;">Kies een periode of selecteer niveau/leerjaar</div>';
    return;
  }

  if (lijst) lijst.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--muted);font-size:0.82rem;"><span class="spinner" style="display:inline-block;border-top-color:var(--navy);"></span> Laden...</div>';

  try {
    // Bouw alle combinaties van niveau × leerjaar
    // Dan client-side filteren met EN-logica
    const qs = new URLSearchParams();
    if (periode) qs.set('lesperiode', periode);
    // Haal alle leerlingen op voor de periode (of alles), filter daarna lokaal
    const alle = await apiFetch('/api/leerlingen' + (qs.toString() ? '?' + qs : ''));

    // Filter: niveau EN leerjaar moeten beide kloppen
    klasModalLlAlle = alle.filter(l => {
      const niveauOk  = !niveaus.length  || niveaus.some(nv  => (l.leerniveau || '').toLowerCase() === nv.toLowerCase());
      const jaarOk    = !jaren.length    || jaren.some(jr    => String(l.leerjaar) === String(jr));
      return niveauOk && jaarOk;
    });

    renderKlasModalLlLijst();
  } catch(e) {
    if (lijst) lijst.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--red);font-size:0.82rem;">${e.message}</div>`;
  }
}

function filterKlasModalLl() { renderKlasModalLlLijst(); }

function renderKlasModalLlLijst() {
  const zoek = (document.getElementById('klas-modal-zoek')?.value || '').toLowerCase();
  const gefilterd = zoek
    ? klasModalLlAlle.filter(l => (l.roepnaam+' '+(l.tussenvoegsel||'')+' '+l.achternaam).toLowerCase().includes(zoek))
    : klasModalLlAlle;
  const lijst = document.getElementById('klas-modal-ll-lijst');
  if (!lijst) return;
  if (!gefilterd.length) {
    lijst.innerHTML = '<div style="padding:0.75rem;text-align:center;color:var(--muted);font-size:0.82rem;">Geen leerlingen gevonden</div>';
    updateKlasModalTelling(); return;
  }
  lijst.innerHTML = gefilterd.map(l => {
    const naam = [l.roepnaam, l.tussenvoegsel, l.achternaam].filter(Boolean).join(' ');
    const sel  = klasModalLlGeselecteerd.has(l.id);
    return `<div class="ll-picker-rij ${sel?'geselecteerd':''}" onclick="toggleKlasModalLl('${l.id}')" data-modal-id="${l.id}">
      <div class="ll-picker-check">${sel?'✓':''}</div>
      <span class="ll-picker-naam">${naam}</span>
      <span class="ll-picker-klas">${l.leerniveau||''} ${l.leerjaar ? '· jr '+l.leerjaar : ''}</span>
    </div>`;
  }).join('');
  updateKlasModalTelling();
}

function toggleKlasModalLl(id) {
  if (klasModalLlGeselecteerd.has(id)) klasModalLlGeselecteerd.delete(id);
  else klasModalLlGeselecteerd.add(id);
  const el = document.querySelector(`[data-modal-id="${id}"]`);
  if (el) {
    const sel = klasModalLlGeselecteerd.has(id);
    el.classList.toggle('geselecteerd', sel);
    const c = el.querySelector('.ll-picker-check');
    if (c) c.textContent = sel ? '✓' : '';
  }
  updateKlasModalTelling();
}

function selecteerAlleKlasModal() { klasModalLlAlle.forEach(l => klasModalLlGeselecteerd.add(l.id)); renderKlasModalLlLijst(); }
function deselecteerAlleKlasModal() { klasModalLlGeselecteerd.clear(); renderKlasModalLlLijst(); }

function updateKlasModalTelling() {
  const el = document.getElementById('klas-modal-telling');
  if (el) el.textContent = klasModalLlGeselecteerd.size ? klasModalLlGeselecteerd.size + ' geselecteerd' : '';
}

async function _slaKlasOp(metLeerlingen) {
  const name     = (document.getElementById('new-class-name')?.value || '').trim();
  const niveau   = document.getElementById('new-class-niveau')?.value   || '';
  const leerjaar = document.getElementById('new-class-leerjaar')?.value || '';
  const editId   = document.getElementById('edit-class-id')?.value      || '';
  const err      = document.getElementById('create-class-error');
  const btn      = document.getElementById(metLeerlingen ? 'klas-opslaan-btn' : 'create-class-btn');

  if (!name) {
    if (err) { err.textContent = 'Vul een klasnaam in.'; err.style.display = 'block'; }
    zetKlasModalStap(1); return;
  }
  if (err) err.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Opslaan...'; }

  const klasId = editId || ('class_' + Date.now());

  try {
    // 1. Sla klas op
    if (editId) {
      await apiFetch('/api/classes/' + editId, {
        method: 'PATCH',
        body: JSON.stringify({ name, niveau: niveau || null, leerjaar: leerjaar || null }),
      });
    } else {
      await apiFetch('/api/classes', {
        method: 'POST',
        body: JSON.stringify({ id: klasId, name, niveau: niveau || null, leerjaar: leerjaar || null, created_at: Date.now() }),
      });
    }

    // 2. Koppel leerlingen
    const llIds = [...(klasModalLlGeselecteerd || new Set())];
    if (llIds.length > 0) {
      await apiFetch('/api/leerlingen/koppel-klas', {
        method: 'POST',
        body: JSON.stringify({ leerling_ids: llIds, klas_naam: name }),
      }).catch(() => {});
    }

    // 3. Modal sluiten + toast
    closeModal('modal-create-class');
    showToast('✓ Klas "' + name + '" ' + (editId ? 'bijgewerkt' : 'aangemaakt') +
      (llIds.length ? ' · ' + llIds.length + ' leerlingen gekoppeld' : ''));

    // 4. Zet klas in cache — ongeacht wat server teruggeeft
    const klasObj = { id: klasId, name, niveau: niveau || null, leerjaar: leerjaar || null, created_at: Date.now() };
    if (editId) {
      classesCache = classesCache.map(c => c.id === editId ? { ...c, ...klasObj } : c);
    } else {
      classesCache = classesCache.filter(c => c.id !== klasId).concat(klasObj);
    }

    // 5. Render direct — gebruik classesCache die gegarandeerd de klas bevat
    renderClassenGrid(classesCache);

    // 6. Maak view-klassen zichtbaar (alles andere verbergen)
    document.querySelectorAll('[id^="view-"]').forEach(el => el.style.display = 'none');
    const vk = document.getElementById('view-klassen');
    if (vk) vk.style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-klassen')?.classList.add('active');
    huidigView = 'klassen';
    huidigKlasId = null;
    const kh = document.getElementById('klas-header');
    if (kh) kh.style.display = 'none';
    setBreadcrumb([{ label: 'Klassen' }]);
    setMainActions('klassen');

    // 7. Refresh cache van server op achtergrond (optioneel)
    getClasses().then(verse => {
      if (!Array.isArray(verse)) return;
      const inServer = verse.find(c => c.id === klasId);
      classesCache = inServer ? verse : verse.concat(klasObj);
      renderClassenGrid(classesCache);
    }).catch(() => {});

  } catch(e) {
    if (err) { err.textContent = 'Opslaan mislukt: ' + e.message; err.style.display = 'block'; }
    zetKlasModalStap(1);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = metLeerlingen ? 'Klas opslaan' : 'Klas aanmaken'; }
  }
}

async function slaKlasOpZonderLeerlingen() { await _slaKlasOp(false); }
async function slaKlasOpMetLeerlingen()    { await _slaKlasOp(true);  }
// Legacy alias
async function createClass() { await _slaKlasOp(false); }

async function deleteClass(id, name) {
  if (!confirm('Klas "' + name + '" verwijderen? Lessen worden losgekoppeld maar leerlingen blijven bewaard.')) return;
  try {
    await apiFetch('/api/classes/' + id, { method: 'DELETE' });
    showToast('Klas "' + name + '" verwijderd.');
    classesCache = await getClasses();
    populateStudentClassDropdown();
    navNaar('klassen');
    await renderClassenGrid(classesCache);
  } catch(e) { showToast('Verwijderen mislukt: ' + e.message); }
}

async function loadClassesTab() {
  const grid = document.getElementById('classes-grid');
  const noMsg = document.getElementById('no-classes-msg');
  classesCache = await getClasses();
  grid.innerHTML = '';
  if (classesCache.length === 0) { noMsg.style.display = 'block'; return; }
  noMsg.style.display = 'none';

  // For each class, count lessons + results
  const [allLessons, allResults] = await Promise.all([
    apiFetch('/api/lessons'),
    apiFetch('/api/results')
  ]);

  classesCache.forEach(c => {
    const lessonCount  = allLessons.filter(l => l.class_id === c.id).length;
    const resultCount  = allResults.filter(r => r.class_id === c.id).length;
    const studentNames = new Set(allResults.filter(r => r.class_id === c.id).map(r => r.student_name));
    const card = document.createElement('div');
    card.className = 'lesson-card';
    card.innerHTML = `
      <div class="lesson-card-name">🏫 ${escHtml(c.name)}</div>
      <div style="display:flex;gap:0.6rem;margin:0.6rem 0;flex-wrap:wrap;">
        <span class="badge badge-blue">📋 ${lessonCount} lessen</span>
        <span class="badge badge-blue">🎓 ${studentNames.size} leerlingen</span>
        <span class="badge badge-neutral">${resultCount} reflecties</span>
      </div>
      <div style="margin-top:0.75rem;">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteClass('${c.id}','${escAttr(c.name)}')">🗑 Verwijderen</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ═══════════════════════════════════════════════════════════
//  MODALS
