async function loginTeacher() {
  const email = document.getElementById('teacher-email').value.trim();
  const pw    = document.getElementById('teacher-password').value;
  const err   = document.getElementById('teacher-error');
  const btn   = document.getElementById('login-btn');
  if (!email || !pw) { err.textContent = 'Vul e-mail en wachtwoord in.'; err.style.display='block'; return; }
  err.style.display = 'none';
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Inloggen...';
  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, wachtwoord: pw }),
    });
    leraarToken   = data.token;
    leraarProfiel = data.leraar;
    localStorage.setItem('leraar_token', leraarToken);
    if(document.getElementById('topbar-leraar-naam')) document.getElementById('topbar-leraar-naam').textContent = leraarProfiel.naam;
    showScreen('screen-teacher');
    await loadTeacherDashboard();
    navNaar('leerlingen');
  } catch(e) {
    err.textContent = e.message || 'Inloggen mislukt.';
    err.style.display = 'block';
  } finally {
    btn.disabled = false; btn.innerHTML = 'Inloggen →';
  }
}

async function registreer() {
  const naam  = document.getElementById('reg-naam').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const ww    = document.getElementById('reg-ww').value;
  const ww2   = document.getElementById('reg-ww2').value;
  const err   = document.getElementById('register-error');
  const btn   = document.getElementById('reg-btn');
  if (!naam || !email || !ww) { err.textContent = 'Vul alle velden in.'; err.style.display='block'; return; }
  if (ww !== ww2) { err.textContent = 'Wachtwoorden komen niet overeen.'; err.style.display='block'; return; }
  err.style.display = 'none';
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Account aanmaken...';
  try {
    const data = await apiFetch('/api/auth/registreer', {
      method: 'POST',
      body: JSON.stringify({ naam, email, wachtwoord: ww }),
    });
    leraarToken = data.token; leraarProfiel = data.leraar;
    localStorage.setItem('leraar_token', leraarToken);
    if(document.getElementById('topbar-leraar-naam')) document.getElementById('topbar-leraar-naam').textContent = leraarProfiel.naam;
    showScreen('screen-teacher'); await loadTeacherDashboard(); navNaar('leerlingen');
  } catch(e) {
    err.textContent = e.message || 'Registratie mislukt.';
    err.style.display = 'block';
  } finally {
    btn.disabled = false; btn.innerHTML = 'Account aanmaken →';
  }
}

function logoutTeacher() {
  leraarToken = null; leraarProfiel = null;
  localStorage.removeItem('leraar_token');
  showScreen('screen-landing');
}

function goHome() { showScreen('screen-landing'); }

function openMolApp() {
  if (!leraarToken) { showToast('Log eerst in als leraar.'); return; }
  window.open('mol-lesvorm.html?leraar=' + encodeURIComponent(leraarToken), '_blank');
}

window.addEventListener('DOMContentLoaded', async () => {
  const urlParams   = new URLSearchParams(window.location.search);
  const directLesId = urlParams.get('les');

  if (leraarToken) {
    try {
      leraarProfiel = await apiFetch('/api/auth/mij');
      if(document.getElementById('topbar-leraar-naam')) document.getElementById('topbar-leraar-naam').textContent = leraarProfiel.naam;
      showScreen('screen-teacher');
      await loadTeacherDashboard();
      navNaar('klassen');
    } catch(e) {
      leraarToken = null; localStorage.removeItem('leraar_token');
    }
  }

  loadClasses();

  if (directLesId && !leraarToken) {
    selectRole('student');
    const codeIn = document.getElementById('student-lesson-code');
    if (codeIn) codeIn.value = directLesId.slice(0,4).toUpperCase();
    const errEl = document.getElementById('landing-error');
    if (errEl) {
      errEl.textContent = '\u2713 Les gevonden via link — vul je naam in en klik op Verder';
      errEl.style.color  = 'var(--green)';
      errEl.style.display = 'block';
    }
  }
});
