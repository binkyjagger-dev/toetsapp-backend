const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// ── Clients ──────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase  = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ── Health check ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', app: 'Socratische Toetsapp' });
});

// ══════════════════════════════════════════════════════════
//  LESSEN
// ══════════════════════════════════════════════════════════

// Alle lessen ophalen
app.get('/api/lessons', async (req, res) => {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Nieuwe les aanmaken
app.post('/api/lessons', async (req, res) => {
  const { id, name, content, created_at } = req.body;
  if (!id || !name || !content) return res.status(400).json({ error: 'Velden ontbreken' });
  const { data, error } = await supabase
    .from('lessons')
    .insert([{ id, name, content, created_at }])
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// Les verwijderen
app.delete('/api/lessons/:id', async (req, res) => {
  const { id } = req.params;
  // Verwijder ook alle resultaten van deze les
  await supabase.from('results').delete().eq('lesson_id', id);
  const { error } = await supabase.from('lessons').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════
//  RESULTATEN
// ══════════════════════════════════════════════════════════

// Resultaten ophalen voor een les
app.get('/api/results/:lessonId', async (req, res) => {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('lesson_id', req.params.lessonId)
    .order('timestamp', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Alle resultaten ophalen (voor dashboard stats)
app.get('/api/results', async (req, res) => {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .order('timestamp', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Resultaat opslaan
app.post('/api/results', async (req, res) => {
  const { id, lesson_id, lesson_name, student_name, understanding,
          refl_goed, refl_verbeteren, messages, timestamp } = req.body;
  if (!id || !lesson_id || !student_name) return res.status(400).json({ error: 'Velden ontbreken' });
  const { data, error } = await supabase
    .from('results')
    .insert([{ id, lesson_id, lesson_name, student_name, understanding,
               refl_goed, refl_verbeteren, messages, timestamp }])
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// ══════════════════════════════════════════════════════════
//  AI PROXY — verbergt de API-sleutel voor de browser
// ══════════════════════════════════════════════════════════

// Socratische vraag genereren
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

// Reflectie genereren
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
1 = Onvoldoende: leerling toont nauwelijks begrip, antwoorden zijn oppervlakkig, vaag of incorrect
2 = Matig: leerling begrijpt de basis maar mist diepgang, maakt fouten bij doorvragen, kan concepten niet goed verbinden
3 = Goed: leerling begrijpt de stof, kan redeneren maar heeft nog hiaten bij complexere vragen
4 = Uitstekend: leerling toont diep begrip, kan zelfstandig redeneren, legt verbanden en geeft goede voorbeelden

"goed": 2-3 zinnen over wat de leerling aantoonbaar begrijpt op basis van het gesprek. Wees specifiek.
"verbeteren": 2-3 zinnen over concrete lacunes, met een praktische studie-tip.

Wees eerlijk — een leerling die vaag antwoordt is GEEN niveau 3 of 4.
Spreek de leerling aan met je/jij. Schrijf warm maar direct.`;

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

// ── Start server ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Toetsapp backend draait op poort ${PORT}`));
