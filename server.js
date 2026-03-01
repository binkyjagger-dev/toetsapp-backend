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
  if (error) return res.status(500).json({ err
