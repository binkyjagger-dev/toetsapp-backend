// ── Student flow ───────────────────────────────────────────
async function startStudentFlow() {
  // Legacy wrapper — via klas
  await startStudentViaKlas();
}

async function startStudentMetCode() {
  const name = document.getElementById('student-name').value.trim();
  const code = document.getElementById('student-lesson-code').value.trim().toUpperCase();
  const err  = document.getElementById('landing-error');
  if (!name) { err.textContent = 'Vul je voornaam in.'; err.style.display = 'block'; return; }
  if (!code || code.length < 2) { err.textContent = 'Vul een lescode in (van je leraar).'; err.style.display = 'block'; return; }
  err.style.display = 'none';
  // Zoek les op code (eerste 4 tekens van id, uppercase)
  try {
    const lessen = await apiFetch('/api/lessons');
    const gevonden = lessen.find(l => l.id.slice(0,4).toUpperCase() === code.slice(0,4) ||
                                      l.id.toUpperCase().startsWith(code));
    if (!gevonden) { err.textContent = 'Geen les gevonden voor code "' + code + '". Controleer de code bij je leraar.'; err.style.display = 'block'; return; }
    studentName   = name;
    selectedLesson = gevonden;
    const eersteKlasId = (gevonden.class_ids || [])[0] || null;
    selectedClass = eersteKlasId
      ? (classesCache.find(c => c.id === eersteKlasId) || { id: eersteKlasId, name: '—' })
      : null;
    document.getElementById('topbar-student-name').textContent = name;
    showScreen('screen-kies-lesvorm');
    renderLesvormKeuze(gevonden);
  } catch(e) {
    err.textContent = 'Fout bij ophalen: ' + e.message; err.style.display = 'block';
  }
}

async function startStudentViaKlas() {
  const name    = document.getElementById('student-name').value.trim();
  const classId = document.getElementById('student-class').value;
  const lesId   = document.getElementById('student-les-select').value;
  const err     = document.getElementById('landing-error');
  if (!name) { err.textContent = 'Vul je voornaam in.'; err.style.display = 'block'; return; }
  if (!classId) { err.textContent = 'Kies eerst jouw klas.'; err.style.display = 'block'; return; }
  if (!lesId) { err.textContent = 'Kies ook een les.'; err.style.display = 'block'; return; }
  err.style.display = 'none';
  studentName    = name;
  selectedClass  = classesCache.find(c => c.id === classId) || { id: classId, name: '—' };
  selectedLesson = lessonsCache?.find(l => l.id === lesId) || null;
  document.getElementById('topbar-student-name').textContent = name + ' · ' + selectedClass.name;
  if (selectedLesson) {
    showScreen('screen-kies-lesvorm');
    renderLesvormKeuze(selectedLesson);
  } else {
    showScreen('screen-choose-lesson');
    await loadLessonsForStudent();
  }
}

// Vul les-dropdown als klas verandert (leerling-flow)
async function onStudentKlasChange() {
  const classId = document.getElementById('student-class').value;
  const lesSel  = document.getElementById('student-les-select');
  lesSel.innerHTML = '<option value="">— Laden... —</option>';
  if (!classId) { lesSel.innerHTML = '<option value="">— Kies eerst een klas —</option>'; return; }
  try {
    const lessen = await apiFetch('/api/lessons?class_id=' + classId);
    lesSel.innerHTML = '<option value="">— Kies een les —</option>';
    lessen.forEach(l => lesSel.add(new Option(l.name, l.id)));
    if (!lessen.length) lesSel.innerHTML = '<option value="">Geen lessen beschikbaar</option>';
  } catch(e) { lesSel.innerHTML = '<option value="">Fout bij laden</option>'; }
}

// ═══════════════════════════════════════════════════════════
//  LESSONS
// ═══════════════════════════════════════════════════════════

