// ============================================================
// NAKIJK-ASSISTENT · Express routes
// Voeg toe aan je bestaande server.js:
//
//   const nakijkRouter = require('./routes/nakijk');
//   app.use('/api/nakijk', nakijkRouter);
//
// Vereiste packages (naast wat je al hebt):
//   npm install multer pdf-parse mammoth
// ============================================================

const express  = require('express');
const multer   = require('multer');
const pdfParse = require('pdf-parse');
const mammoth  = require('mammoth');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const { INLEZEN_SYSTEM, INLEZEN_USER, NAKIJKEN_SYSTEM, NAKIJKEN_USER } = require('../prompts/nakijk.prompts');
const { matchLeerling } = require('./leerling.match');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const claude  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ── Hulpfunctie: parse JSON uit Claude-respons (strips markdown fences) ──
function parseClaudeJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ── Hulpfunctie: extraheer tekst uit PDF of DOCX buffer ──
async function extractTekst(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  // Fallback: probeer als plain text
  return buffer.toString('utf8');
}


// ════════════════════════════════════════════════════════════
// ROUTE 1 — POST /api/nakijk/inlezen
// Upload toets-foto + antwoordmodel → Claude leest uit
//
// Body (multipart/form-data):
//   toets       : image file (JPG/PNG/PDF)
//   antwoordmodel: PDF or DOCX
// ════════════════════════════════════════════════════════════
router.post('/inlezen', upload.fields([
  { name: 'toets', maxCount: 1 },
  { name: 'antwoordmodel', maxCount: 1 },
]), async (req, res) => {
  try {
    const toetsFile = req.files?.toets?.[0];
    const modelFile = req.files?.antwoordmodel?.[0];

    if (!toetsFile || !modelFile) {
      return res.status(400).json({ error: 'Beide bestanden zijn verplicht (toets + antwoordmodel)' });
    }

    // 1. Extraheer tekst uit antwoordmodel
    const antwoordmodelTekst = await extractTekst(modelFile.buffer, modelFile.mimetype);

    // 2. Bepaal image mediatype voor de toets
    const imageMediaType = toetsFile.mimetype.startsWith('image/')
      ? toetsFile.mimetype
      : 'image/jpeg';

    // 3. Stuur naar Claude: afbeelding + antwoordmodel tekst
    const claudeResponse = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: INLEZEN_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMediaType,
              data: toetsFile.buffer.toString('base64'),
            },
          },
          {
            type: 'text',
            text: INLEZEN_USER(antwoordmodelTekst),
          },
        ],
      }],
    });

    // 4. Parse het JSON-antwoord van Claude
    const inlezing = parseClaudeJSON(claudeResponse.content[0].text);

    // 5. Sla een concept-sessie op in Supabase
    const { data: sessie, error: sessieError } = await supabase
      .from('nakijk_sessies')
      .insert({
        naam_op_toets:    inlezing.leerling_naam,
        naam_zekerheid:   inlezing.naam_zekerheid,
        toets_naam:       inlezing.toets_naam,
        vak:              inlezing.vak,
        niveau:           inlezing.niveau,
        aantal_vragen:    inlezing.vragen.length,
        max_score:        inlezing.max_score_totaal,
        status:           'ingelezen',
      })
      .select()
      .single();

    if (sessieError) throw sessieError;

    // 6. Sla antwoorden op
    const antwoordenRows = inlezing.vragen.map(v => ({
      sessie_id:       sessie.id,
      vraagnummer:     v.vraagnummer,
      vraag_tekst:     v.vraag_tekst,
      max_score:       v.max_score,
      modelantwoord:   v.modelantwoord,
      puntenverdeling: v.puntenverdeling,
      antwoord_rauw:   v.antwoord_rauw,
      antwoord_finaal: v.antwoord_rauw,  // initieel gelijk aan rauw
      leeszekerheid:   v.leeszekerheid,
      lees_opmerking:  v.lees_opmerking || null,
    }));

    const { error: antwoordenError } = await supabase
      .from('nakijk_antwoorden')
      .insert(antwoordenRows);

    if (antwoordenError) throw antwoordenError;

    // 7. Stuur terug
    res.json({
      success: true,
      sessie_id: sessie.id,
      inlezing,
      tokens_gebruikt: claudeResponse.usage,
    });

  } catch (err) {
    console.error('[nakijk/inlezen]', err);
    res.status(500).json({ error: 'Fout bij inlezen', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 2 — POST /api/nakijk/koppelen
// Match uitgelezen naam aan leerlingenlijst
//
// Body (JSON):
//   sessie_id    : UUID van de nakijk-sessie
//   leerling_id  : UUID van de gekozen leerling (door docent bevestigd)
//
// Of alleen zoeken:
//   naam         : string om te matchen (zonder leerling_id)
//   klas         : optioneel filter
// ════════════════════════════════════════════════════════════
router.post('/koppelen', async (req, res) => {
  try {
    const { sessie_id, leerling_id, naam, klas } = req.body;

    // ── A: Zoek kandidaten (naam matching) ──
    if (naam && !leerling_id) {
      let query = supabase.from('leerlingen').select('*');
      if (klas) query = query.eq('klas', klas);
      const { data: leerlingen, error } = await query;
      if (error) throw error;

      const kandidaten = matchLeerling(naam, leerlingen);
      return res.json({ success: true, kandidaten });
    }

    // ── B: Bevestig koppeling ──
    if (sessie_id && leerling_id) {
      const { error } = await supabase
        .from('nakijk_sessies')
        .update({ leerling_id, status: 'gekoppeld' })
        .eq('id', sessie_id);

      if (error) throw error;
      return res.json({ success: true, sessie_id, leerling_id });
    }

    res.status(400).json({ error: 'Geef naam (voor zoeken) of sessie_id + leerling_id (voor koppelen)' });

  } catch (err) {
    console.error('[nakijk/koppelen]', err);
    res.status(500).json({ error: 'Fout bij koppelen', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 3 — POST /api/nakijk/verificeren
// Sla geverifieerde antwoorden op (door docent gecorrigeerd)
//
// Body (JSON):
//   sessie_id   : UUID
//   antwoorden  : [{ vraagnummer, antwoord_finaal }]
// ════════════════════════════════════════════════════════════
router.post('/verificeren', async (req, res) => {
  try {
    const { sessie_id, antwoorden } = req.body;

    if (!sessie_id || !antwoorden?.length) {
      return res.status(400).json({ error: 'sessie_id en antwoorden zijn verplicht' });
    }

    // Update elk antwoord
    for (const a of antwoorden) {
      const { error } = await supabase
        .from('nakijk_antwoorden')
        .update({ antwoord_finaal: a.antwoord_finaal })
        .eq('sessie_id', sessie_id)
        .eq('vraagnummer', a.vraagnummer);

      if (error) throw error;
    }

    // Update sessie status
    await supabase
      .from('nakijk_sessies')
      .update({ status: 'geverifieerd' })
      .eq('id', sessie_id);

    res.json({ success: true });

  } catch (err) {
    console.error('[nakijk/verificeren]', err);
    res.status(500).json({ error: 'Fout bij verificeren', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 4 — POST /api/nakijk/nakijken
// Kijk de geverifieerde antwoorden na met Claude
//
// Body (JSON):
//   sessie_id : UUID
// ════════════════════════════════════════════════════════════
router.post('/nakijken', async (req, res) => {
  try {
    const { sessie_id } = req.body;

    if (!sessie_id) {
      return res.status(400).json({ error: 'sessie_id is verplicht' });
    }

    // Haal antwoorden op uit Supabase
    const { data: antwoorden, error: fetchError } = await supabase
      .from('nakijk_antwoorden')
      .select('*')
      .eq('sessie_id', sessie_id)
      .order('vraagnummer');

    if (fetchError) throw fetchError;

    // Bouw de input voor Claude op
    const vragenVoorClaude = antwoorden.map(a => ({
      vraagnummer:     a.vraagnummer,
      vraag_tekst:     a.vraag_tekst,
      max_score:       a.max_score,
      modelantwoord:   a.modelantwoord,
      puntenverdeling: a.puntenverdeling,
      antwoord_leerling: a.antwoord_finaal,
    }));

    // Roep Claude aan
    const claudeResponse = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: NAKIJKEN_SYSTEM,
      messages: [{
        role: 'user',
        content: NAKIJKEN_USER(vragenVoorClaude),
      }],
    });

    const beoordeling = parseClaudeJSON(claudeResponse.content[0].text);

    // Sla scores en feedback op per vraag
    for (const vb of beoordeling.vragen) {
      await supabase
        .from('nakijk_antwoorden')
        .update({
          score:           vb.score,
          behaalde_punten: vb.behaalde_punten,
          feedback:        vb.feedback,
          argumentatie:    vb.argumentatie,
        })
        .eq('sessie_id', sessie_id)
        .eq('vraagnummer', vb.vraagnummer);
    }

    // Update sessie met totalen
    await supabase
      .from('nakijk_sessies')
      .update({
        totaal_score:      beoordeling.totaal_score,
        cijfer_suggestie:  beoordeling.cijfer_suggestie,
        algemene_opmerking: beoordeling.algemene_opmerking,
        status:            'nagekeken',
      })
      .eq('id', sessie_id);

    res.json({
      success: true,
      sessie_id,
      beoordeling,
      tokens_gebruikt: claudeResponse.usage,
    });

  } catch (err) {
    console.error('[nakijk/nakijken]', err);
    res.status(500).json({ error: 'Fout bij nakijken', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 5 — PATCH /api/nakijk/score
// Docent past een score handmatig aan
//
// Body (JSON):
//   sessie_id    : UUID
//   vraagnummer  : integer
//   score        : number
//   notitie      : string (optioneel)
// ════════════════════════════════════════════════════════════
router.patch('/score', async (req, res) => {
  try {
    const { sessie_id, vraagnummer, score, notitie } = req.body;

    const { error } = await supabase
      .from('nakijk_antwoorden')
      .update({ score, score_aangepast: true, argumentatie: notitie || null })
      .eq('sessie_id', sessie_id)
      .eq('vraagnummer', vraagnummer);

    if (error) throw error;

    // Herbereken totaal
    const { data: alle } = await supabase
      .from('nakijk_antwoorden')
      .select('score, max_score')
      .eq('sessie_id', sessie_id);

    const totaal = alle.reduce((s, a) => s + (a.score || 0), 0);
    const max    = alle.reduce((s, a) => s + (a.max_score || 0), 0);
    const cijfer = Math.round(((totaal / max) * 9 + 1) * 10) / 10;

    await supabase
      .from('nakijk_sessies')
      .update({ totaal_score: totaal, cijfer_suggestie: cijfer })
      .eq('id', sessie_id);

    res.json({ success: true, totaal_score: totaal, cijfer_suggestie: cijfer });

  } catch (err) {
    console.error('[nakijk/score]', err);
    res.status(500).json({ error: 'Fout bij score aanpassen', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 6 — POST /api/nakijk/afronden
// Docent keurt de beoordeling goed en slaat het definitief op
// ════════════════════════════════════════════════════════════
router.post('/afronden', async (req, res) => {
  try {
    const { sessie_id, cijfer_definitief, docent_notitie } = req.body;

    const { error } = await supabase
      .from('nakijk_sessies')
      .update({
        cijfer_definitief,
        docent_notitie,
        status: 'afgerond',
      })
      .eq('id', sessie_id);

    if (error) throw error;
    res.json({ success: true, sessie_id });

  } catch (err) {
    console.error('[nakijk/afronden]', err);
    res.status(500).json({ error: 'Fout bij afronden', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 7 — GET /api/nakijk/sessie/:id
// Haal volledige sessie op (voor het herladen van de pagina)
// ════════════════════════════════════════════════════════════
router.get('/sessie/:id', async (req, res) => {
  try {
    const { data: sessie, error: sessieError } = await supabase
      .from('nakijk_sessies')
      .select(`
        *,
        leerling:leerlingen(*),
        antwoorden:nakijk_antwoorden(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (sessieError) throw sessieError;
    res.json({ success: true, sessie });

  } catch (err) {
    console.error('[nakijk/sessie]', err);
    res.status(500).json({ error: 'Sessie niet gevonden', details: err.message });
  }
});


module.exports = router;
