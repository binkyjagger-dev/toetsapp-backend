// ============================================================
// NAKIJK-ASSISTENT · Express routes
// Aangepast voor de bestaande Stanislascollege Toetsapp:
//   - Gebruikt leerlingen_import (niet een aparte leerlingen tabel)
//   - Hergebruikt supabase + anthropic uit app.locals (server.js)
//   - Geen aparte env vars nodig
//
// Voeg toe aan server.js VÓÓR app.listen:
//   app.locals.supabase  = supabase;   // al aangemaakt in server.js
//   app.locals.anthropic = anthropic;  // al aangemaakt in server.js
//   const nakijkRouter = require('./routes/nakijk.routes');
//   app.use('/api/nakijk', nakijkRouter);
// ============================================================

const express  = require('express');
const multer   = require('multer');
const pdfParse = require('pdf-parse');
const mammoth  = require('mammoth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// ── Haal gedeelde clients op ─────────────────────────────────
function clients(req) {
  return {
    supabase:  req.app.locals.supabase,
    anthropic: req.app.locals.anthropic,
  };
}

// ── Hulpfuncties ─────────────────────────────────────────────

function parseClaudeJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); }
  catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Geen geldige JSON in Claude-respons');
  }
}

async function extractTekst(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    return (await pdfParse(buffer)).text;
  }
  if (mimetype.includes('wordprocessingml') || mimetype.includes('msword')) {
    return (await mammoth.extractRawText({ buffer })).value;
  }
  return buffer.toString('utf8');
}