async function loadLessonsForStudent() {
  const lessons = await getLessons(selectedClass ? selectedClass.id : null);
  const container = document.getElementById('lesson-list-student');
  const noMsg = document.getElementById('no-lessons-msg');
  container.innerHTML = '';
  if (lessons.length === 0) { noMsg.style.display = 'block'; return; }
  noMsg.style.display = 'none';
  lessons.forEach(l => {
    const div = document.createElement('div');
    div.className = 'lesson-item';
    div.innerHTML = `<div><div class="lesson-item-name">${escHtml(l.name)}</div><div class="lesson-item-desc">${escHtml(l.content.substring(0,80))}...</div></div><div class="lesson-arrow">→</div>`;
    div.onclick = () => chooseLesson(l);
    container.appendChild(div);
  });
}

function chooseLesson(lesson) {
  selectedLesson  = lesson;
  selectedLesvorm = 'socratisch'; // reset

  // Vul explain-screen alvast in (voor als er direct naartoe gegaan wordt)
  document.getElementById('explain-lesson-title').textContent = lesson.name;
  document.getElementById('explain-lesson-name-topbar').textContent = lesson.name;

  const lesvormen = getBeschikbareLesvormen(lesson);
  const mode      = lesson?.lesvorm_mode || 'locked';

  // Vergrendeld op één lesvorm, of maar één beschikbaar → direct starten
  if (mode === 'locked' || lesvormen.length <= 1) {
    const lv = lesvormen[0] || LESVORMEN_REGISTRY['socratisch'];
    selectedLesvorm = lv.id;
    lv.start();
  } else {
    // Meerdere lesvormen en free-mode → kiezer tonen
    showLesVormKiezer(lesvormen);
  }
}

// ─── Fase 3: Lesvorm-kiezer ────────────────────────────────────────────────
function showLesVormKiezer(lesvormen) {
  // Vul topbar en titel
  document.getElementById('kiezer-lesson-topbar').textContent = selectedLesson.name;
  document.getElementById('kiezer-lesson-title').textContent  = selectedLesson.name;

  // Bouw kaarten
  const grid = document.getElementById('lv-kiezer-grid');
  grid.innerHTML = '';
  lesvormen.forEach(lv => {
    const btn = document.createElement('button');
    btn.className = 'lv-kiezer-card';
    btn.innerHTML = `
      <div class="lv-kiezer-icoon">${lv.icoon}</div>
      <div class="lv-kiezer-body">
        <div class="lv-kiezer-naam">${lv.naam}</div>
        <div class="lv-kiezer-desc">${lv.beschrijving}</div>
      </div>
      <span class="lv-kiezer-duur">${lv.duur}</span>
      <span class="lv-kiezer-pijl">→</span>`;
    btn.onclick = () => {
      selectedLesvorm = lv.id;
      lv.start();
    };
    grid.appendChild(btn);
  });

  showScreen('screen-kies-lesvorm');
}

