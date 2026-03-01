const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase  = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.get('/', (req, res) => {
  res.json({ status: 'ok', app: 'Socratische Toetsapp' });
});

// ══════════════════════════════════════════════════════════
//  KLASSEN
// ══════════════════════════════════════════════════════════

app.get('/api/classes', async (req, res) => {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('name', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/classes', async (req, res) => {
  const { id, name, created_at } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'Velden ontbreken' });
  const { data, error } = await supabase
    .from('classes')
    .insert([{ id, name, created_at }])
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

app.delete('/api/classes/:id', async (req, res) => {
  const { id } = req.params;
  await supabase.from('lessons').update({ class_id: null }).eq('class_id', id);
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════
//  LESSEN
// ══════════════════════════════════════════════════════════

app.get('/api/lessons', async (req, res) => {
  const classId = req.query.class_id;
  let query = supabase.from('lessons').select('*').order('created_at', { ascending: false });
  if (classId) query = query.eq('class_id', classId);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/lessons', async (req, res) => {
  const { id, name, content, created_at, class_id } = req.body;
  if (!id || !name || !content) return res.status(400).json({ error: 'Velden ontbreken' });
  const { data, error } = await supabase
    .from('lessons')
    .insert([{ id, name, content, created_at, class_id: class_id || null }])
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

app.delete('/api/lessons/:id', async (req, res) => {
  const { id } = req.params;
  await supabase.from('results').delete().eq('lesson_id', id);
  const { error } = await supabase.from('lessons').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════
//  RESULTATEN
// ══════════════════════════════════════════════════════════

app.get('/api/results/:lessonId', async (req, res) => {
  const classId = req.query.class_id;
  let query = supabase.from('results').select('*')
    .eq('lesson_id', req.params.lessonId)
    .order('timestamp', { ascending: false });
  if (classId) query = query.eq('class_id', classId);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/results', async (req, res) => {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .order('timestamp', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/results', async (req, res) => {
  const { id, lesson_id, lesson_name, student_name, class_id, class_name,
          understanding, refl_goed, refl_verbeteren, messages, timestamp } = req.body;
  if (!id || !lesson_id || !student_name) return res.status(400).json({ error: 'Velden ontbreken' });
  const { data, error } = await supabase
    .from('results')
    .insert([{ id, lesson_id, lesson_name, student_name, class_id: class_id || null,
               class_name: class_name || null, understanding,
               refl_goed, refl_verbeteren, messages, timestamp }])
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// ══════════════════════════════════════════════════════════
//  AI PROXY
// ══════════════════════════════════════════════════════════

app.post('/api/ai/question', async (req, res) => {
  const { lessonName, lessonContent, studentName, questionNumber, maxQuestions, messages } = req.body;
  const systemPrompt = `Je bent een Socratische gesprekspartner voor een economie les op de middelbare school.
Les: "${lessonName}"
Kernstof van de les: "${lessonContent}"
Leerling: ${studentName}
De leerling heeft net hun begrip uitgelegd. Stel één Socratische vervolgvraag die dieper ingaat op hun antwoord.
Vraag naar oorzaken, gevolgen, uitzonderingen of toepassingen. Vraag nooit naar feitjes maar naar redenering.
Wees warm en aanmoedigend. Houd de vraag kort (max 2 zinnen). Spreek de leerling aan met je/jij.
Dit is vraag ${questionNumber} van ${maxQuestions}.`;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages
    });
    res.json({ text: response.content[0].text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ai/reflection', async (req, res) => {
  const { messages } = req.body;
  const systemPrompt = `Je bent een economieleraar op de middelbare school die een Socratisch gesprek beoordeelt.
Analyseer het gesprek en geef een eerlijke, gedifferentieerde beoordeling.
Antwoord ALLEEN met JSON in exact dit formaat (geen extra tekst):
{
  "niveau": <getal 1, 2, 3 of 4>,
  "goed": "...",
  "verbeteren": "..."
}
Niveau betekenis — wees streng en realistisch:
1 = Onvoldoende: nauwelijks begrip, oppervlakkig of incorrect
2 = Matig: begrijpt de basis maar mist diepgang
3 = Goed: begrijpt de stof maar heeft nog hiaten
4 = Uitstekend: diep begrip, legt verbanden, goede voorbeelden
Wees eerlijk en streng. Spreek de leerling aan met je/jij.`;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: systemPrompt,
      messages
    });
    const raw = response.content[0].text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Toetsapp backend draait op poort ${PORT}`));
