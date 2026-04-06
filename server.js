const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

app.get('/', (req, res) => res.json({ status: 'ok', app: 'Socratische Toetsapp' }));

// KLASSEN
app.get('/api/classes', async (req, res) => {
  const { data, error } = await supabase.from('classes').select('*').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.post('/api/classes', async (req, res) => {
  const { id, name, created_at } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'Velden ontbreken' });
  const { data, error } = await supabase.from('classes').insert([{ id, name, created_at }]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});
app.delete('/api/classes/:id', async (req, res) => {
  await supabase.from('lessons').update({ class_id: null }).eq('class_id', req.params.id);
  const { error } = await supabase.from('classes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// LESSEN
app.get('/api/lessons', async (req, res) => {
  let query = supabase.from('lessons').select('*').order('created_at', { ascending: false });
  if (req.query.class_id) query = query.eq('class_id', req.query.class_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.post('/api/lessons', async (req, res) => {
  const { id, name, content, leerdoelen, chapter_val, created_at, class_id,
          toegestane_lesvormen, lesvorm_mode } = req.body;
  if (!id || !name || !content) return res.status(400).json({ error: 'Velden ontbreken' });
  const record = {
    id, name, content, created_at,
    leerdoelen:           leerdoelen   || null,
    chapter_val:          chapter_val  || null,
    class_id:             class_id     || null,
    // Fase 2: lesvorminstellingen
    toegestane_lesvormen: toegestane_lesvormen || ['socratisch'],
    lesvorm_mode:         lesvorm_mode || 'locked',
  };
  const { data, error } = await supabase.from('lessons').insert([record]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});
app.delete('/api/lessons/:id', async (req, res) => {
  await supabase.from('results').delete().eq('lesson_id', req.params.id);
  const { error } = await supabase.from('lessons').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// RESULTATEN
app.get('/api/results', async (req, res) => {
  const { data, error } = await supabase.from('results').select('*').order('timestamp', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.get('/api/results/:lessonId', async (req, res) => {
  let query = supabase.from('results').select('*').eq('lesson_id', req.params.lessonId).order('timestamp', { ascending: false });
  if (req.query.class_id) query = query.eq('class_id', req.query.class_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.post('/api/results', async (req, res) => {
  const {
    id, lesson_id, lesson_name, student_name, class_id, class_name,
    understanding, refl_goed, refl_verbeteren, messages, scores, leerdoel_scores, timestamp,
    // Nieuwe platformvelden (Fase 1):
    lesvorm, score_norm, lesvorm_data,
  } = req.body;
  if (!id || !lesson_id || !student_name) return res.status(400).json({ error: 'Velden ontbreken' });
  const record = {
    id, lesson_id, lesson_name, student_name,
    class_id:        class_id    || null,
    class_name:      class_name  || null,
    understanding,   refl_goed,   refl_verbeteren,
    messages,
    scores:          scores          || null,
    leerdoel_scores: leerdoel_scores || null,
    timestamp,
    // Platformvelden — backwards-compatible: valt terug op 'socratisch' als lesvorm ontbreekt
    lesvorm:      lesvorm      || 'socratisch',
    score_norm:   score_norm   != null ? score_norm : null,
    lesvorm_data: lesvorm_data || null,
  };
  const { data, error } = await supabase.from('results').insert([record]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});
app.patch('/api/results/:id/opgaven', async (req, res) => {
  const { opgaven, opgaven_antwoorden, opgaven_feedback } = req.body;
  const { error } = await supabase.from('results').update({ opgaven, opgaven_antwoorden, opgaven_feedback }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// AI: SOCRATISCHE VRAAG
app.post('/api/ai/question', async (req, res) => {
  const { lessonName, lessonContent, leerdoelen, studentName, questionNumber, maxQuestions, messages, isOpening } = req.body;

  // Kies een focusleerdoel op basis van vraagnummer
  let focusLeerdoel = null;
  if (!isOpening && leerdoelen) {
    const kennen = leerdoelen.kennen || [];
    const kunnen = leerdoelen.kunnen || [];
    // V1 → eerste kennen-begrip, V2 → eerste kunnen-item, V3 → tweede kunnen-item (of laatste kennen)
    if (questionNumber === 0 && kennen.length > 0)      focusLeerdoel = { type: 'kennen', tekst: kennen[0] };
    else if (questionNumber === 1 && kunnen.length > 0)  focusLeerdoel = { type: 'kunnen', tekst: kunnen[0] };
    else if (questionNumber === 2 && kunnen.length > 1)  focusLeerdoel = { type: 'kunnen', tekst: kunnen[1] };
    else if (kunnen.length > 0)                          focusLeerdoel = { type: 'kunnen', tekst: kunnen[Math.min(questionNumber, kunnen.length - 1)] };
    else if (kennen.length > 0)                          focusLeerdoel = { type: 'kennen', tekst: kennen[Math.min(questionNumber, kennen.length - 1)] };
  }

  const leerdoelenContext = leerdoelen
    ? `\n\nLeerdoelen van deze les:\nKennen: ${(leerdoelen.kennen||[]).slice(0,6).join(', ')}\nKunnen (toepassing): ${(leerdoelen.kunnen||[]).slice(0,4).map(k => k.substring(0,80)).join(' | ')}`
    : '';

  const focusTekst = focusLeerdoel
    ? `\n\nFocus voor deze vraag: "${focusLeerdoel.tekst}" — stel een vraag die precies dit leerdoel toetst.`
    : '';

  const systemPrompt = isOpening
    ? `Je bent een Socratische gesprekspartner voor een economieles op VWO-niveau.
Les: "${lessonName}"
Kernstof: "${lessonContent}"${leerdoelenContext}
Leerling: ${studentName}
Stel één open openingsvraag: vraag de leerling in eigen woorden uit te leggen wat zij/hij van deze les heeft begrepen. Geen ja/nee vraag. Wees uitnodigend. Max 2 zinnen.`
    : `Je bent een Socratische gesprekspartner voor een economieles op VWO-niveau.
Les: "${lessonName}"
Kernstof: "${lessonContent}"${leerdoelenContext}${focusTekst}
Leerling: ${studentName}
Dit is Socratische vraag ${questionNumber + 1} van ${maxQuestions}.
Stel één gerichte vervolgvraag die ingaat op het antwoord van de leerling EN het opgegeven focusleerdoel toetst.
Vraag naar redenering, oorzaak-gevolg, toepassingen of uitzonderingen — nooit naar losse feitjes.
Wees warm en aanmoedigend. Max 2 zinnen. Spreek de leerling aan met je/jij.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: messages || []
    });
    res.json({
      text: response.content[0].text,
      gerichtLeerdoel: focusLeerdoel   // stuur terug zodat frontend het kan opslaan
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI: REFLECTIE
app.post('/api/ai/reflection', async (req, res) => {
  const { messages, lessonName, lessonContent } = req.body;

  // Parseer leerdoelen uit lessonContent als die gestructureerd is
  let leerdoelenTekst = '';
  if (lessonContent && lessonContent.includes('Kennen:')) {
    leerdoelenTekst = `\n\nDe les had de volgende leerdoelen:\n${lessonContent}`;
  } else if (lessonContent) {
    leerdoelenTekst = `\n\nKernstof van de les: ${lessonContent}`;
  }

  const systemPrompt = `Je bent een economieleraar die een Socratisch gesprek analyseert en de leerling gerichte, persoonlijke feedback geeft.
${lessonName ? `Les: "${lessonName}"` : ''}${leerdoelenTekst}

Antwoord ALLEEN met geldige JSON, geen tekst daarbuiten:
{
  "niveau": <getal 1 t/m 6>,
  "goed": "...",
  "verbeteren": "..."
}

── BLOOM-NIVEAUS (wees streng en realistisch) ──────────────────
1 = Onvoldoende:  Nauwelijks begrip, antwoorden zijn onsamenhangend of onjuist
2 = Beginnend:    Herkent begrippen maar kan ze niet uitleggen of toepassen
3 = Begrijpend:   Begrijpt de stof, legt verbanden op basis van herkenning maar niet zelfstandig
4 = Toepassend:   Past kennis toe op nieuwe situaties, met enige sturing
5 = Analyserend:  Ontleedt situaties zelfstandig, herkent oorzaak-gevolgrelaties
6 = Verdiept:     Redeneert vanuit meerdere perspectieven, beoordeelt en nuanceert

── REGELS VOOR "goed" (TOP) ────────────────────────────────────
VERPLICHT: Citeer letterlijk een uitspraak die de leerling deed — tussen aanhalingstekens, zo exact mogelijk overgenomen uit het gesprek.
Leg in 1-2 zinnen uit waarom díé specifieke redenering klopt en wat het aantoont over het begrip van de leerling.
VERBODEN: vage zinnen als "je begrijpt de stof goed", "je hebt goed nagedacht" of "je legt verbanden". Alleen concrete citaten + uitleg.

── REGELS VOOR "verbeteren" (TIP) ──────────────────────────────
VERPLICHT stap 1 — Wijs een concreet moment aan: beschrijf kort op welk moment in het gesprek de redenering haakte of een leerdoel onvoldoende aan bod kwam. Gebruik de vraag van de AI als aanknopingspunt ("Toen ik vroeg naar...").
VERPLICHT stap 2 — Koppel aan een leerdoel: benoem expliciet welk begrip of welke vaardigheid uit de les de leerling verder moet oefenen. Gebruik de termen uit de leerdoelenlijst als die beschikbaar is.
VERPLICHT stap 3 — Geef een concrete oefenvraag die de leerling zelf kan beantwoorden om dat leerdoel te oefenen. De oefenvraag moet zo specifiek zijn dat de leerling weet wat het goede antwoord moet bevatten.
VERBODEN: algemene adviezen als "lees de stof nog eens door" of "oefen meer met begrippen". Altijd concreet.

Schrijf warm maar direct. Spreek de leerling aan met je/jij. Maximaal 3 zinnen per veld.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages
    });
    const parsed = JSON.parse(response.content[0].text.replace(/```json|```/g, '').trim());
    res.json(parsed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI: OPGAVEN GENEREREN
app.post('/api/ai/opgaven', async (req, res) => {
  const { lessonName, lessonContent, studentName, understanding, reflGoed, reflVerbeteren } = req.body;
  const niveauTekst = {
    onvoldoende: 'Stel toegankelijke vragen die kernconcepten toetsen en stap voor stap opbouwen.',
    matig: 'Stel vragen die concepten verbinden en laten toepassen op een situatie.',
    goed: 'Stel vragen die hogere-orde denken vereisen: analyse en evaluatie.'
  }[understanding] || 'Stel passende oefenvragen.';

  const systemPrompt = `Je bent een ervaren economieleraar die oefenopgaven maakt voor middelbareschoolleerlingen.
Les: "${lessonName}"
Kernstof: "${lessonContent}"
Begrip leerling: ${understanding}
Wat goed ging: ${reflGoed}
Wat verdieping nodig heeft: ${reflVerbeteren}
Niveau-instructie: ${niveauTekst}

Maak een opgave met een realistische context (3-5 zinnen) en precies 3 vragen:
- Vraag 1: toegankelijk, toetst basiskennis
- Vraag 2: vereist redenering en toepassing op de context  
- Vraag 3: uitdagend, vraagt om analyse of evaluatie
Geef bij elke vraag een modelantwoord van 2-4 zinnen.

Antwoord ALLEEN met JSON:
{
  "context": "...",
  "vragen": [
    { "vraag": "...", "modelantwoord": "..." },
    { "vraag": "...", "modelantwoord": "..." },
    { "vraag": "...", "modelantwoord": "..." }
  ]
}`;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 1400, system: systemPrompt,
      messages: [{ role: 'user', content: 'Genereer de opgave voor ' + studentName + '.' }]
    });
    const parsed = JSON.parse(response.content[0].text.replace(/```json|```/g, '').trim());
    res.json(parsed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI: OPGAVEN NAKIJKEN
app.post('/api/ai/opgaven-feedback', async (req, res) => {
  const { lessonName, context, vragen, antwoorden } = req.body;
  const vragenTekst = vragen.map((v, i) =>
    `Vraag ${i+1}: ${v.vraag}\nModelantwoord: ${v.modelantwoord}\nAntwoord leerling: ${antwoorden[i] || '(geen antwoord)'}`
  ).join('\n\n');
  const systemPrompt = `Je bent een economieleraar die antwoorden nakijkt voor de les "${lessonName}".
Context: "${context}"

${vragenTekst}

Beoordeel elk antwoord. Geef per vraag:
- "score": exact "goed", "gedeeltelijk" of "incorrect"
- "feedback": 1-2 zinnen. Bij goed: bevestig. Bij gedeeltelijk: benoem wat goed is en wat mist. Bij incorrect: leg vriendelijk uit wat het juiste antwoord inhoudt.

Antwoord ALLEEN met JSON:
{ "feedback": [
  { "score": "...", "feedback": "..." },
  { "score": "...", "feedback": "..." },
  { "score": "...", "feedback": "..." }
]}`;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 900, system: systemPrompt,
      messages: [{ role: 'user', content: 'Kijk de antwoorden na.' }]
    });
    const parsed = JSON.parse(response.content[0].text.replace(/```json|```/g, '').trim());
    res.json(parsed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════
//  AI — ANTWOORD SCOREN (1-10)
// ══════════════════════════════════════════════════════════

app.post('/api/ai/score', async (req, res) => {
  const { lessonName, lessonContent, question, answer, gerichtLeerdoel } = req.body;

  const systemPrompt = `Je bent een ervaren economieleraar op een Nederlandse middelbare school (VWO) die een mondeling antwoord van een leerling beoordeelt.

Les: "${lessonName}"
Kernstof: "${lessonContent}"
Gestelde vraag: "${question}"
Antwoord van de leerling: "${answer}"

BELANGRIJK KADER: Dit is een VWO-leerling van 15-18 jaar die mondeling reageert in een gesprek. 
Beoordeel op het niveau van een goede VWO-leerling, NIET op universitair niveau.
Een leerling hoeft geen perfecte vakterm te gebruiken als de redenering klopt.
Geef het voordeel van de twijfel als de kern van het antwoord juist is.

Weeg als volgt:
- Redenering (60%): Klopt de logische redenering? Begrijpt de leerling het oorzaak-gevolg?
- Begrip (30%): Toont het antwoord begrip van de stof, ook zonder perfecte vaktermen?
- Diepgang (10%): Gaat het iets verder dan alleen herhalen?

Schaal voor VWO-niveau:
9-10: Uitstekend — klopt volledig, goede redenering, zelfstandig geformuleerd
7-8:  Goed — grotendeels correct, kern klopt, kleine onvolledigheid
5-6:  Redelijk — basisidee klopt maar mist een belangrijke stap of nuance
3-4:  Matig — deels op het goede spoor maar duidelijke fout in de redenering
1-2:  Onvoldoende — fundamenteel incorrect of volledig buiten de vraag

Geef een motivatie van maximaal 1 zin. Noem iets concreets uit het antwoord.
Spreek de leerling aan met je/jij. Wees aanmoedigend in toon.

Antwoord ALLEEN met JSON:
{ "score": <getal 1-10>, "motivatie": "..." }`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Beoordeel dit antwoord.' }]
    });
    const parsed = JSON.parse(response.content[0].text.replace(/```json|```/g, '').trim());
    // Clamp score tussen 1 en 10
    parsed.score = Math.max(1, Math.min(10, parseInt(parsed.score) || 5));
    if (gerichtLeerdoel) parsed.leerdoel = gerichtLeerdoel;
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── TOETSAGENT: GENEREER TOETS ──────────────────────────────────────────────
app.post('/api/agent/genereer-toets', async (req, res) => {
  const {
    klas,         // bijv. "VWO 5A"
    toetstype,    // "so" | "pw" | "ce-prep"
    hoofdstukken, // [{ val, label, lesbrief, n_total, n_ce }]
    nVragen,      // aantal vragen (getal of null)
    duur,         // minuten (getal of null)
    punten,       // totaal punten (getal of null)
    gapData       // { lesStats, lowLessons, totalStudents, overallAvg } of null
  } = req.body;

  if (!klas || !hoofdstukken || hoofdstukken.length === 0) {
    return res.status(400).json({ error: 'Klas en hoofdstukken zijn verplicht.' });
  }

  const toetsTypeLabel = { so: 'Schriftelijke overhoring (SO)', pw: 'Proefwerk', 'ce-prep': 'CE-voorbereiding' }[toetstype] || toetstype;
  const aantalVragen   = nVragen  || Math.min(hoofdstukken.length * 2, 8);
  const totaalPunten   = punten   || aantalVragen * 5;
  const toetsDuur      = duur     || (toetstype === 'so' ? 30 : toetstype === 'pw' ? 60 : 90);

  // Hiatencontext
  let hiatenTekst = 'Er zijn geen eerdere Toetsapp-resultaten beschikbaar voor deze klas.';
  let hiatenLessen = [];
  if (gapData && gapData.lesStats && gapData.lesStats.length > 0) {
    hiatenLessen = gapData.lowLessons || [];
    const top3Laag = gapData.lesStats.slice(0, 3);
    hiatenTekst = `Gemiddelde klassecore: ${gapData.overallAvg.toFixed(1)}/10 (${gapData.totalStudents} leerlingen, ${gapData.totalResults || '?'} resultaten).\n`;
    hiatenTekst += `Lessen met laagste scores (meeste aandacht nodig):\n`;
    top3Laag.forEach(l => { hiatenTekst += `- "${l.name}": gemiddeld ${l.avg.toFixed(1)}/10\n`; });
    if (hiatenLessen.length > 0) {
      hiatenTekst += `\nGeef vragen uit deze lessen EXTRA gewicht in de toets.`;
    }
  }

  // Hoofdstukkenlijst
  const hfstTekst = hoofdstukken.map(h =>
    `- ${h.label} (${h.lesbrief}) — ${h.n_total} leerdoelen, ${h.n_ce} in CE-syllabus`
  ).join('\n');

  const systemPrompt = `Je bent een ervaren economieleraar op een VWO-school in Nederland. Je genereert professionele toetsvragen voor klas ${klas}.

REGELS:
- Gebruik alleen stof uit de opgegeven behandelde hoofdstukken. Toets NOOIT stof die niet in de lijst staat.
- Sluit aan bij het eindexamenprogramma Economie (CE-syllabus 2026) waar relevant.
- Vragen zijn op VWO-niveau: helder geformuleerd, economisch correct, passend bij ${toetsTypeLabel}.
- Mix van vraagtypen: open vragen, berekeningsvragen en contextvragen (met een korte situatieschets).
- Verdeel punten realistisch: berekeningsvragen en analysevragen krijgen meer punten.
- Bij CE-voorbereiding: formuleer vragen in CE-stijl (meerkeuze en open gemengd).
- Geef bij elke vraag een beknopt correctiemodel (maximaal 3 zinnen).

ANTWOORDFORMAAT — reageer ALLEEN met geldige JSON, geen uitleg daarbuiten:
{
  "samenvatting": "één zin over de focus van deze toets",
  "vragen": [
    {
      "nr": 1,
      "type": "open" | "berekening" | "context" | "meerkeuze",
      "vraag": "...",
      "context": "korte situatieschets indien van toepassing, anders null",
      "opties": ["A. ...", "B. ...", "C. ...", "D. ..."] of null (alleen bij meerkeuze),
      "antwoord_mc": "A" of null,
      "punten": <getal>,
      "leerdoel": "het leerdoel dat getoetst wordt",
      "lesbrief": "naam van de lesbrief",
      "ce_eindterm": "CE-eindterm indien van toepassing, anders null",
      "bloom": "Kennen" | "Begrijpen" | "Toepassen" | "Analyseren" | "Evalueren",
      "correctiemodel": "beknopte beschrijving van het verwachte antwoord"
    }
  ]
}`;

  const userPrompt = `Genereer een ${toetsTypeLabel} voor ${klas}.

SPECIFICATIES:
- Aantal vragen: ${aantalVragen}
- Totaal punten: ${totaalPunten}
- Duur: ${toetsDuur} minuten

BEHANDELDE HOOFDSTUKKEN (alleen hieruit toetsen):
${hfstTekst}

HIATENANALYSE UIT SOCRATISCHE TOETSAPP:
${hiatenTekst}

Genereer precies ${aantalVragen} vragen. De puntentelling moet optellen tot ${totaalPunten}.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const raw    = response.content[0].text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);

    // Valideer en clamp punten
    const totaalCheck = parsed.vragen.reduce((s, v) => s + (v.punten || 0), 0);
    res.json({
      ok: true,
      klas,
      toetstype: toetsTypeLabel,
      duur: toetsDuur,
      totaalPunten: totaalCheck,
      samenvatting: parsed.samenvatting,
      vragen: parsed.vragen,
      meta: {
        aantalHoofdstukken: hoofdstukken.length,
        aantalLeerlingen: gapData?.totalStudents || 0,
        hiatenLessen: hiatenLessen.map(l => l.name)
      }
    });
  } catch (e) {
    console.error('Toetsagent fout:', e.message);
    res.status(500).json({ error: e.message });
  }
});


// ═══════════════════════════════════════════════════════════
//  WIE IS DE MOL — ENDPOINTS
// ═══════════════════════════════════════════════════════════

// Hulpfuncties
function randCode(n, chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ── POST /api/mol/sessie — docent maakt sessie aan ──────────────────────────
app.post('/api/mol/sessie', async (req, res) => {
  try {
    const { les_id, les_naam, les_content, klas_id, klas_naam, n_rondes, leerlingen, groep_grootte, vragen, groepsindeling, timer_discussie, timer_stem } = req.body;

    const sessieId    = 'mol_' + Date.now();
    const docentCode  = randCode(6);
    const sessieCode  = randCode(4);

    // Groepen opbouwen — gebruik docent-indeling als aangeleverd, anders willekeurig
    const groepLabels = 'ABCDEFGHIJ'.split('');
    const groepen = [];
    const leerlingenRows = [];

    if (groepsindeling && groepsindeling.length > 0) {
      // Docent heeft groepen + Mol zelf bepaald
      groepsindeling.forEach((g, gi) => {
        const groepId = 'groep_' + sessieId + '_' + groepLabels[gi];
        groepen.push({ id: groepId, sessie_id: sessieId, naam: g.naam });
        g.leden.forEach(lid => {
          leerlingenRows.push({
            id:          'speler_' + sessieId + '_' + randCode(8),
            sessie_id:   sessieId,
            naam:        lid.naam,
            groep_id:    groepId,
            groep_naam:  g.naam,
            is_mol:      !!lid.isMol,
            speler_code: randCode(5),
            online_at:   null,
          });
        });
      });
    } else {
      // Willekeurige indeling + willekeurige Mol
      const geshuffled = [...leerlingen].sort(() => Math.random() - 0.5);
      for (let i = 0; i < geshuffled.length; i += groep_grootte) {
        const groepId  = 'groep_' + sessieId + '_' + groepLabels[groepen.length];
        const groepNaam = 'Groep ' + groepLabels[groepen.length];
        groepen.push({ id: groepId, sessie_id: sessieId, naam: groepNaam });
        const slice    = geshuffled.slice(i, i + groep_grootte);
        const molIndex = Math.floor(Math.random() * slice.length);
        slice.forEach((naam, idx) => {
          leerlingenRows.push({
            id:          'speler_' + sessieId + '_' + randCode(8),
            sessie_id:   sessieId,
            naam,
            groep_id:    groepId,
            groep_naam:  groepNaam,
            is_mol:      idx === molIndex,
            speler_code: randCode(5),
            online_at:   null,
          });
        });
      }
    }

    // Sessie opslaan
    const { error: sessieErr } = await supabase.from('mol_sessies').insert([{
      id: sessieId,
      les_id:      les_id   || null,
      les_naam:    les_naam || '',
      les_content: les_content || '',
      klas_id:     klas_id  || null,
      klas_naam:   klas_naam || '',
      n_rondes:    n_rondes || 3,
      groep_grootte,
      status:      'setup',
      huidige_ronde: 0,
      ronde_fase:   null,
      fase_gestart_op: null,
      timer_discussie: timer_discussie || 120,
      timer_stem:      timer_stem      || 60,
      sessie_code: sessieCode,
      docent_code: docentCode,
      created_at:  Date.now(),
    }]);
    if (sessieErr) return res.status(500).json({ error: sessieErr.message });

    // Groepen opslaan
    const groepRows = groepen.map(g => ({ id: g.id, sessie_id: sessieId, naam: g.naam }));
    const { error: groepErr } = await supabase.from('mol_groepen').insert(groepRows);
    if (groepErr) return res.status(500).json({ error: groepErr.message });

    // Leerlingen opslaan
    const { error: leerlingErr } = await supabase.from('mol_leerlingen').insert(leerlingenRows);
    if (leerlingErr) return res.status(500).json({ error: leerlingErr.message });

    // Sla vooraf gemaakte vragen op als die zijn meegegeven
    if (vragen && vragen.length > 0) {
      const caseRows = vragen.map(v => ({
        id:               `case_${sessieId}_r${v.ronde_nr}`,
        sessie_id:        sessieId,
        ronde_nr:         v.ronde_nr,
        vraag:            v.vraag || '',
        context:          v.context || '',
        correct_antwoord: 'correct',
        correct_uitleg:   v.correct_uitleg || '',
        fout_antwoord:    'fout',
        fout_uitleg:      v.fout_uitleg || '',
        vraagtype:                v.vraagtype || 'open',
        mc_opties:                (v.mc_opties && v.mc_opties.length > 0) ? v.mc_opties : null,
        timer_discussie_override: v.timer_discussie_override || null,
        timer_stem_override:      v.timer_stem_override      || null,
      }));
      await supabase.from('mol_cases').insert(caseRows);
    }

    res.json({ sessieId, sessieCode, docentCode, groepen: groepen.map(g => g.naam), aantalLeerlingen: leerlingenRows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ── GET /api/mol/sessies — docent haalt lijst van alle sessies op ────────────
app.get('/api/mol/sessies', async (req, res) => {
  try {
    const { docent_token } = req.query;
    if (docent_token !== process.env.TEACHER_TOKEN && docent_token !== 'leraar123') {
      return res.status(403).json({ error: 'Niet geautoriseerd' });
    }
    const { data, error } = await supabase
      .from('mol_sessies')
      .select('id, les_naam, status, created_at, sessie_code, docent_code, n_rondes, groep_grootte')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ── POST /api/mol/sessie/:id/hergebruik — reset groepen maar behoud cases ────
app.post('/api/mol/sessie/:id/hergebruik', async (req, res) => {
  try {
    const { docent_token, groepsindeling, n_rondes, groep_grootte } = req.body;
    if (docent_token !== process.env.TEACHER_TOKEN && docent_token !== 'leraar123') {
      return res.status(403).json({ error: 'Niet geautoriseerd' });
    }
    const sid = req.params.id;

    // Verwijder alleen student-gerelateerde data, behoud cases
    await supabase.from('mol_test_antwoorden').delete().eq('sessie_id', sid);
    await supabase.from('mol_groep_stemmen').delete().eq('sessie_id', sid);
    await supabase.from('mol_antwoorden').delete().eq('sessie_id', sid);
    await supabase.from('mol_briefing_klaar').delete().eq('sessie_id', sid);
    await supabase.from('mol_leerlingen').delete().eq('sessie_id', sid);
    await supabase.from('mol_groepen').delete().eq('sessie_id', sid);

    // Nieuwe groepen + leerlingen aanmaken
    const groepLabels = 'ABCDEFGHIJ'.split('');
    const nieuweGroepen = [];
    const nieuweLeerlingen = [];

    groepsindeling.forEach((g, gi) => {
      const groepId = 'groep_' + sid + '_new_' + Date.now() + '_' + gi;
      nieuweGroepen.push({ id: groepId, sessie_id: sid, naam: g.naam });
      g.leden.forEach(lid => {
        nieuweLeerlingen.push({
          id:          'speler_' + sid + '_' + randCode(8),
          sessie_id:   sid,
          naam:        lid.naam,
          groep_id:    groepId,
          groep_naam:  g.naam,
          is_mol:      !!lid.isMol,
          speler_code: randCode(5),
          online_at:   null,
        });
      });
    });

    await supabase.from('mol_groepen').insert(nieuweGroepen);
    await supabase.from('mol_leerlingen').insert(nieuweLeerlingen);

    // Reset sessie naar setup
    const updates = { status: 'setup', huidige_ronde: 0, ronde_fase: null, fase_gestart_op: null };
    if (n_rondes)    updates.n_rondes    = n_rondes;
    if (groep_grootte) updates.groep_grootte = groep_grootte;
    await supabase.from('mol_sessies').update(updates).eq('id', sid);

    res.json({ ok: true, aantalLeerlingen: nieuweLeerlingen.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/mol/sessie/:id/resultaten — volledige resultaten voor archief ───
app.get('/api/mol/sessie/:id/resultaten', async (req, res) => {
  try {
    const { docent_token } = req.query;
    if (docent_token !== process.env.TEACHER_TOKEN && docent_token !== 'leraar123') {
      return res.status(403).json({ error: 'Niet geautoriseerd' });
    }
    const sid = req.params.id;
    const [
      { data: sessie },
      { data: leerlingen },
      { data: groepen },
      { data: cases },
      { data: antwoorden },
      { data: groepStemmen },
      { data: testAntwoorden },
      { data: briefingKlaar },
      { data: groepVotes },
      { data: scores },
    ] = await Promise.all([
      supabase.from('mol_sessies').select('*').eq('id', sid).single(),
      supabase.from('mol_leerlingen').select('*').eq('sessie_id', sid),
      supabase.from('mol_groepen').select('*').eq('sessie_id', sid),
      supabase.from('mol_cases').select('*').eq('sessie_id', sid).order('ronde_nr'),
      supabase.from('mol_antwoorden').select('*').eq('sessie_id', sid),
      supabase.from('mol_groep_stemmen').select('*').eq('sessie_id', sid),
      supabase.from('mol_test_antwoorden').select('*').eq('sessie_id', sid),
      supabase.from('mol_briefing_klaar').select('*').eq('sessie_id', sid),
    ]);
    const { data: individuelScores } = await supabase.from('mol_scores').select('*').eq('sessie_id', sid);
    res.json({ sessie, leerlingen, groepen, cases, antwoorden, groepStemmen, testAntwoorden,
               briefingKlaar: briefingKlaar || [], scores: individuelScores || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/mol/sessie/:id — docent verwijdert sessie ────────────────────
app.delete('/api/mol/sessie/:id', async (req, res) => {
  try {
    const { docent_token } = req.query;
    if (docent_token !== process.env.TEACHER_TOKEN && docent_token !== 'leraar123') {
      return res.status(403).json({ error: 'Niet geautoriseerd' });
    }
    const sid = req.params.id;
    // Verwijder alle gerelateerde data in de juiste volgorde
    await supabase.from('mol_test_antwoorden').delete().eq('sessie_id', sid);
    await supabase.from('mol_groep_stemmen').delete().eq('sessie_id', sid);
    await supabase.from('mol_antwoorden').delete().eq('sessie_id', sid);
    await supabase.from('mol_cases').delete().eq('sessie_id', sid);
    await supabase.from('mol_leerlingen').delete().eq('sessie_id', sid);
    await supabase.from('mol_groepen').delete().eq('sessie_id', sid);
    const { error } = await supabase.from('mol_sessies').delete().eq('id', sid);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/mol/sessie/:id — volledige sessie state ────────────────────────
app.get('/api/mol/sessie/:id', async (req, res) => {
  try {
    const sid = req.params.id;
    const [
      { data: sessie },
      { data: leerlingen },
      { data: groepen },
      { data: cases },
      { data: antwoorden },
      { data: groepStemmen },
      { data: testAntwoorden },
      { data: briefingKlaar },
      { data: groepVotes },
      { data: scores },
    ] = await Promise.all([
      supabase.from('mol_sessies').select('*').eq('id', sid).single(),
      supabase.from('mol_leerlingen').select('*').eq('sessie_id', sid),
      supabase.from('mol_groepen').select('*').eq('sessie_id', sid),
      supabase.from('mol_cases').select('*').eq('sessie_id', sid).order('ronde_nr'),
      supabase.from('mol_antwoorden').select('*').eq('sessie_id', sid),
      supabase.from('mol_groep_stemmen').select('*').eq('sessie_id', sid),
      supabase.from('mol_test_antwoorden').select('*').eq('sessie_id', sid),
      supabase.from('mol_briefing_klaar').select('*').eq('sessie_id', sid),
      supabase.from('mol_groep_votes').select('*').eq('sessie_id', sid),
      supabase.from('mol_scores').select('*').eq('sessie_id', sid),
    ]);
    if (!sessie) return res.status(404).json({ error: 'Sessie niet gevonden' });
    res.json({ sessie, leerlingen, groepen, cases, antwoorden, groepStemmen, testAntwoorden,
               briefingKlaar: briefingKlaar || [], groepVotes: groepVotes || [],
               scores: scores || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/mol/login — leerling inloggen met speler-code ──────────────────
app.get('/api/mol/login', async (req, res) => {
  try {
    const { sessie_code, speler_code } = req.query;
    // Zoek sessie op code
    const { data: sessies } = await supabase.from('mol_sessies').select('id').eq('sessie_code', sessie_code.toUpperCase());
    if (!sessies || sessies.length === 0) return res.status(404).json({ error: 'Sessie niet gevonden. Controleer de code.' });
    const sessieId = sessies[0].id;
    // Zoek leerling
    const { data: spelers } = await supabase.from('mol_leerlingen').select('*').eq('sessie_id', sessieId).eq('speler_code', speler_code.toUpperCase());
    if (!spelers || spelers.length === 0) return res.status(404).json({ error: 'Spelcode niet gevonden. Vraag je leraar.' });
    const speler = spelers[0];
    // Update online_at
    await supabase.from('mol_leerlingen').update({ online_at: Date.now() }).eq('id', speler.id);
    res.json({ speler, sessieId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ── PATCH /api/mol/ronde-fase — zet ronde-fase + timestamp ──────────────────
app.patch('/api/mol/ronde-fase', async (req, res) => {
  try {
    const { sessie_id, docent_code, ronde_fase, status } = req.body;
    const { data: sessie } = await supabase.from('mol_sessies')
      .select('docent_code').eq('id', sessie_id).single();
    if (!sessie || sessie.docent_code !== docent_code)
      return res.status(403).json({ error: 'Ongeldige docentcode' });
    const update = { ronde_fase, fase_gestart_op: Date.now() };
    if (status) update.status = status;
    await supabase.from('mol_sessies').update(update).eq('id', sessie_id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/mol/sessie/:id/status — docent stuurt spel aan ───────────────
app.patch('/api/mol/sessie/:id/status', async (req, res) => {
  try {
    const { docent_code, status, huidige_ronde } = req.body;
    const { data: sessie } = await supabase.from('mol_sessies').select('docent_code').eq('id', req.params.id).single();
    if (!sessie || sessie.docent_code !== docent_code) return res.status(403).json({ error: 'Ongeldige docentcode' });
    const update = { status };
    if (huidige_ronde !== undefined) update.huidige_ronde = huidige_ronde;
    await supabase.from('mol_sessies').update(update).eq('id', req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



// ── POST /api/mol/briefing-klaar — leerling drukt op "Start" ────────────────
app.post('/api/mol/briefing-klaar', async (req, res) => {
  try {
    const { sessie_id, leerling_id } = req.body;
    // Sla op dat deze leerling klaar is
    await supabase.from('mol_briefing_klaar').upsert([{
      id:         `bk_${sessie_id}_${leerling_id}`,
      sessie_id, leerling_id,
      klaar_op:   Date.now(),
    }]);

    // Check of alle groepsleden van deze leerling klaar zijn
    const { data: speler } = await supabase
      .from('mol_leerlingen').select('groep_id').eq('id', leerling_id).single();
    if (!speler) return res.json({ ok: true, groep_klaar: false });

    const { data: groepleden } = await supabase
      .from('mol_leerlingen').select('id').eq('sessie_id', sessie_id).eq('groep_id', speler.groep_id);
    const { data: klareLeden } = await supabase
      .from('mol_briefing_klaar').select('leerling_id').eq('sessie_id', sessie_id)
      .in('leerling_id', groepleden.map(l => l.id));

    const groep_klaar = klareLeden.length >= groepleden.length;
    res.json({ ok: true, groep_klaar, klaar: klareLeden.length, totaal: groepleden.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ── POST /api/mol/groepshoofd-stem — leerling stemt op groepshoofd ───────────
app.post('/api/mol/groepshoofd-stem', async (req, res) => {
  try {
    const { sessie_id, leerling_id, kandidaat_id } = req.body;
    await supabase.from('mol_leerlingen')
      .update({ groepshoofd_stem: kandidaat_id })
      .eq('id', leerling_id);

    // Haal groep op van deze leerling
    const { data: speler } = await supabase.from('mol_leerlingen')
      .select('groep_id').eq('id', leerling_id).single();
    const groep_id = speler?.groep_id;

    // Check of alle groepsleden gestemd hebben
    const { data: leden } = await supabase.from('mol_leerlingen')
      .select('id, groepshoofd_stem').eq('sessie_id', sessie_id).eq('groep_id', groep_id);
    const allemaalGestemd = leden && leden.every(l => l.groepshoofd_stem);

    if (allemaalGestemd) {
      // Bepaal winnaar: meerderheid, bij gelijkspel alfabetisch eerste
      const tally = {};
      leden.forEach(l => { tally[l.groepshoofd_stem] = (tally[l.groepshoofd_stem] || 0) + 1; });
      const maxStemmen = Math.max(...Object.values(tally));
      const kandidaten = Object.keys(tally).filter(k => tally[k] === maxStemmen);
      // Haal namen op voor gelijkspel
      const { data: kandidaatData } = await supabase.from('mol_leerlingen')
        .select('id, naam').in('id', kandidaten);
      kandidaatData.sort((a, b) => a.naam.localeCompare(b.naam));
      const winnaar_id = kandidaatData[0].id;
      // Zet groepshoofd
      await supabase.from('mol_leerlingen')
        .update({ is_groepshoofd: false }).eq('sessie_id', sessie_id).eq('groep_id', groep_id);
      await supabase.from('mol_leerlingen')
        .update({ is_groepshoofd: true }).eq('id', winnaar_id);
    }
    res.json({ ok: true, allemaal_gestemd: allemaalGestemd });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/mol/groep-stem-hoofd — groepshoofd dient groepsantwoord in ─────
app.post('/api/mol/groep-stem-hoofd', async (req, res) => {
  try {
    const { sessie_id, ronde_nr, groep_id, leerling_id, gekozen_optie_id } = req.body;
    // Verificeer dat deze leerling groepshoofd is
    const { data: speler } = await supabase.from('mol_leerlingen')
      .select('is_groepshoofd').eq('id', leerling_id).single();
    if (!speler?.is_groepshoofd) return res.status(403).json({ error: 'Alleen het groepshoofd kan het groepsantwoord indienen' });

    const { data: caseData } = await supabase.from('mol_cases').select('*')
      .eq('sessie_id', sessie_id).eq('ronde_nr', ronde_nr).single();

    let isCorrect = false, punten = 0, maxPunten = 10;
    if (caseData?.vraagtype === 'mc' && caseData?.mc_opties) {
      const gekozen = caseData.mc_opties.find(o => o.id === gekozen_optie_id);
      punten    = gekozen?.punten ?? 0;
      maxPunten = Math.max(...caseData.mc_opties.map(o => o.punten ?? 0));
      isCorrect = punten === maxPunten;
    } else {
      isCorrect = gekozen_optie_id === 'correct';
      punten    = isCorrect ? 10 : 0;
    }

    const { error } = await supabase.from('mol_groep_stemmen').upsert([{
      id:                  `stem_${sessie_id}_r${ronde_nr}_${groep_id}`,
      sessie_id, ronde_nr, groep_id,
      gekozen_leerling_id: leerling_id,
      gekozen_argument:    gekozen_optie_id,
      is_correct:          isCorrect,
      punten, max_punten:  maxPunten,
      submitted_at:        Date.now(),
    }]);
    if (error) return res.status(500).json({ error: error.message });

    // Zet ronde_fase op 'resultaat_5sec' zodat frontend 5-sec countdown toont
    await supabase.from('mol_sessies')
      .update({ ronde_fase: 'resultaat_5sec', fase_gestart_op: Date.now() })
      .eq('id', sessie_id);

    res.json({ ok: true, punten, is_correct: isCorrect });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/mol/heartbeat — leerling stuurt periodiek ping ────────────────
app.post('/api/mol/heartbeat', async (req, res) => {
  try {
    const { leerling_id } = req.body;
    if (!leerling_id) return res.status(400).json({ error: 'leerling_id ontbreekt' });
    await supabase.from('mol_leerlingen')
      .update({ online_at: Date.now() })
      .eq('id', leerling_id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/mol/antwoord — leerling dient individueel antwoord in ─────────
app.post('/api/mol/antwoord', async (req, res) => {
  try {
    const { sessie_id, ronde_nr, leerling_id, antwoord, argument, mc_optie_id } = req.body;
    const { error } = await supabase.from('mol_antwoorden').upsert([{
      id:           `antw_${sessie_id}_r${ronde_nr}_${leerling_id}`,
      sessie_id, ronde_nr, leerling_id, antwoord, argument,
      mc_optie_id:  mc_optie_id || null,
      submitted_at: Date.now(),
    }]);
    if (error) return res.status(500).json({ error: error.message });

    // Check of alle leerlingen nu ingediend hebben → direct naar discussie
    const { data: alleLeerlingen } = await supabase
      .from('mol_leerlingen').select('id').eq('sessie_id', sessie_id);
    const { data: alleAntwoorden } = await supabase
      .from('mol_antwoorden').select('id').eq('sessie_id', sessie_id).eq('ronde_nr', ronde_nr);
    const iederKlaar = alleLeerlingen && alleAntwoorden &&
      alleAntwoorden.length >= alleLeerlingen.length;
    if (iederKlaar) {
      // Sla discussiefase over — direct naar stemfase
      await supabase.from('mol_sessies')
        .update({ ronde_fase: 'stem', fase_gestart_op: Date.now() })
        .eq('id', sessie_id);
    }
    res.json({ ok: true, ieder_klaar: iederKlaar });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/mol/groep-vote — leerling stemt op groepsoptie (unaniem) ───────
app.post('/api/mol/groep-vote', async (req, res) => {
  try {
    const { sessie_id, ronde_nr, groep_id, leerling_id, gekozen_optie_id, gekozen_antwoord } = req.body;
    // Sla stem op (upsert per leerling per ronde)
    await supabase.from('mol_groep_votes').upsert([{
      id:               `gv_${sessie_id}_r${ronde_nr}_${leerling_id}`,
      sessie_id, ronde_nr, groep_id, leerling_id,
      gekozen_optie_id: gekozen_optie_id || gekozen_antwoord,
      submitted_at:     Date.now(),
    }]);

    // Check unanimiteit: alle groepsleden voor dezelfde optie?
    const { data: groepleden } = await supabase
      .from('mol_leerlingen').select('id').eq('sessie_id', sessie_id).eq('groep_id', groep_id);
    const { data: groeVotes } = await supabase
      .from('mol_groep_votes').select('*')
      .eq('sessie_id', sessie_id).eq('ronde_nr', ronde_nr).eq('groep_id', groep_id);

    const aantalLeden = groepleden?.length || 0;
    const aantalVotes = groeVotes?.length || 0;
    const uniek = groeVotes ? [...new Set(groeVotes.map(v => v.gekozen_optie_id))] : [];
    const unaniem = aantalVotes >= aantalLeden && uniek.length === 1;

    let punten = null;
    if (unaniem) {
      // Submit automatisch als groep-stem
      const winnaar = uniek[0]; // de gekozen optie ID of antwoord
      const { data: caseData } = await supabase.from('mol_cases').select('*')
        .eq('sessie_id', sessie_id).eq('ronde_nr', ronde_nr).single();
      // Bepaal punten op basis van MC of open
      let isCorrect = false; let maxPunten = 10; let puntentelling = 0;
      if (caseData?.vraagtype === 'mc' && caseData?.mc_opties) {
        const gekozen = caseData.mc_opties.find(o => o.id === winnaar);
        puntentelling = gekozen?.punten ?? 0;
        maxPunten     = Math.max(...caseData.mc_opties.map(o => o.punten ?? 0));
        isCorrect     = puntentelling === maxPunten;
      } else {
        isCorrect     = winnaar === 'correct';
        puntentelling = isCorrect ? 10 : 0;
      }
      await supabase.from('mol_groep_stemmen').upsert([{
        id:                  `stem_${sessie_id}_r${ronde_nr}_${groep_id}`,
        sessie_id, ronde_nr, groep_id,
        gekozen_leerling_id: leerling_id,
        gekozen_argument:    winnaar,
        is_correct:          isCorrect,
        punten:              puntentelling,
        max_punten:          maxPunten,
        submitted_at:        Date.now(),
      }]);
    }
    res.json({ ok: true, unaniem, stemmen: aantalVotes, totaal: aantalLeden, unieke_opties: uniek.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/mol/groep-stem — groep stemt op definitief antwoord ────────────
app.post('/api/mol/groep-stem', async (req, res) => {
  try {
    const { sessie_id, ronde_nr, groep_id, gekozen_leerling_id } = req.body;
    const { data: caseData } = await supabase.from('mol_cases').select('*').eq('sessie_id', sessie_id).eq('ronde_nr', ronde_nr).single();
    const { data: antw }     = await supabase.from('mol_antwoorden').select('antwoord,argument,mc_optie_id').eq('leerling_id', gekozen_leerling_id).eq('ronde_nr', ronde_nr).single();

    // Bepaal punten: MC → zoek in mc_opties, open → correct=10 / fout=0
    let punten = 0;
    let isCorrect = false;
    let maxPunten = 10; // max haalbaar voor deze ronde
    if (caseData?.vraagtype === 'mc' && caseData?.mc_opties && antw?.mc_optie_id) {
      const opties = caseData.mc_opties;
      const gekozen = opties.find(o => o.id === antw.mc_optie_id);
      punten    = gekozen?.punten ?? 0;
      isCorrect = punten === Math.max(...opties.map(o => o.punten ?? 0));
      maxPunten = Math.max(...opties.map(o => o.punten ?? 0));
    } else {
      isCorrect = antw?.antwoord === 'correct';
      punten    = isCorrect ? 10 : 0;
      maxPunten = 10;
    }

    const { error } = await supabase.from('mol_groep_stemmen').upsert([{
      id:                  `stem_${sessie_id}_r${ronde_nr}_${groep_id}`,
      sessie_id, ronde_nr, groep_id,
      gekozen_leerling_id,
      gekozen_argument:    antw?.argument || '',
      is_correct:          isCorrect,
      punten,
      max_punten:          maxPunten,
      submitted_at:        Date.now(),
    }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, punten, max_punten: maxPunten, is_correct: isCorrect });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/mol/score-open — docent scoort open antwoord per groep ─────────
app.post('/api/mol/score-open', async (req, res) => {
  try {
    const { sessie_id, ronde_nr, groep_id, punten, docent_code } = req.body;
    // Verificeer docentcode
    const { data: sessie } = await supabase.from('mol_sessies').select('docent_code').eq('id', sessie_id).single();
    if (!sessie || sessie.docent_code !== docent_code) return res.status(403).json({ error: 'Ongeldige docentcode' });
    // Upsert de score
    const { error } = await supabase.from('mol_groep_stemmen').upsert([{
      id:          `stem_${sessie_id}_r${ronde_nr}_${groep_id}`,
      sessie_id, ronde_nr, groep_id,
      punten:      parseInt(punten),
      max_punten:  10,
      is_correct:  parseInt(punten) >= 7,
      submitted_at: Date.now(),
    }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/mol/test-antwoord — leerling dient moltest in ─────────────────
app.post('/api/mol/test-antwoord', async (req, res) => {
  try {
    const { sessie_id, leerling_id, mol_verdachte_id, mol_ronde, mol_argument } = req.body;
    const { error } = await supabase.from('mol_test_antwoorden').upsert([{
      id:               `test_${sessie_id}_${leerling_id}`,
      sessie_id, leerling_id,
      mol_verdachte_id, mol_ronde, mol_argument,
      submitted_at:     Date.now(),
    }]);
    if (error) return res.status(500).json({ error: error.message });

    // Auto-reveal: check of alle leerlingen de test hebben ingediend
    const { data: alleLeerlingen } = await supabase
      .from('mol_leerlingen').select('id').eq('sessie_id', sessie_id);
    const { data: alleTests } = await supabase
      .from('mol_test_antwoorden').select('id').eq('sessie_id', sessie_id);
    const iederKlaar = alleLeerlingen && alleTests &&
      alleTests.length >= alleLeerlingen.length;

    if (iederKlaar) {
      // Bereken scores voor alle leerlingen
      await berekenScoresIntern(sessie_id);
      // Zet sessie op reveal
      await supabase.from('mol_sessies')
        .update({ status: 'reveal' }).eq('id', sessie_id);
    }
    res.json({ ok: true, auto_reveal: iederKlaar });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Score-berekening (intern) ─────────────────────────────────────────────────
async function berekenScoresIntern(sessie_id) {
  try {
    const [
      { data: leerlingen }, { data: antwoorden },
      { data: groepStemmen }, { data: testAntwoorden }, { data: sessie },
    ] = await Promise.all([
      supabase.from('mol_leerlingen').select('*').eq('sessie_id', sessie_id),
      supabase.from('mol_antwoorden').select('*').eq('sessie_id', sessie_id),
      supabase.from('mol_groep_stemmen').select('*').eq('sessie_id', sessie_id),
      supabase.from('mol_test_antwoorden').select('*').eq('sessie_id', sessie_id),
      supabase.from('mol_sessies').select('*').eq('id', sessie_id).single(),
    ]);

    const mol = leerlingen?.find(l => l.is_mol);
    const nRondes = sessie?.n_rondes || 3;
    const scores = [];

    for (const leerling of (leerlingen || [])) {
      const isMol = leerling.is_mol;
      const opbouw = {};
      let totaal = 0;

      if (!isMol) {
        // ── Niet-Mol scoring ──────────────────────────────────
        let indivPunten = 0;
        for (let r = 1; r <= nRondes; r++) {
          const ant = antwoorden?.find(a => a.leerling_id === leerling.id && a.ronde_nr === r);
          if (ant?.antwoord === 'correct' || ant?.mc_optie_id) {
            // Correct als antwoord === 'correct' of mc-optie de hoogste score heeft
            const isCorrect = ant.antwoord === 'correct';
            if (isCorrect) {
              indivPunten += 15;
              opbouw['ronde_' + r + '_individueel'] = 15;
            } else {
              opbouw['ronde_' + r + '_individueel'] = 0;
            }
          } else {
            opbouw['ronde_' + r + '_individueel'] = 0;
          }
        }
        totaal += indivPunten;

        // Groepsantwoord punten
        let groepPunten = 0;
        for (let r = 1; r <= nRondes; r++) {
          const stem = groepStemmen?.find(s => s.groep_id === leerling.groep_id && s.ronde_nr === r);
          if (stem) {
            const bonus = stem.is_correct ? 10 : -5;
            groepPunten += bonus;
            opbouw['ronde_' + r + '_groep'] = bonus;
          }
        }
        totaal += groepPunten;

        // Mol geraden
        const test = testAntwoorden?.find(t => t.leerling_id === leerling.id);
        const molGeraden = test && mol && test.mol_verdachte_id === mol.id;
        if (molGeraden) {
          totaal += 25;
          opbouw['mol_geraden'] = 25;
        } else {
          opbouw['mol_geraden'] = 0;
        }
      } else {
        // ── Mol scoring ───────────────────────────────────────
        for (let r = 1; r <= nRondes; r++) {
          const stem = groepStemmen?.find(s => s.groep_id === leerling.groep_id && s.ronde_nr === r);
          if (stem && !stem.is_correct) {
            totaal += 20;
            opbouw['ronde_' + r + '_sabotage'] = 20;
          } else {
            opbouw['ronde_' + r + '_sabotage'] = 0;
          }
        }
        // Niet ontmaskerd: niemand raadde de mol correct
        const ontmaskerd = testAntwoorden?.some(t =>
          t.leerling_id !== mol.id && t.mol_verdachte_id === mol.id
        );
        // Meerderheid check: meer dan helft raadde correct?
        const aantalCorrect = testAntwoorden?.filter(t =>
          t.leerling_id !== mol.id && t.mol_verdachte_id === mol.id
        ).length || 0;
        const aantalSpelers = leerlingen.filter(l => !l.is_mol).length;
        const meerderheid = aantalCorrect > aantalSpelers / 2;
        if (!meerderheid) {
          totaal += 40;
          opbouw['niet_ontmaskerd'] = 40;
        } else {
          opbouw['niet_ontmaskerd'] = 0;
        }
      }

      // Clamp op 0
      totaal = Math.max(0, totaal);
      scores.push({
        id:         `score_${sessie_id}_${leerling.id}`,
        sessie_id,
        leerling_id: leerling.id,
        totaal,
        opbouw,
      });
    }

    // Sla scores op
    for (const score of scores) {
      await supabase.from('mol_scores').upsert([score]);
    }
    return scores;
  } catch (e) {
    console.error('berekenScoresIntern fout:', e.message);
    return [];
  }
}




// ── POST /api/mol/genereer-cases-preview — genereert zonder op te slaan ──────
app.post('/api/mol/genereer-cases-preview', async (req, res) => {
  try {
    const { les_naam, les_content, n_rondes, ronde_offset = 0 } = req.body;

    const prompt = `Je bent een ervaren economieleraar op VWO-niveau.
Genereer ${n_rondes} economische case${n_rondes > 1 ? 's' : ''} voor de lesvorm "Wie is de Mol" voor de les: "${les_naam}".

Kernstof:
${les_content}

Voor elke case genereer je:
1. Een heldere economische vraag over redenering en verbanden (1-2 zinnen)
2. Optionele context (1 zin achtergrond)
3. Uitleg van het correcte antwoord (2-3 zinnen)
4. Uitleg van het Mol-argument: plausibel fout, verleidelijk, maar economisch onjuist (2-3 zinnen)
5. Vier MC-opties met gegradueerde puntenscore:
   - Beste antwoord: 10 punten (volledig correct, scherpe redenering)
   - Redelijk antwoord: 7 punten (grotendeels correct, mist nuance)
   - Matig antwoord: 3 punten (gedeeltelijk correct, bevat een denkfout)
   - Mol-argument: 0 punten (plausibel fout — dit is het argument dat de Mol krijgt)
   De volgorde van de opties moet willekeurig zijn (niet altijd 10pt als eerste).

Eisen:
- Elke optie is een korte stelling (max 1 zin), niet de uitleg zelf
- Puntenverschillen weerspiegelen de kwaliteit van het economisch redeneren
- Het Mol-argument (0 pt) moet een veelgemaakte redeneerfout zijn${n_rondes > 1 ? '\n- Cases moeten onderling duidelijk verschillen' : ''}${ronde_offset > 0 ? '\n- Dit is een vervanging voor ronde ' + (ronde_offset + 1) + ', genereer iets anders' : ''}

Antwoord ALLEEN met geldige JSON:
{
  "cases": [
    {
      "ronde_nr": ${ronde_offset + 1},
      "vraag": "...",
      "context": "...",
      "correct_uitleg": "...",
      "fout_uitleg": "...",
      "mc_opties": [
        {"tekst": "...", "punten": 10, "is_mol": false},
        {"tekst": "...", "punten": 7,  "is_mol": false},
        {"tekst": "...", "punten": 3,  "is_mol": false},
        {"tekst": "...", "punten": 0,  "is_mol": true}
      ]
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const parsed = JSON.parse(response.content[0].text.replace(/```json|```/g, '').trim());
    // Nummereer rondes correct bij offset
    parsed.cases = parsed.cases.map((c, i) => {
      // Voeg unieke IDs toe aan mc_opties
      const opties = (c.mc_opties || []).map(o => ({ ...o, id: randCode(7) }));
      return { ...c, ronde_nr: ronde_offset + i + 1, mc_opties: opties };
    });
    res.json({ ok: true, cases: parsed.cases });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/mol/genereer-cases — AI genereert cases voor het spel ─────────
app.post('/api/mol/genereer-cases', async (req, res) => {
  try {
    const { sessie_id, les_naam, les_content, n_rondes } = req.body;

    const prompt = `Je bent een ervaren economieleraar op VWO-niveau.
Genereer ${n_rondes} economische cases voor de lesvorm "Wie is de Mol" voor de les: "${les_naam}".

Kernstof van de les:
${les_content}

Voor elke case heb je nodig:
1. Een heldere economische situatie/vraag (1-2 zinnen)
2. Het CORRECTE antwoord (1 zin) + een heldere economische onderbouwing (2-3 zinnen)
3. Een PLAUSIBEL FOUT antwoord (1 zin) — dit is het antwoord dat de Mol moet verdedigen
4. Een misleidende onderbouwing van het foute antwoord (2-3 zinnen) — klinkt economisch maar klopt niet

Eisen aan de cases:
- De vraag moet gaan over redenering en verbanden, niet over feitjes
- Het foute antwoord moet VERLEIDELIJK klinken — een veelgemaakte redeneerf out
- Gebruik concrete economische concepten uit de leerstof
- Elke case moet ANDERS zijn dan de andere (andere concepten, andere situatie)

Antwoord ALLEEN met geldige JSON, geen tekst daarbuiten:
{
  "cases": [
    {
      "ronde_nr": 1,
      "vraag": "...",
      "correct_antwoord": "correct",
      "correct_uitleg": "...",
      "fout_antwoord": "fout",
      "fout_uitleg": "...",
      "context": "..."
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const parsed = JSON.parse(response.content[0].text.replace(/```json|```/g, '').trim());

    // Cases opslaan in database
    const caseRows = parsed.cases.map(c => ({
      id:               `case_${sessie_id}_r${c.ronde_nr}`,
      sessie_id,
      ronde_nr:         c.ronde_nr,
      vraag:            c.vraag,
      context:          c.context || '',
      correct_antwoord: c.correct_antwoord || 'correct',
      correct_uitleg:   c.correct_uitleg,
      fout_antwoord:    c.fout_antwoord || 'fout',
      fout_uitleg:      c.fout_uitleg,
      vraagtype:                c.vraagtype || 'open',
      mc_opties:                c.mc_opties || null,
      timer_discussie_override: c.timer_discussie_override || null,
      timer_stem_override:      c.timer_stem_override      || null,
    }));

    await supabase.from('mol_cases').insert(caseRows);
    res.json({ ok: true, cases: caseRows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/mol/bereken-scores — bereken testscore na reveal ───────────────
app.post('/api/mol/bereken-scores', async (req, res) => {
  try {
    const { sessie_id } = req.body;
    const { data: leerlingen } = await supabase.from('mol_leerlingen').select('*').eq('sessie_id', sessie_id);
    const { data: testAntw }   = await supabase.from('mol_test_antwoorden').select('*').eq('sessie_id', sessie_id);

    const mol = leerlingen.find(l => l.is_mol);
    if (!mol) return res.status(400).json({ error: 'Geen mol gevonden' });

    // Score per leerling: mol_verdachte correct (+10), mol_ronde correct (+5)
    for (const antw of (testAntw || [])) {
      let score = 0;
      if (antw.mol_verdachte_id === mol.id) score += 10;
      score += Math.min(5, (antw.mol_argument?.length || 0) > 30 ? 5 : 2);
      await supabase.from('mol_test_antwoorden').update({ score }).eq('id', antw.id);
    }

    res.json({ ok: true, mol_naam: mol.naam });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// START
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Toetsapp backend draait op poort ${PORT}`));
