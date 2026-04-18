function renderHergebruikGroepen() {
  const grid = document.getElementById('hergebruik-groepen-grid');
  grid.innerHTML = hergebruikGroepen.map((g,gi)=>`
    <div class="groep-card-interactief">
      <div class="groep-naam"><span>${escH(g.naam)}</span><span style="font-size:0.65rem;color:var(--muted);font-weight:400;">Mol: <span style="color:var(--red-l);">${escH(g.leden.find(l=>l.isMol)?.naam||'—')}</span></span></div>
      ${g.leden.map((l,li)=>`<div class="groep-lid-mol-rij${l.isMol?' is-mol':''}" onclick="selecteerHergebruikMol(${gi},${li})"><div class="mol-kies-radio"></div><span class="groep-lid-mol-naam" style="margin-left:0.6rem;">${escH(l.naam)}</span>${l.isMol?'<span style="font-size:0.68rem;color:var(--red-l);font-weight:700;">🕵️ Mol</span>':''}</div>`).join('')}
    </div>`).join('');
  document.getElementById('hergebruik-groepen-wrap').style.display='block';
}

function selecteerHergebruikMol(gi, li) {
  hergebruikGroepen[gi].leden.forEach((l,i)=>{l.isMol=i===li;});
  renderHergebruikGroepen();
  toast(`🕵️ ${hergebruikGroepen[gi].leden[li].naam} is Mol in ${hergebruikGroepen[gi].naam}`);
}



// ════════════════════════════════════════════════════════════
// RESULTATEN + HERGEBRUIK — hoofd-functies
// ════════════════════════════════════════════════════════════
async function bekijkResultaten(id) {
  showScreen('screen-speler-reveal');
  document.getElementById('resultaten-loading').style.display = 'block';
  document.getElementById('resultaten-content').style.display = 'none';
  try {
    const data = await apiFetch(`/api/mol/sessie/${id}/resultaten?docent_token=${encodeURIComponent(docentToken)}`);
    renderResultaten(data);
  } catch(e) {
    document.getElementById('resultaten-loading').innerHTML =
      `<p style="color:var(--red-l);">Laden mislukt: ${escH(e.message)}</p>`;
  }
}


async function openHergebruik(id, dCode, lesNaam) {
  hergebruikSessieId   = id;
  hergebruikDocentCode = dCode;
  hergebruikGroepen    = [];
  document.getElementById('hergebruik-les-naam').textContent = lesNaam;
  document.getElementById('hergebruik-groepen-wrap').style.display = 'none';
  document.getElementById('hergebruik-error').style.display = 'none';
  document.getElementById('hergebruik-leerlingen').value = '';
  try {
    // Haal cases op uit de reguliere sessie-state (werkt ook voor niet-afgelopen sessies)
    const data = await apiFetch(`/api/mol/sessie/${id}`);
    const cases = data.cases || [];
    document.getElementById('hergebruik-cases-preview').innerHTML = cases.length > 0
      ? cases.map(c => `<div style="padding:0.3rem 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:var(--muted);font-size:0.7rem;">Ronde ${c.ronde_nr}</span>&nbsp;
          ${escH(c.vraag.substring(0,80))}${c.vraag.length>80?'…':''}
        </div>`).join('')
      : '<div style="color:var(--muted);font-size:0.78rem;">Nog geen vragen — worden overgenomen uit de vraag-editor.</div>';
  } catch(e) {
    document.getElementById('hergebruik-cases-preview').innerHTML =
      '<div style="color:var(--muted);font-size:0.78rem;">Vragen laden mislukt.</div>';
  }
  showScreen('screen-sessie-lijst');
}

function genereerHergebruikGroepen() {
  const raw = document.getElementById('hergebruik-leerlingen').value;
  const leerlingen = raw.split(/[\n,]/).map(s => s.trim()).filter(s => s.length > 1);
  const gs  = parseInt(document.getElementById('hergebruik-groep-grootte').value) || 4;
  const err = document.getElementById('hergebruik-error');
  if (leerlingen.length < gs) {
    err.textContent = `Minimaal ${gs} leerlingen nodig.`;
    err.style.display = 'block'; return;
  }
  err.style.display = 'none';
  const geshuffled = [...leerlingen].sort(() => Math.random() - 0.5);
  hergebruikGroepen = [];
  const labels = 'ABCDEFGHIJ'.split('');
  for (let i = 0; i < geshuffled.length; i += gs) {
    hergebruikGroepen.push({
      naam: 'Groep ' + labels[hergebruikGroepen.length],
      leden: geshuffled.slice(i, i + gs).map((naam, idx) => ({ naam, isMol: idx === 0 })),
    });
  }
  renderHergebruikGroepen();
}

async function startHergebruik() {
  const err = document.getElementById('hergebruik-error');
  if (hergebruikGroepen.length === 0) {
    err.textContent = 'Genereer eerst de groepsindeling.';
    err.style.display = 'block'; return;
  }
  err.style.display = 'none';
  const btn = document.getElementById('hergebruik-start-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Bezig...';
  try {
    const gs = parseInt(document.getElementById('hergebruik-groep-grootte').value) || 4;
    await apiFetch(`/api/mol/sessie/${hergebruikSessieId}/hergebruik`, {
      method: 'POST',
      body: JSON.stringify({ docent_token: docentToken, groepsindeling: hergebruikGroepen, groep_grootte: gs }),
    });
    sessieId   = hergebruikSessieId;
    docentCode = hergebruikDocentCode;
    const { sessie } = await apiFetch('/api/mol/sessie/' + sessieId);
    sessieCode = sessie.sessie_code;
    localStorage.setItem('mol_sessie_id',   sessieId);
    localStorage.setItem('mol_docent_code', docentCode);
    toast('✅ Sessie opnieuw ingesteld');
    laadDocentSessie();
  } catch(e) {
    err.textContent = 'Fout: ' + e.message;
    err.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = 'Sessie opnieuw starten →';
  }
}


// ════════════════════════════════════════════════════════════
// CODES DELEN — projectie + print
// ════════════════════════════════════════════════════════════