// ═══════════════════════════════════════════════════════════
//  EXPLAIN SUBMISSION
// ═══════════════════════════════════════════════════════════
async function submitExplanation() {
  const btn = document.getElementById('explain-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Laden...';

  // Reset chat state
  chatMessages = [];
  questionCount = 0;
  studentScores = [];
  chatPhase = 'opening';
  socraticAnswerCount = 0;
  vraagLeerdoelen = [];
  // Laad leerdoelen van de geselecteerde les uit LEERDOELEN_DB
  if (selectedLesson && selectedLesson.leerdoelen) {
    currentLeerdoelen = selectedLesson.leerdoelen;
  } else if (selectedLesson && selectedLesson.chapter_val) {
    currentLeerdoelen = selectedLesson.leerdoelen || null;
  } else {
    currentLeerdoelen = null;
  }
  document.getElementById('chat-lesson-title').textContent = selectedLesson.name;
  document.getElementById('chat-area').innerHTML = '';
  document.getElementById('chat-finish-area').style.display = 'none';
  document.getElementById('chat-summary-loading').style.display = 'none';
  document.getElementById('chat-score-area').style.display = 'none';
  document.getElementById('chat-input-row').style.display = 'flex';
  document.getElementById('chat-input').value = '';

  showScreen('screen-chat');
  btn.disabled = false;
  btn.innerHTML = 'Start het gesprek →';

  // AI stelt de openingsvraag
  await askOpeningQuestion();
}

// ═══════════════════════════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════════════════════════
function addChatBubble(role, text) {
  const area = document.getElementById('chat-area');
  const div = document.createElement('div');
  div.className = `chat-bubble bubble-${role === 'ai' ? 'ai' : 'user'}`;
  if (role === 'ai') div.innerHTML = `<div class="bubble-label">🤖 Toetsbot</div>${escHtml(text)}`;
  else div.textContent = text;
  area.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function addScoreCard(scoreData) {
  const area = document.getElementById('chat-area');
  const score = scoreData.score || 5;
  const max = MAX_QUESTIONS * 10;
  const stars = '★'.repeat(score) + '☆'.repeat(10 - score);
  const color = score >= 8 ? 'var(--green)' : score >= 5 ? 'var(--orange)' : 'var(--red)';
  const div = document.createElement('div');
  div.className = 'score-card';
  div.innerHTML =
    '<div class="score-card-top">' +
      '<span class="score-number" style="color:' + color + ';">' + score + '<span style="font-size:0.8rem;color:var(--muted);font-weight:400;">/10</span></span>' +
      '<span class="score-stars" style="color:' + color + ';">' + stars + '</span>' +
    '</div>' +
    '<div class="score-motivatie">' + escHtml(scoreData.motivatie || '') + '</div>';
  area.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function updateProgress() {
  if (chatPhase === 'opening') {
    document.getElementById('chat-progress-bar').style.width = '66%';
    document.getElementById('chat-progress-label').textContent = 'Openingsvraag';
  } else if (chatPhase === 'summary') {
    document.getElementById('chat-progress-bar').style.width = '100%';
    document.getElementById('chat-progress-label').textContent = 'Gesprek afgerond';
  } else {
    const pct = 66 + (socraticAnswerCount / MAX_QUESTIONS) * 33;
    document.getElementById('chat-progress-bar').style.width = pct + '%';
    document.getElementById('chat-progress-label').textContent = 'Vraag ' + (socraticAnswerCount + 1) + ' van ' + MAX_QUESTIONS;
  }
}

async function askOpeningQuestion() {
  showTyping(true);
  updateProgress();
  try {
    const data = await apiFetch('/api/ai/question', {
      method: 'POST',
      body: JSON.stringify({
        lessonName:     selectedLesson.name,
        lessonContent:  selectedLesson.content,
        leerdoelen:     currentLeerdoelen,
        studentName,
        questionNumber: 0,
        maxQuestions:   MAX_QUESTIONS,
        messages:       [],
        isOpening:      true
      })
    });
    const aiText = data.text || 'Wat heb je geleerd van deze les?';
    showTyping(false);
    chatMessages.push({ role: 'assistant', content: aiText });
    addChatBubble('ai', aiText);
    updateProgress();
  } catch(e) {
    showTyping(false);
    addChatBubble('ai', 'Wat heb je geleerd van deze les? Vertel het in je eigen woorden.');
    chatMessages.push({ role: 'assistant', content: 'Wat heb je geleerd van deze les? Vertel het in je eigen woorden.' });
  }
}

async function askNextQuestion() {
  showTyping(true);
  updateProgress();
  try {
    const data = await apiFetch('/api/ai/question', {
      method: 'POST',
      body: JSON.stringify({
        lessonName:     selectedLesson.name,
        lessonContent:  selectedLesson.content,
        leerdoelen:     currentLeerdoelen,
        studentName,
        questionNumber: socraticAnswerCount,
        maxQuestions:   MAX_QUESTIONS,
        messages:       chatMessages
      })
    });
    // Sla het gefocuste leerdoel op voor scoring
    if (data.gerichtLeerdoel) vraagLeerdoelen[socraticAnswerCount] = data.gerichtLeerdoel;
    const aiText = data.text || 'Kun je dat verder uitleggen?';
    showTyping(false);
    chatMessages.push({ role: 'assistant', content: aiText });
    addChatBubble('ai', aiText);
    questionCount++;
    updateProgress();
  } catch(e) {
    showTyping(false);
    addChatBubble('ai', 'Er is een fout opgetreden. Probeer het opnieuw.');
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  addChatBubble('user', text);
  chatMessages.push({ role: 'user', content: text });
  const btn = document.getElementById('chat-send-btn');
  btn.disabled = true;

  if (chatPhase === 'opening') {
    // Openingsvraag beantwoord — geen score, ga naar Socratisch
    chatPhase = 'socratic';
    await askNextQuestion();
    btn.disabled = false;
    return;
  }

  // Socratische fase: score ophalen
  let scoreData = null;
  try {
    scoreData = await apiFetch('/api/ai/score', {
      method: 'POST',
      body: JSON.stringify({
        lessonName:      selectedLesson.name,
        lessonContent:   selectedLesson.content,
        question:        chatMessages.length >= 2 ? chatMessages[chatMessages.length - 2].content : '',
        answer:          text,
        gerichtLeerdoel: vraagLeerdoelen[socraticAnswerCount] || null
      })
    });
  } catch(e) { console.error('Score ophalen mislukt:', e); }

  if (scoreData) {
    studentScores.push(scoreData);
    addScoreCard(scoreData);
    await new Promise(r => setTimeout(r, 700));
  }

  socraticAnswerCount++;

  if (socraticAnswerCount >= MAX_QUESTIONS) {
    // 3 vragen beantwoord → samenvatting genereren
    chatPhase = 'summary';
    document.getElementById('chat-input-row').style.display = 'none';
    await generateChatSummary();
  } else {
    await askNextQuestion();
  }

  btn.disabled = false;
}

async function generateChatSummary() {
  document.getElementById('chat-summary-loading').style.display = 'block';
  let summaryText = '';
  try {
    const data = await apiFetch('/api/ai/summary', {
      method: 'POST',
      body: JSON.stringify({
        lessonName:    selectedLesson.name,
        lessonContent: selectedLesson.content,
        studentName,
        messages:      chatMessages,
        scores:        studentScores
      })
    });
    summaryText = data.text || '';
  } catch(e) {
    summaryText = 'Bedankt voor het gesprek! Je hebt de vragen beantwoord.';
  }

  document.getElementById('chat-summary-loading').style.display = 'none';

  // Toon samenvatting als AI-bubble
  if (summaryText) {
    chatMessages.push({ role: 'assistant', content: summaryText });
    addChatBubble('ai', summaryText);
  }

  // Toon totaalscore
  await new Promise(r => setTimeout(r, 600));
  const totaal = studentScores.reduce((s, x) => s + (x.score || 0), 0);
  const maxScore = MAX_QUESTIONS * 10;
  const pct = Math.round((totaal / maxScore) * 100);
  const scoreColor = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--orange)' : 'var(--red)';

  document.getElementById('chat-final-score').innerHTML =
    '<span style="color:' + scoreColor + ';">' + totaal + '</span>' +
    '<span style="font-size:1.1rem;color:var(--muted);font-weight:400;">/' + maxScore + '</span>';
  document.getElementById('chat-score-bar').style.width = pct + '%';
  document.getElementById('chat-score-bar').style.background = scoreColor;
  const detailParts = studentScores.map((s, i) => 'V' + (i + 1) + ': ' + (s.score || 0) + '/10');
  document.getElementById('chat-score-detail').textContent = detailParts.join(' · ');
  document.getElementById('chat-score-area').style.display = 'block';
  document.getElementById('chat-score-area').scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function chatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
}

function showTyping(show) {
  document.getElementById('typing-indicator').style.display = show ? 'block' : 'none';
  if (show) document.getElementById('typing-indicator').scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// ═══════════════════════════════════════════════════════════
//  FINISH + REFLECTION
// ═══════════════════════════════════════════════════════════
async function finishChat() {
  showScreen('screen-reflection');
  document.getElementById('reflection-student-name-sub').textContent = `${studentName} · ${selectedLesson.name}`;
  document.getElementById('reflection-loading').style.display = 'block';
  document.getElementById('reflection-content').style.display = 'none';

  let understanding = 'matig';
  let reflGoed = '';
  let reflVerbeteren = '';

  try {
    const parsed = await apiFetch('/api/ai/reflection', {
      method: 'POST',
      body: JSON.stringify({
          messages:      chatMessages,
          lessonName:    selectedLesson?.name    || '',
          lessonContent: selectedLesson?.content || ''
        })
    });
    reflGoed       = parsed.goed       || 'Je hebt meegedaan aan het gesprek.';
    reflVerbeteren = parsed.verbeteren || 'Bestudeer de kernbegrippen van de les opnieuw.';
    const niveauMap = { 1: 'onvoldoende', 2: 'beginnend', 3: 'begrijpend', 4: 'toepassend', 5: 'analyserend', 6: 'verdiept' };
    understanding = niveauMap[parsed.niveau] || 'begrijpend';
  } catch {
    reflGoed = 'Je hebt het gesprek doorlopen en aandacht besteed aan de stof.';
    reflVerbeteren = 'Lees de kernbegrippen van de les nog eens door en probeer ze te koppelen aan voorbeelden.';
  }

  // Bereken genormaliseerde score (0–100) voor socratisch gesprek
  const avgScore10 = studentScores.length
    ? studentScores.reduce((s, x) => s + (x.score || 0), 0) / studentScores.length
    : null;
  const scoreNorm = avgScore10 !== null ? avgScore10 * 10 : null;

  // Sla op via uniforme platform-opslag
  currentResultId = 'result_' + Date.now();
  await saveUniformResult({
    lesvorm:    selectedLesvorm || 'socratisch',
    scoreNorm,
    lesvormData: {
      messages:       chatMessages,
      scores:         studentScores,
      leerdoel_scores: studentScores.map((s, i) => ({
        vraagnr:  i + 1,
        score:    s.score,
        leerdoel: s.leerdoel || vraagLeerdoelen[i] || null
      })),
    },
    extraFields: {
      // Backwards-compatibele velden — blijven gewoon opgeslagen
      understanding,
      refl_goed:       reflGoed,
      refl_verbeteren: reflVerbeteren,
      messages:        chatMessages,
      scores:          studentScores,
    }
  });

  // Store globally for opgaven step
  currentUnderstanding = understanding;
  currentReflGoed      = reflGoed;
  currentReflVerbeteren = reflVerbeteren;

  document.getElementById('reflection-good-text').textContent = reflGoed;
  document.getElementById('reflection-improve-text').textContent = reflVerbeteren;
  document.getElementById('reflection-loading').style.display = 'none';
  document.getElementById('reflection-content').style.display = 'block';

  // Totaalscore tonen
  if (studentScores.length > 0) {
    const totaal = studentScores.reduce((s, x) => s + (x.score || 0), 0);
    const maxScore = MAX_QUESTIONS * 10;
    const pct = Math.round((totaal / maxScore) * 100);
    const scoreColor = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--orange)' : 'var(--red)';
    document.getElementById('totaalscore-getal').innerHTML = totaal + '<span class="totaalscore-max">/' + maxScore + '</span>';
    document.getElementById('totaalscore-getal').style.color = scoreColor;
    document.getElementById('totaalscore-bar').style.width = pct + '%';
    document.getElementById('totaalscore-bar').style.background = scoreColor;
    const detailParts = studentScores.map((s, i) => 'V' + (i+1) + ': ' + (s.score||0) + '/10');
    document.getElementById('totaalscore-detail').textContent = detailParts.join(' · ');
    document.getElementById('reflection-totaalscore').style.display = 'block';
  }

  // Niveau badge
  const niveauConfig = {
    onvoldoende: { emoji: '❌', label: 'Onvoldoende',  desc: 'Kernbegrippen zijn nog niet helder — begin bij de basis.',        bg: 'rgba(192,57,43,0.12)',   color: 'var(--red)'    },
    beginnend:   { emoji: '🌱', label: 'Beginnend',    desc: 'Je kent de begrippen, maar toepassing lukt nog niet goed.',       bg: 'rgba(212,130,10,0.12)',  color: 'var(--orange)' },
    begrijpend:  { emoji: '📖', label: 'Begrijpend',   desc: 'Je begrijpt de stof, maar maakt nog verbanden op herkenning.',    bg: 'rgba(139,195,74,0.15)',  color: '#6d9e35'       },
    toepassend:  { emoji: '🔄', label: 'Toepassend',   desc: 'Je kunt de kennis toepassen — met wat sturing kom je er goed.',   bg: 'rgba(46,139,74,0.12)',   color: 'var(--green)'  },
    analyserend: { emoji: '🔍', label: 'Analyserend',  desc: 'Sterk werk! Je ontleedt situaties en ziet oorzaak-gevolg.',       bg: 'rgba(0,122,122,0.12)',   color: 'var(--accent)' },
    verdiept:    { emoji: '💡', label: 'Verdiept',     desc: 'Uitstekend! Je redeneert vanuit meerdere perspectieven.',         bg: 'rgba(90,74,138,0.15)',   color: 'var(--purple)' },
  };
  const nc = niveauConfig[understanding] || niveauConfig['begrijpend'];
  const badge = document.getElementById('reflection-niveau-label');
  badge.textContent = nc.emoji + ' ' + nc.label;
  badge.style.background = nc.bg;
  badge.style.color = nc.color;
  badge.style.border = '1.5px solid ' + nc.color;
  document.getElementById('reflection-niveau-desc').textContent = nc.desc;

  // Show correct buttons — only niveau 6 (verdiept) skips opgaven
  const skipOpgaven = understanding === 'verdiept';
  document.getElementById('btn-naar-opgaven').style.display = skipOpgaven ? 'none'        : 'block';
  document.getElementById('btn-nog-een-les').style.display  = skipOpgaven ? 'inline-flex' : 'none';
}

async function doAnotherLesson() {
  showScreen('screen-choose-lesson');
  await loadLessonsForStudent();
}

// ═══════════════════════════════════════════════════════════
//  OPGAVEN
// ═══════════════════════════════════════════════════════════
function gaNaarOpgaven() {
  showScreen('screen-opgaven');
  document.getElementById('opgaven-lesson-topbar').textContent = selectedLesson ? selectedLesson.name : '';
  document.getElementById('opgaven-les-titel').textContent = selectedLesson ? selectedLesson.name : 'Oefenen';
  document.getElementById('opgaven-loading').style.display   = 'block';
  document.getElementById('opgaven-uitstekend').style.display = 'none';
  document.getElementById('opgaven-content').style.display   = 'none';
  document.getElementById('opgaven-feedback').style.display  = 'none';

  if (currentUnderstanding === 'verdiept') {
    document.getElementById('opgaven-loading').style.display   = 'none';
    document.getElementById('opgaven-uitstekend').style.display = 'block';
    return;
  }
  generateOpgaven();
}

async function generateOpgaven() {
  try {
    opgavenData = await apiFetch('/api/ai/opgaven', {
      method: 'POST',
      body: JSON.stringify({
        lessonName:      selectedLesson.name,
        lessonContent:   selectedLesson.content,
        studentName,
        understanding:   currentUnderstanding,
        reflGoed:        currentReflGoed,
        reflVerbeteren:  currentReflVerbeteren,
        messages:        chatMessages
      })
    });
  } catch(e) {
    document.getElementById('opgaven-loading').style.display = 'none';
    document.getElementById('opgaven-error').textContent = 'Opgaven laden mislukt: ' + e.message;
    document.getElementById('opgaven-error').style.display = 'block';
    document.getElementById('opgaven-content').style.display = 'block';
    return;
  }

  // Render opgaven
  document.getElementById('opgaven-context-text').textContent = opgavenData.context || '';
  const container = document.getElementById('opgaven-vragen-container');
  container.innerHTML = '';
  (opgavenData.vragen || []).forEach((v, i) => {
    const card = document.createElement('div');
    card.className = 'opgave-vraag-card';
    card.innerHTML =
      '<div class="opgave-vraag-nr">Vraag ' + (i + 1) + '</div>' +
      '<p class="opgave-vraag-text">' + escHtml(v.vraag) + '</p>' +
      '<textarea id="opgave-antwoord-' + i + '" placeholder="Schrijf hier jouw antwoord..." rows="4" ' +
      'style="width:100%;background:#f4f7f5;border:1.5px solid var(--border);border-radius:8px;padding:0.7rem 1rem;' +
      'font-family:Georgia,serif;font-size:0.93rem;color:var(--text);outline:none;resize:vertical;"></textarea>';
    container.appendChild(card);
  });

  document.getElementById('opgaven-loading').style.display = 'none';
  document.getElementById('opgaven-content').style.display = 'block';
}

async function submitOpgaven() {
  const btn = document.getElementById('opgaven-submit-btn');
  const err = document.getElementById('opgaven-error');
  err.style.display = 'none';

  // Collect answers
  const antwoorden = (opgavenData.vragen || []).map((v, i) => {
    const el = document.getElementById('opgave-antwoord-' + i);
    return el ? el.value.trim() : '';
  });

  if (antwoorden.some(a => !a)) {
    err.textContent = 'Beantwoord alle vragen voordat je inlevert.';
    err.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Nakijken...';

  let feedbackData;
  try {
    feedbackData = await apiFetch('/api/ai/opgaven-feedback', {
      method: 'POST',
      body: JSON.stringify({
        lessonName:    selectedLesson.name,
        lessonContent: selectedLesson.content,
        context:       opgavenData.context,
        vragen:        opgavenData.vragen,
        antwoorden
      })
    });
  } catch(e) {
    err.textContent = 'Nakijken mislukt: ' + e.message;
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Controleer mijn antwoorden →';
    return;
  }

  // Save opgaven + answers to result
  if (currentResultId) {
    try {
      await apiFetch('/api/results/' + currentResultId + '/opgaven', {
        method: 'PATCH',
        body: JSON.stringify({
          opgaven: { context: opgavenData.context, vragen: opgavenData.vragen },
          opgaven_antwoorden: antwoorden,
          opgaven_feedback:   feedbackData.feedback || []
        })
      });
    } catch(e) { console.error('Opgaven opslaan mislukt:', e); }
  }

  // Render feedback
  const fbContainer = document.getElementById('opgaven-feedback-items');
  fbContainer.innerHTML = '';
  (feedbackData.feedback || []).forEach((fb, i) => {
    const score = (fb.score || '').toLowerCase();
    const cls = score === 'goed' ? 'correct' : score === 'gedeeltelijk' ? 'partial' : 'incorrect';
    const labelText = score === 'goed' ? '✅ Goed!' : score === 'gedeeltelijk' ? '〰️ Gedeeltelijk' : '❌ Nog niet goed';
    const card = document.createElement('div');
    card.className = 'opgave-feedback-card ' + cls;
    card.innerHTML =
      '<div class="opgave-feedback-label ' + cls + '">Vraag ' + (i + 1) + ' — ' + labelText + '</div>' +
      '<p style="font-size:0.9rem;font-weight:600;color:var(--text);margin-bottom:0.5rem;">' + escHtml((opgavenData.vragen[i] || {}).vraag || '') + '</p>' +
      '<div class="opgave-antwoord-box"><strong style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;">Jouw antwoord:</strong><br>' + escHtml(antwoorden[i] || '') + '</div>' +
      '<div style="font-size:0.88rem;color:var(--text2);margin-bottom:0.5rem;">' + escHtml(fb.feedback || '') + '</div>' +
      '<div class="opgave-modelantwoord"><strong style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--green);">Modelantwoord:</strong><br>' + escHtml((opgavenData.vragen[i] || {}).modelantwoord || '') + '</div>';
    fbContainer.appendChild(card);
  });

  document.getElementById('opgaven-content').style.display = 'none';
  document.getElementById('opgaven-feedback').style.display = 'block';
}



// ═══════════════════════════════════════════════════════════
// ── Hulpfunctie: geef beschikbare lesvormen voor een les ──
// ═══════════════════════════════════════════════════════════
