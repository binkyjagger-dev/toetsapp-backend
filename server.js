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
  const { id, name, content, created_at, class_id } = req.body;
  if (!id || !name || !content) return res.status(400).json({ error: 'Velden ontbreken' });
  const { data, error } = await supabase.from('lessons').insert([{ id, name, content, created_at, class_id: class_id || null }]).select();
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
  const { id, lesson_id, lesson_name, student_name, class_id, class_name, understanding, refl_goed, refl_verbeteren, messages, timestamp } = req.body;
  if (!id || !lesson_id || !student_name) return res.status(400).json({ error: 'Velden ontbreken' });
  const { data, error } = await supabase.from('results').insert([{ id, lesson_id, lesson_name, student_name, class_id: class_id || null, class_name: class_name || null, understanding, refl_goed, refl_verbeteren, messages, timestamp }]).select();
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
  const { lessonName, lessonContent, studentName, questionNumber, maxQuestions, messages } = req.body;
  const systemPrompt = `Je bent een Socratische gesprekspartner voor een economie les op de middelbare school.
Les: "${lessonName}"
Kernstof: "${lessonContent}"
Leerling: ${studentName}
Stel één Socratische vervolgvraag die dieper ingaat op het antwoord van de leerling.
Vraag naar oorzaken, gevolgen, uitzonderingen of toepassingen. Nooit naar feitjes maar naar redenering.
Wees warm en aanmoedigend. Max 2 zinnen. Spreek de leerling aan met je/jij.
Dit is vraag ${questionNumber} van ${maxQuestions}.`;
  try {
    const response = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 300, system: systemPrompt, messages });
    res.json({ text: response.content[0].text });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI: REFLECTIE
app.post('/api/ai/reflection', async (req, res) => {
  const { messages } = req.body;
  const systemPrompt = `Je bent een economieleraar die een Socratisch gesprek nauwkeurig beoordeelt.

Analyseer het gesprek grondig en geef een specifieke, persoonlijke beoordeling.

Antwoord ALLEEN met JSON in dit exacte formaat (geen extra tekst):
{
  "niveau": <getal 1 t/m 6>,
  "goed": "...",
  "verbeteren": "..."
}

Niveaus — wees streng en realistisch:
1 = Onvoldoende:  Nauwelijks begrip, antwoorden zijn onsamenhangend of incorrect
2 = Beginnend:    Kent begrippen maar kan ze niet uitleggen of toepassen
3 = Begrijpend:   Begrijpt de stof, legt verbanden op basis van herkenning maar niet zelfstandig
4 = Toepassend:   Kan kennis toepassen op nieuwe situaties, met enige sturing
5 = Analyserend:  Ontleedt situaties zelfstandig, herkent oorzaak-gevolg relaties
6 = Verdiept:     Redeneert vanuit meerdere perspectieven, beoordeelt en nuanceert

Regels voor de feedbackteksten:
- "goed" (de TOP): 2-3 zinnen. Citeer een CONCRETE uitspraak die de leerling deed ("Je redeneerde sterk toen je zei dat..."). Leg uit waarom die redenering klopt en wat het toont over het begrip.
- "verbeteren" (de TIP): 2-3 zinnen. Koppel aan een SPECIFIEK moment in het gesprek ("Op het moment dat je gevraagd werd naar... haakte je redenering af"). Geef één concrete volgende stap of oefenvraag.

Wees specifiek — generieke feedback zoals "je begrijpt de basis" is niet toegestaan.
Spreek de leerling aan met je/jij. Schrijf warm maar direct.`;
  try {
    const response = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 800, system: systemPrompt, messages });
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
  const { lessonName, lessonContent, question, answer } = req.body;

  const systemPrompt = `Je bent een economieleraar die een antwoord van een leerling beoordeelt.

Les: "${lessonName}"
Kernstof: "${lessonContent}"
Gestelde vraag: "${question}"
Antwoord van de leerling: "${answer}"

Geef een score van 1 tot 10 op basis van:
- Correctheid van de redenering (klopt het inhoudelijk?)
- Gebruik van juiste economiebegrippen
- Diepgang en nuance (gaat het verder dan alleen herhalen?)

Schaal:
9-10: Uitstekend — correcte, diepgaande redenering met goede begrippen
7-8:  Goed — grotendeels correct, kleine lacunes
5-6:  Redelijk — basisredenering klopt, mist diepgang of precisie
3-4:  Matig — deels correct maar met duidelijke fouten
1-2:  Onvoldoende — incorrect of nauwelijks relevant

Geef ook een motivatie van maximaal 1 zin. Wees specifiek — noem iets concreets uit het antwoord.
Spreek de leerling aan met je/jij.

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
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// START
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Toetsapp backend draait op poort ${PORT}`));
