const API = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://toetsapp-backend-production.up.railway.app';

async function apiFetch(path, opts = {}) {
  const baseHeaders = { 'Content-Type': 'application/json' };
  if (docentToken && docentToken !== 'leraar123') {
    baseHeaders['Authorization'] = 'Bearer ' + docentToken;
  }
  const res = await fetch(API + path, {
    ...opts,
    headers: { ...baseHeaders, ...(opts.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Onbekende fout');
  return data;
}