// Levenshtein fuzzy match
function lev(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

function norm(s) {
  return (s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

// leerlingen_import heeft: roepnaam, tussenvoegsel, achternaam
function volNaam(l) {
  return [l.roepnaam, l.tussenvoegsel, l.achternaam].filter(Boolean).join(' ');
}

function matchScore(uitgelezen, l) {
  const a = norm(uitgelezen), b = norm(volNaam(l));
  if (a === b) return 100;
  const mx = Math.max(a.length, b.length);
  return mx ? Math.round((1 - lev(a, b) / mx) * 95) : 0;
}

function zoekKandidaten(naam, leerlingen, topN = 5) {
  return leerlingen
    .map(l => ({ ...l, match_score: matchScore(naam, l) }))
    .filter(l => l.match_score >= 30)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, topN)
    .map((l, i) => ({
      ...l,
      match_label: l.match_score >= 95 ? 'exact'
                 : l.match_score >= 75 ? 'hoog'
                 : l.match_score >= 50 ? 'middel' : 'laag',
      is_best_match: i === 0,
    }));
}

// ── Claude prompts ────────────────────────────────────────────

const INLEZEN_SYSTEM = `
Je bent een nauwkeurige assistent die handgeschreven toetsen uitleest voor een Nederlandse economiedocent.

Je taak:
1. Analyseer het antwoordmodel: detecteer vraagnummers, puntenverdeling en verwachte antwoorden.
2. Lees de handgeschreven toets uit: koppel elk antwoord aan het juiste vraagnummer.
3. Zoek de naam van de leerling (voorblad, bovenhoek, of invulvak).

Regels:
- Twijfel je over een woord? Geef je beste gok en zet leeszekerheid op "twijfelachtig".
- Volledig onleesbaar: antwoord_rauw: null, leeszekerheid: "onleesbaar".
- Reageer UITSLUITEND met geldig JSON. Geen uitleg, geen markdown, geen backticks.
`.trim();

const inlezenUser = (modelTekst) => `
Analyseer het antwoordmodel en lees de bijgevoegde toetsfoto uit.

ANTWOORDMODEL:
${modelTekst}

Geef je antwoord als JSON:
{
  "leerling_naam": "Voornaam Achternaam",
  "naam_zekerheid": "hoog",
  "naam_locatie": "rechtsboven pagina 1",
  "toets_naam": "naam van de toets",
  "vak": "Economie",
  "niveau": "VWO 5",
  "max_score_totaal": 20,
  "vragen": [
    {
      "vraagnummer": 1,
      "vraag_tekst": "De vraagstelling",
      "max_score": 3,
      "modelantwoord": "Het verwachte antwoord",
      "puntenverdeling": [
        { "onderdeel": "Omschrijving punt", "punten": 1 }
      ],
      "antwoord_rauw": "Wat de leerling schreef",
      "leeszekerheid": "zeker",
      "lees_opmerking": null
    }
  ]
}
`.trim();

const NAKIJKEN_SYSTEM = `
Je bent een ervaren economiedocent die toetsen nauwkeurig nakijkt.

Regels:
- Beoordeel inhoudelijk — antwoord hoeft niet letterlijk overeen te komen als de strekking klopt.
- Ken per onderdeel van de puntenverdeling punten toe. Gedeeltelijke score is mogelijk.
- Leeg of null antwoord → score 0.
- Cijfer: (score/max)*9 + 1, afgerond op 1 decimaal.
- Reageer UITSLUITEND met geldig JSON. Geen markdown, geen backticks.
`.trim();

const nakijkenUser = (vragen) => `
Kijk de volgende antwoorden na.

${JSON.stringify(vragen, null, 2)}

Geef je beoordeling als JSON:
{
  "vragen": [
    {
      "vraagnummer": 1,
      "score": 2,
      "max_score": 3,
      "behaalde_punten": [
        { "onderdeel": "Omschrijving", "behaald": true }
      ],
      "feedback": "Korte feedback aan leerling (1-2 zinnen)",
      "argumentatie": "Toelichting voor docent"
    }
  ],
  "totaal_score": 13,
  "max_score": 20,
  "cijfer_suggestie": 6.8,
  "algemene_opmerking": "Algemeen beeld van de prestatie"
}
`.trim();


// ════════════════════════════════════════════════════════════
// ROUTE 1 — POST /api/nakijk/inlezen
// ════════════════════════════════════════════════════════════
// Optioneel: haal leraar_id uit Authorization header
function optionalAuth(req) {
  try {
    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'stanislascollege_mol_secret_2025';
      req.leraar = jwt.verify(auth.slice(7), secret);
    }
  } catch(e) { /* geen token of verlopen — dat is ok */ }
}

router.post('/inlezen', upload.fields([
  { name: 'toets', maxCount: 1 },
  { name: 'antwoordmodel', maxCount: 1 },
]), async (req, res) => {
  optionalAuth(req);
  try {
    const { supabase, anthropic } = clients(req);
    const toetsFile = req.files?.toets?.[0];
    const modelFile = req.files?.antwoordmodel?.[0];

    if (!toetsFile || !modelFile)
      return res.status(400).json({ error: 'Beide bestanden verplicht' });

    const modelTekst = await extractTekst(modelFile.buffer, modelFile.mimetype);

    const beeldTypes = ['image/jpeg','image/png','image/gif','image/webp'];
    const imgType = beeldTypes.includes(toetsFile.mimetype)
      ? toetsFile.mimetype : 'image/jpeg';

    const claudeResp = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: INLEZEN_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: imgType, data: toetsFile.buffer.toString('base64') } },
          { type: 'text', text: inlezenUser(modelTekst) },
        ],
      }],
    });

    const inlezing = parseClaudeJSON(claudeResp.content[0].text);
    const leraarId = req.leraar?.id || null;

    const { data: sessie, error: sessieErr } = await supabase
      .from('nakijk_sessies')
      .insert({
        naam_op_toets:  inlezing.leerling_naam,
        naam_zekerheid: inlezing.naam_zekerheid,
        toets_naam:     inlezing.toets_naam,
        vak:            inlezing.vak,
        niveau:         inlezing.niveau,
        aantal_vragen:  inlezing.vragen.length,
        max_score:      inlezing.max_score_totaal,
        status:         'ingelezen',
        leraar_id:      leraarId,
      })
      .select().single();

    if (sessieErr) throw sessieErr;

    const { error: antErr } = await supabase
      .from('nakijk_antwoorden')
      .insert(inlezing.vragen.map(v => ({
        sessie_id:       sessie.id,
        vraagnummer:     v.vraagnummer,
        vraag_tekst:     v.vraag_tekst,
        max_score:       v.max_score,
        modelantwoord:   v.modelantwoord,
        puntenverdeling: v.puntenverdeling,
        antwoord_rauw:   v.antwoord_rauw,
        antwoord_finaal: v.antwoord_rauw,
        leeszekerheid:   v.leeszekerheid,
        lees_opmerking:  v.lees_opmerking || null,
      })));

    if (antErr) throw antErr;

    res.json({ success: true, sessie_id: sessie.id, inlezing });

  } catch (err) {
    console.error('[nakijk/inlezen]', err);
    res.status(500).json({ error: 'Fout bij inlezen', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 2 — POST /api/nakijk/koppelen
// ════════════════════════════════════════════════════════════
router.post('/koppelen', async (req, res) => {
  try {
    const { supabase } = clients(req);
    const { sessie_id, leerling_id, naam, lesperiode } = req.body;

    // A: Zoek kandidaten
    if (naam && !leerling_id) {
      let q = supabase
        .from('leerlingen_import')
        .select('id, stamnummer, roepnaam, tussenvoegsel, achternaam, klas, leerjaar, leerniveau');
      if (lesperiode) q = q.eq('lesperiode', lesperiode);
      const { data: leerlingen, error } = await q;
      if (error) throw error;
      return res.json({ success: true, kandidaten: zoekKandidaten(naam, leerlingen || []) });
    }

    // B: Bevestig koppeling
    if (sessie_id && leerling_id) {
      const { error } = await supabase
        .from('nakijk_sessies')
        .update({ leerling_id, status: 'gekoppeld' })
        .eq('id', sessie_id);
      if (error) throw error;
      return res.json({ success: true });
    }

    res.status(400).json({ error: 'Geef naam of sessie_id + leerling_id' });

  } catch (err) {
    console.error('[nakijk/koppelen]', err);
    res.status(500).json({ error: 'Fout bij koppelen', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 3 — POST /api/nakijk/verificeren
// ════════════════════════════════════════════════════════════
router.post('/verificeren', async (req, res) => {
  try {
    const { supabase } = clients(req);
    const { sessie_id, antwoorden } = req.body;
    if (!sessie_id || !antwoorden?.length)
      return res.status(400).json({ error: 'sessie_id en antwoorden verplicht' });

    for (const a of antwoorden) {
      const { error } = await supabase
        .from('nakijk_antwoorden')
        .update({ antwoord_finaal: a.antwoord_finaal })
        .eq('sessie_id', sessie_id)
        .eq('vraagnummer', a.vraagnummer);
      if (error) throw error;
    }

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
// ════════════════════════════════════════════════════════════
router.post('/nakijken', async (req, res) => {
  try {
    const { supabase, anthropic } = clients(req);
    const { sessie_id } = req.body;
    if (!sessie_id) return res.status(400).json({ error: 'sessie_id verplicht' });

    const { data: antwoorden, error: fetchErr } = await supabase
      .from('nakijk_antwoorden')
      .select('*')
      .eq('sessie_id', sessie_id)
      .order('vraagnummer');
    if (fetchErr) throw fetchErr;

    const claudeResp = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: NAKIJKEN_SYSTEM,
      messages: [{ role: 'user', content: nakijkenUser(antwoorden.map(a => ({
        vraagnummer:       a.vraagnummer,
        vraag_tekst:       a.vraag_tekst,
        max_score:         a.max_score,
        modelantwoord:     a.modelantwoord,
        puntenverdeling:   a.puntenverdeling,
        antwoord_leerling: a.antwoord_finaal,
      }))) }],
    });

    const beoordeling = parseClaudeJSON(claudeResp.content[0].text);

    for (const vb of beoordeling.vragen) {
      await supabase
        .from('nakijk_antwoorden')
        .update({ score: vb.score, behaalde_punten: vb.behaalde_punten, feedback: vb.feedback, argumentatie: vb.argumentatie })
        .eq('sessie_id', sessie_id)
        .eq('vraagnummer', vb.vraagnummer);
    }

    await supabase
      .from('nakijk_sessies')
      .update({ totaal_score: beoordeling.totaal_score, cijfer_suggestie: beoordeling.cijfer_suggestie, algemene_opmerking: beoordeling.algemene_opmerking, status: 'nagekeken' })
      .eq('id', sessie_id);

    res.json({ success: true, sessie_id, beoordeling });

  } catch (err) {
    console.error('[nakijk/nakijken]', err);
    res.status(500).json({ error: 'Fout bij nakijken', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 5 — PATCH /api/nakijk/score
// ════════════════════════════════════════════════════════════
router.patch('/score', async (req, res) => {
  try {
    const { supabase } = clients(req);
    const { sessie_id, vraagnummer, score, notitie, feedback } = req.body;

    // Bouw update object op — sla feedback op als die meegegeven is
    const updateData = { score, score_aangepast: true };
    if (notitie !== undefined) updateData.argumentatie = notitie;
    if (feedback !== undefined) updateData.feedback = feedback;

    await supabase
      .from('nakijk_antwoorden')
      .update(updateData)
      .eq('sessie_id', sessie_id)
      .eq('vraagnummer', vraagnummer);

    const { data: alle } = await supabase
      .from('nakijk_antwoorden').select('score, max_score').eq('sessie_id', sessie_id);

    const totaal = alle.reduce((s, a) => s + (Number(a.score) || 0), 0);
    const max    = alle.reduce((s, a) => s + (Number(a.max_score) || 0), 0);
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
// ════════════════════════════════════════════════════════════
router.post('/afronden', async (req, res) => {
  try {
    const { supabase } = clients(req);
    const { sessie_id, cijfer_definitief, docent_notitie } = req.body;

    await supabase
      .from('nakijk_sessies')
      .update({ cijfer_definitief, docent_notitie, status: 'afgerond' })
      .eq('id', sessie_id);

    res.json({ success: true });

  } catch (err) {
    console.error('[nakijk/afronden]', err);
    res.status(500).json({ error: 'Fout bij afronden', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 7 — GET /api/nakijk/sessie/:id
// ════════════════════════════════════════════════════════════
router.get('/sessie/:id', async (req, res) => {
  try {
    const { supabase } = clients(req);

    const { data: sessie, error } = await supabase
      .from('nakijk_sessies')
      .select('*, antwoorden:nakijk_antwoorden(*)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;

    if (sessie.leerling_id) {
      const { data: leerling } = await supabase
        .from('leerlingen_import')
        .select('id, stamnummer, roepnaam, tussenvoegsel, achternaam, klas')
        .eq('id', sessie.leerling_id)
        .single();
      sessie.leerling = leerling;
    }

    res.json({ success: true, sessie });

  } catch (err) {
    console.error('[nakijk/sessie]', err);
    res.status(500).json({ error: 'Sessie niet gevonden', details: err.message });
  }
});



// ════════════════════════════════════════════════════════════
// ROUTE 8 — GET /api/nakijk/overzicht
// Alle sessies van de ingelogde leraar, meest recent eerst
// ════════════════════════════════════════════════════════════
router.get('/overzicht', async (req, res) => {
  try {
    optionalAuth(req);
    const { supabase } = clients(req);
    const leraarId = req.leraar?.id || null;

    let query = supabase
      .from('nakijk_sessies')
      .select(`
        id, naam_op_toets, toets_naam, niveau, vak,
        totaal_score, max_score, cijfer_suggestie, cijfer_definitief,
        status, created_at, leerling_id
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    // Filter op leraar als die bekend is
    if (leraarId) query = query.eq('leraar_id', leraarId);

    const { data: sessies, error } = await query;
    if (error) throw error;

    // Voeg leerlingnaam toe per sessie
    const sessiesMetNaam = await Promise.all((sessies || []).map(async s => {
      if (s.leerling_id) {
        const { data: ll } = await supabase
          .from('leerlingen_import')
          .select('roepnaam, tussenvoegsel, achternaam')
          .eq('id', s.leerling_id)
          .single();
        if (ll) {
          s.leerling_naam = [ll.roepnaam, ll.tussenvoegsel, ll.achternaam]
            .filter(Boolean).join(' ');
        }
      }
      return s;
    }));

    res.json({ success: true, sessies: sessiesMetNaam });

  } catch (err) {
    console.error('[nakijk/overzicht]', err);
    res.status(500).json({ error: 'Fout bij laden overzicht', details: err.message });
  }
});

module.exports = router;
