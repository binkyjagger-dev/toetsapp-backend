const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://toetsapp-backend-production.up.railway.app';

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (leraarToken) headers['Authorization'] = 'Bearer ' + leraarToken;
  const res = await fetch(API_BASE + path, { headers, ...options });
  if (res.status === 401) {
    leraarToken = null; localStorage.removeItem('leraar_token');
    showScreen('screen-landing'); selectRole('teacher');
    throw new Error('Sessie verlopen, log opnieuw in');
  }
  if (!res.ok) {
    let errMsg;
    try { const j = await res.json(); errMsg = j.error || res.statusText; }
    catch(e) { errMsg = await res.text().catch(() => res.statusText); }
    throw new Error(errMsg);
  }
  return res.json();
}
