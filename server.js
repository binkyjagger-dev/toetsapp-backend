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

// START
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Toetsapp backend draait op poort ${PORT}`));
