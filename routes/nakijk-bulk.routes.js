// ============================================================
// NAKIJK BULK — Express routes
// Kijkt een complete klas na vanuit één PDF
//
// Voeg toe aan server.js:
//   const nakijkBulkRouter = require('./routes/nakijk-bulk.routes');
//   app.use('/api/nakijk/bulk', nakijkBulkRouter);
//
// Extra package:
//   npm install pdf-lib
// ============================================================

const express   = require('express');
const multer    = require('multer');
const mammoth   = require('mammoth');
const pdfParse  = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

function clients(req) {
  return { supabase: req.app.locals.supabase, anthropic: req.app.locals.anthropic };
}

function optionalAuth(req) {
  try {
    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      const jwt = require('jsonwebtoken');
      req.leraar = jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'stanislascollege_mol_secret_2025');
    }
  } catch(e) {}
}

function parseClaudeJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); }
  catch { const m = clean.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('Geen geldige JSON'); }
}

async function extractTekst(buffer, mimetype) {
  if (mimetype === 'application/pdf') return (await pdfParse(buffer)).text;
  if (mimetype.includes('wordprocessingml') || mimetype.includes('msword'))
    return (await mammoth.extractRawText({ buffer })).value;
  return buffer.toString('utf8');
}

// ── Split PDF in losse pagina-buffers ────────────────────
async function splitPDFInPaginas(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const aantalPaginas = pdfDoc.getPageCount();
  const paginas = [];
  for (let i = 0; i < aantalPaginas; i++) {
    const nieuwDoc = await PDFDocument.create();
    const [pagina] = await nieuwDoc.copyPages(pdfDoc, [i]);
    nieuwDoc.addPage(pagina);
    const bytes = await nieuwDoc.save();
    paginas.push(Buffer.from(bytes));
  }
  return paginas;
}

// ── Segmenteer één pagina ─────────────────────────────────
async function segmenteerPagina(paginaNr, pdfBuffer, anthropic) {
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: `Je analyseert één pagina van een handgeschreven toets. Reageer ALLEEN met geldige JSON, geen uitleg.`,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBuffer.toString('base64') },
          },
          {
            type: 'text',
            text: `Analyseer deze pagina en geef terug als JSON:
{
  "naam_gevonden": true/false,
  "naam": "Voornaam Achternaam of null",
  "naam_zekerheid": "hoog/middel/laag/geen",
  "vraagnummers": [lijst van vraagnummers zichtbaar op deze pagina],
  "is_eerste_pagina": true als dit een voorblad of eerste pagina lijkt
}`,
          },
        ],
      }],
    });
    const data = parseClaudeJSON(resp.content[0].text);
    return { pagina_nr: paginaNr, ...data, fout: null };
  } catch(e) {
    return {
      pagina_nr: paginaNr, naam_gevonden: false, naam: null,
      naam_zekerheid: 'geen', vraagnummers: [], is_eerste_pagina: false, fout: e.message,
    };
  }
}

// ── Groepeer pagina's per leerling ────────────────────────
async function groepeerPaginas(paginaMetadata, leerlingenLijst, anthropic) {
  const leerlingenNamen = leerlingenLijst.map(l =>
    [l.roepnaam, l.tussenvoegsel, l.achternaam].filter(Boolean).join(' ')
  );

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: `Je groepeert pagina's van handgeschreven toetsen per leerling.
Gebruik: namen op pagina's, continuïteit van vraagnummers, en logische volgorde.
Reageer ALLEEN met geldige JSON, geen uitleg.`,
    messages: [{
      role: 'user',
      content: `Groepeer de volgende pagina's per leerling.

Bekende leerlingen in de klas:
${leerlingenNamen.map((n,i) => `${i+1}. ${n}`).join('\n')}

Pagina metadata:
${JSON.stringify(paginaMetadata, null, 2)}

Geef terug als JSON:
{
  "groepen": [
    {
      "leerling_naam": "naam zoals gevonden op toets",
      "paginas": [1, 2, 3],
      "volgorde": [1, 2, 3],
      "zekerheid": "hoog/middel/laag",
      "reden": "korte uitleg"
    }
  ],
  "niet_herkend": [paginanummers die niet gekoppeld konden worden]
}`,
    }],
  });
  return parseClaudeJSON(resp.content[0].text);
}

// ── Match leerlingnaam aan leerlingen_import ──────────────
function lev(a, b) {
  const dp = Array.from({ length: a.length+1 }, (_,i) =>
    Array.from({ length: b.length+1 }, (_,j) => i===0?j:j===0?i:0));
  for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++)
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[a.length][b.length];
}
function matchLeerlingId(naam, leerlingen) {
  if (!naam) return null;
  const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  const a = norm(naam);
  let beste = null, besteScore = 0;
  for (const l of leerlingen) {
    const b = norm([l.roepnaam, l.tussenvoegsel, l.achternaam].filter(Boolean).join(' '));
    const mx = Math.max(a.length, b.length);
    if (!mx) continue;
    const score = (1 - lev(a,b)/mx) * 100;
    if (score > besteScore) { besteScore = score; beste = l; }
  }
  return besteScore >= 50 ? { leerling: beste, score: Math.round(besteScore) } : null;
}


// ════════════════════════════════════════════════════════════
// ROUTE 1 — POST /api/nakijk/bulk/upload
// Upload klas-PDF + antwoordmodel → maak sessie aan
// ════════════════════════════════════════════════════════════
router.post('/upload', upload.fields([
  { name: 'toetsen', maxCount: 1 },
  { name: 'antwoordmodel', maxCount: 1 },
]), async (req, res) => {
  try {
    optionalAuth(req);
    const { supabase, anthropic } = clients(req);
    const toetsenFile   = req.files?.toetsen?.[0];
    const modelFile     = req.files?.antwoordmodel?.[0];
    const { klas_naam, lesperiode } = req.body;

    if (!toetsenFile || !modelFile || !klas_naam)
      return res.status(400).json({ error: 'toetsen, antwoordmodel en klas_naam zijn verplicht' });

    // 1. Extraheer antwoordmodel tekst
    const modelTekst = await extractTekst(modelFile.buffer, modelFile.mimetype);

    // 2. Detecteer vraagstructuur uit antwoordmodel
    const modelResp = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: 'Analyseer een antwoordmodel en geef structuur terug als JSON. Geen uitleg.',
      messages: [{ role: 'user', content: `${modelTekst}\n\nGeef JSON: {"toets_naam":"...","niveau":"...","max_score":20,"aantal_vragen":5,"vragen":[{"nr":1,"max_score":3,"modelantwoord":"...","puntenverdeling":[{"onderdeel":"...","punten":1}]}]}` }],
    });
    const modelData = parseClaudeJSON(modelResp.content[0].text);

    // 3. Split PDF in pagina's
    const paginaBuffers = await splitPDFInPaginas(toetsenFile.buffer);
    const aantalPaginas = paginaBuffers.length;

    // 4. Sla antwoordmodel op in Storage
    let antwoordmodelUrl = null;
    try {
      const modelNaam = `antwoordmodellen/${Date.now()}_model.pdf`;
      const { data: ulData } = await supabase.storage
        .from('nakijk-toetsen').upload(modelNaam, modelFile.buffer, { contentType: 'application/pdf' });
      if (ulData) {
        const { data: urlData } = supabase.storage.from('nakijk-toetsen').getPublicUrl(modelNaam);
        antwoordmodelUrl = urlData?.publicUrl;
      }
    } catch(e) { console.warn('antwoordmodel opslaan mislukt:', e.message); }

    // 5. Maak bulk sessie aan
    const { data: sessie, error: sessieErr } = await supabase
      .from('nakijk_bulk_sessies')
      .insert({
        leraar_id:        req.leraar?.id || null,
        klas_naam,
        toets_naam:       modelData.toets_naam || 'Onbekende toets',
        niveau:           modelData.niveau,
        antwoordmodel_url: antwoordmodelUrl,
        totaal_paginas:   aantalPaginas,
        max_score:        modelData.max_score,
        aantal_vragen:    modelData.aantal_vragen,
        status:           'segmenting',
      })
      .select().single();
    if (sessieErr) throw sessieErr;

    // 6. Upload pagina's naar Storage + sla metadata op
    const paginaRijen = [];
    for (let i = 0; i < paginaBuffers.length; i++) {
      let paginaUrl = null;
      try {
        const naam = `bulk/${sessie.id}/pagina-${String(i+1).padStart(3,'0')}.pdf`;
        const { data: ulData } = await supabase.storage
          .from('nakijk-toetsen').upload(naam, paginaBuffers[i], { contentType: 'application/pdf' });
        if (ulData) {
          const { data: urlData } = supabase.storage.from('nakijk-toetsen').getPublicUrl(naam);
          paginaUrl = urlData?.publicUrl;
        }
      } catch(e) { console.warn(`pagina ${i+1} opslaan mislukt`); }

      paginaRijen.push({
        bulk_sessie_id: sessie.id,
        pagina_nr:      i + 1,
        pagina_url:     paginaUrl,
      });
    }

    const { error: paginaErr } = await supabase
      .from('nakijk_bulk_paginas').insert(paginaRijen);
    if (paginaErr) throw paginaErr;

    res.json({
      success: true,
      sessie_id:      sessie.id,
      totaal_paginas: aantalPaginas,
      model_data:     modelData,
      // Stuur pagina buffers terug als base64 voor de segmentatie call
      pagina_buffers: paginaBuffers.map((b,i) => ({ nr: i+1, data: b.toString('base64') })),
    });
  } catch(err) {
    console.error('[bulk/upload]', err);
    res.status(500).json({ error: 'Upload mislukt', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 2 — POST /api/nakijk/bulk/segmenteren
// Lees elke pagina uit (parallel, in batches)
// ════════════════════════════════════════════════════════════
router.post('/segmenteren', async (req, res) => {
  try {
    optionalAuth(req);
    const { supabase, anthropic } = clients(req);
    const { sessie_id } = req.body;
    if (!sessie_id) return res.status(400).json({ error: 'sessie_id verplicht' });

    // Haal pagina URLs op
    const { data: paginas } = await supabase
      .from('nakijk_bulk_paginas').select('*')
      .eq('bulk_sessie_id', sessie_id).order('pagina_nr');

    if (!paginas?.length) return res.status(404).json({ error: 'Geen paginas gevonden' });

    // Download pagina's en segmenteer in batches van 8
    const BATCH = 8;
    const resultaten = [];

    for (let i = 0; i < paginas.length; i += BATCH) {
      const batch = paginas.slice(i, i + BATCH);

      const batchResultaten = await Promise.all(batch.map(async (p) => {
        // Download de pagina PDF
        let pdfBuffer;
        try {
          const resp = await fetch(p.pagina_url);
          const ab = await resp.arrayBuffer();
          pdfBuffer = Buffer.from(ab);
        } catch(e) {
          return { pagina_nr: p.pagina_nr, fout: 'Download mislukt: ' + e.message };
        }
        return segmenteerPagina(p.pagina_nr, pdfBuffer, anthropic);
      }));

      // Sla resultaten op in Supabase
      for (const r of batchResultaten) {
        await supabase.from('nakijk_bulk_paginas')
          .update({
            naam_gelezen:    r.naam || null,
            naam_zekerheid:  r.naam_zekerheid || 'geen',
            vraagnummers:    r.vraagnummers || [],
            is_eerste_pagina: r.is_eerste_pagina || false,
          })
          .eq('bulk_sessie_id', sessie_id)
          .eq('pagina_nr', r.pagina_nr);
      }

      resultaten.push(...batchResultaten);
    }

    res.json({ success: true, resultaten });
  } catch(err) {
    console.error('[bulk/segmenteren]', err);
    res.status(500).json({ error: 'Segmentatie mislukt', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 3 — POST /api/nakijk/bulk/groeperen
// Groepeer pagina's per leerling via Claude
// ════════════════════════════════════════════════════════════
router.post('/groeperen', async (req, res) => {
  try {
    optionalAuth(req);
    const { supabase, anthropic } = clients(req);
    const { sessie_id, lesperiode } = req.body;
    if (!sessie_id) return res.status(400).json({ error: 'sessie_id verplicht' });

    // Haal pagina metadata op
    const { data: paginas } = await supabase
      .from('nakijk_bulk_paginas').select('*')
      .eq('bulk_sessie_id', sessie_id).order('pagina_nr');

    // Haal sessie op voor klas_naam
    const { data: sessie } = await supabase
      .from('nakijk_bulk_sessies').select('*').eq('id', sessie_id).single();

    // Haal leerlingen op
    let leerlingenQuery = supabase.from('leerlingen_import')
      .select('id, roepnaam, tussenvoegsel, achternaam, klas, stamnummer');
    if (sessie?.klas_naam) leerlingenQuery = leerlingenQuery.eq('klas', sessie.klas_naam);
    if (lesperiode) leerlingenQuery = leerlingenQuery.eq('lesperiode', lesperiode);
    const { data: leerlingen } = await leerlingenQuery;

    const paginaMetadata = paginas.map(p => ({
      pagina_nr:        p.pagina_nr,
      naam_gevonden:    !!p.naam_gelezen,
      naam:             p.naam_gelezen,
      naam_zekerheid:   p.naam_zekerheid,
      vraagnummers:     p.vraagnummers || [],
      is_eerste_pagina: p.is_eerste_pagina,
    }));

    const groepering = await groepeerPaginas(paginaMetadata, leerlingen || [], anthropic);

    // Koppel leerling-IDs en sla op
    for (const groep of (groepering.groepen || [])) {
      const match = matchLeerlingId(groep.leerling_naam, leerlingen || []);
      const leerlingId = match?.leerling?.id || null;
      const zekerheid = match?.score >= 85 ? groep.zekerheid || 'hoog'
                      : match?.score >= 60 ? 'middel' : 'laag';

      for (let idx = 0; idx < groep.paginas.length; idx++) {
        await supabase.from('nakijk_bulk_paginas')
          .update({
            leerling_id:         leerlingId,
            volgorde_in_toets:   groep.volgorde?.[idx] ?? (idx + 1),
            koppeling_zekerheid: leerlingId ? zekerheid : 'laag',
          })
          .eq('bulk_sessie_id', sessie_id)
          .eq('pagina_nr', groep.paginas[idx]);
      }
    }

    // Pagina's die niet herkend zijn krijgen koppeling_zekerheid = 'onbekend'
    for (const nr of (groepering.niet_herkend || [])) {
      await supabase.from('nakijk_bulk_paginas')
        .update({ leerling_id: null, koppeling_zekerheid: 'onbekend' })
        .eq('bulk_sessie_id', sessie_id).eq('pagina_nr', nr);
    }

    // Update status
    await supabase.from('nakijk_bulk_sessies')
      .update({ status: 'verificatie' }).eq('id', sessie_id);

    // Haal bijgewerkte paginas op voor de response
    const { data: bijgewerkt } = await supabase
      .from('nakijk_bulk_paginas').select('*')
      .eq('bulk_sessie_id', sessie_id).order('pagina_nr');

    // Bouw leerling-overzicht
    const leerlingMap = {};
    for (const p of bijgewerkt) {
      if (!p.leerling_id) {
        if (!leerlingMap['__onbekend__']) leerlingMap['__onbekend__'] = [];
        leerlingMap['__onbekend__'].push(p);
        continue;
      }
      if (!leerlingMap[p.leerling_id]) leerlingMap[p.leerling_id] = [];
      leerlingMap[p.leerling_id].push(p);
    }

    res.json({
      success: true,
      sessie_id,
      groepering,
      leerling_map: leerlingMap,
      leerlingen:   leerlingen || [],
    });
  } catch(err) {
    console.error('[bulk/groeperen]', err);
    res.status(500).json({ error: 'Groeperen mislukt', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 4 — PATCH /api/nakijk/bulk/pagina/:id
// Wijs een pagina toe aan een andere leerling (handmatig)
// ════════════════════════════════════════════════════════════
router.patch('/pagina/:id', async (req, res) => {
  try {
    const { supabase } = clients(req);
    const { leerling_id, volgorde_in_toets } = req.body;

    const { error } = await supabase
      .from('nakijk_bulk_paginas')
      .update({
        leerling_id,
        volgorde_in_toets: volgorde_in_toets || null,
        handmatig_toegewezen: true,
        koppeling_zekerheid: leerling_id ? 'hoog' : 'onbekend',
      })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch(err) {
    console.error('[bulk/pagina PATCH]', err);
    res.status(500).json({ error: 'Bijwerken mislukt', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 5 — POST /api/nakijk/bulk/nakijken
// Kijk alle leerlingen na (parallel)
// ════════════════════════════════════════════════════════════
router.post('/nakijken', async (req, res) => {
  try {
    optionalAuth(req);
    const { supabase, anthropic } = clients(req);
    const { sessie_id } = req.body;
    if (!sessie_id) return res.status(400).json({ error: 'sessie_id verplicht' });

    const { data: bulkSessie } = await supabase
      .from('nakijk_bulk_sessies').select('*').eq('id', sessie_id).single();

    // Haal alle paginas op, gegroepeerd per leerling
    const { data: paginas } = await supabase
      .from('nakijk_bulk_paginas').select('*')
      .eq('bulk_sessie_id', sessie_id)
      .not('leerling_id', 'is', null)
      .order('leerling_id').order('volgorde_in_toets');

    // Groepeer per leerling
    const perLeerling = {};
    for (const p of paginas) {
      if (!perLeerling[p.leerling_id]) perLeerling[p.leerling_id] = [];
      perLeerling[p.leerling_id].push(p);
    }

    // Haal antwoordmodel op
    let antwoordmodelTekst = '';
    if (bulkSessie.antwoordmodel_url) {
      try {
        const resp = await fetch(bulkSessie.antwoordmodel_url);
        const buf = Buffer.from(await resp.arrayBuffer());
        antwoordmodelTekst = (await pdfParse(buf)).text;
      } catch(e) { console.warn('antwoordmodel laden mislukt'); }
    }

    const NAKIJK_SYSTEM = `Je bent een ervaren economiedocent die toetsen nauwkeurig nakijkt.
Beoordeel inhoudelijk — antwoord hoeft niet letterlijk overeen te komen als de strekking klopt.
Gedeeltelijke punten zijn mogelijk. Leeg of null antwoord → score 0.
Cijfer: (score/max)*9 + 1, afgerond op 1 decimaal.
Reageer UITSLUITEND met geldig JSON. Geen markdown, geen backticks.`;

    const resultaten = [];
    const BATCH = 5; // Nakijken is zwaarder, kleinere batches
    const leerlingIds = Object.keys(perLeerling);

    for (let i = 0; i < leerlingIds.length; i += BATCH) {
      const batch = leerlingIds.slice(i, i + BATCH);

      const batchResultaten = await Promise.all(batch.map(async (leerlingId) => {
        const llPaginas = perLeerling[leerlingId].sort((a,b) => a.volgorde_in_toets - b.volgorde_in_toets);

        try {
          // Download pagina's
          const paginaContent = [];
          for (const p of llPaginas) {
            const pResp = await fetch(p.pagina_url);
            const pBuf = Buffer.from(await pResp.arrayBuffer());
            paginaContent.push({
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pBuf.toString('base64') },
            });
          }

          // Lees antwoorden uit + kijk na in één call
          const claudeResp = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            system: NAKIJK_SYSTEM,
            messages: [{
              role: 'user',
              content: [
                ...paginaContent,
                {
                  type: 'text',
                  text: `Dit zijn de toetspagina's van één leerling.

ANTWOORDMODEL:
${antwoordmodelTekst}

Lees de antwoorden van de leerling uit en kijk ze direct na.
Geef terug als JSON:
{
  "leerling_naam": "naam van de toets",
  "vragen": [
    {
      "vraagnummer": 1,
      "antwoord_leerling": "uitgelezen antwoord",
      "leeszekerheid": "zeker/twijfelachtig/onleesbaar",
      "score": 2,
      "max_score": 3,
      "behaalde_punten": [{"onderdeel":"...","behaald":true}],
      "feedback": "feedback voor leerling",
      "argumentatie": "toelichting voor docent"
    }
  ],
  "totaal_score": 13,
  "max_score": 20,
  "cijfer_suggestie": 6.8,
  "algemene_opmerking": "algemeen beeld"
}`,
                },
              ],
            }],
          });

          const beoordeling = parseClaudeJSON(claudeResp.content[0].text);

          // Maak nakijk_sessie aan voor deze leerling
          const { data: sessie, error: sessieErr } = await supabase
            .from('nakijk_sessies')
            .insert({
              naam_op_toets:      beoordeling.leerling_naam || null,
              naam_zekerheid:     'hoog',
              toets_naam:         bulkSessie.toets_naam,
              vak:                bulkSessie.vak,
              niveau:             bulkSessie.niveau,
              aantal_vragen:      beoordeling.vragen.length,
              max_score:          beoordeling.max_score,
              totaal_score:       beoordeling.totaal_score,
              cijfer_suggestie:   beoordeling.cijfer_suggestie,
              algemene_opmerking: beoordeling.algemene_opmerking,
              status:             'nagekeken',
              leerling_id:        leerlingId,
              leraar_id:          req.leraar?.id || null,
              bulk_sessie_id:     sessie_id,
              toets_url:          llPaginas[0]?.pagina_url || null,
            })
            .select().single();

          if (sessieErr) throw sessieErr;

          // Sla antwoorden op
          await supabase.from('nakijk_antwoorden').insert(
            beoordeling.vragen.map(v => ({
              sessie_id:       sessie.id,
              vraagnummer:     v.vraagnummer,
              vraag_tekst:     v.vraag_tekst || null,
              max_score:       v.max_score,
              antwoord_rauw:   v.antwoord_leerling,
              antwoord_finaal: v.antwoord_leerling,
              leeszekerheid:   v.leeszekerheid || 'zeker',
              score:           v.score,
              behaalde_punten: v.behaalde_punten,
              feedback:        v.feedback,
              argumentatie:    v.argumentatie,
            }))
          );

          return { leerling_id: leerlingId, sessie_id: sessie.id, beoordeling, ok: true };

        } catch(e) {
          console.error(`Nakijken leerling ${leerlingId} mislukt:`, e.message);
          return { leerling_id: leerlingId, ok: false, fout: e.message };
        }
      }));

      resultaten.push(...batchResultaten);
    }

    // Update bulk sessie status
    await supabase.from('nakijk_bulk_sessies')
      .update({ status: 'afgerond' }).eq('id', sessie_id);

    const gelukt = resultaten.filter(r => r.ok).length;
    res.json({ success: true, sessie_id, gelukt, totaal: leerlingIds.length, resultaten });

  } catch(err) {
    console.error('[bulk/nakijken]', err);
    res.status(500).json({ error: 'Nakijken mislukt', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 6 — GET /api/nakijk/bulk/sessie/:id
// Volledige bulk sessie ophalen (paginas + leerlinginformatie)
// ════════════════════════════════════════════════════════════
router.get('/sessie/:id', async (req, res) => {
  try {
    const { supabase } = clients(req);

    const { data: sessie, error } = await supabase
      .from('nakijk_bulk_sessies').select('*').eq('id', req.params.id).single();
    if (error) throw error;

    const { data: paginas } = await supabase
      .from('nakijk_bulk_paginas').select('*')
      .eq('bulk_sessie_id', req.params.id).order('pagina_nr');

    // Nakijk sessies die aan deze bulk sessie zijn gekoppeld
    const { data: nakijkSessies } = await supabase
      .from('nakijk_sessies')
      .select('id, leerling_id, naam_op_toets, totaal_score, max_score, cijfer_suggestie, cijfer_definitief, status, algemene_opmerking')
      .eq('bulk_sessie_id', req.params.id);

    // Leerlinginformatie ophalen
    const leerlingIds = [...new Set(paginas.filter(p => p.leerling_id).map(p => p.leerling_id))];
    let leerlingen = [];
    if (leerlingIds.length) {
      const { data: ll } = await supabase
        .from('leerlingen_import')
        .select('id, roepnaam, tussenvoegsel, achternaam, klas, stamnummer')
        .in('id', leerlingIds);
      leerlingen = ll || [];
    }

    res.json({ success: true, sessie, paginas: paginas || [], nakijk_sessies: nakijkSessies || [], leerlingen });
  } catch(err) {
    console.error('[bulk/sessie GET]', err);
    res.status(500).json({ error: 'Laden mislukt', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 7 — GET /api/nakijk/bulk/overzicht
// Lijst van bulk sessies van deze leraar
// ════════════════════════════════════════════════════════════
router.get('/overzicht', async (req, res) => {
  try {
    optionalAuth(req);
    const { supabase } = clients(req);
    const leraarId = req.leraar?.id || null;

    let query = supabase
      .from('nakijk_bulk_sessies')
      .select('id, klas_naam, toets_naam, niveau, totaal_paginas, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (leraarId) query = query.eq('leraar_id', leraarId);

    const { data: sessies, error } = await query;
    if (error) throw error;
    res.json({ success: true, sessies: sessies || [] });
  } catch(err) {
    console.error('[bulk/overzicht]', err);
    res.status(500).json({ error: 'Laden mislukt', details: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 8 — GET /api/nakijk/bulk/resultaten/:id
// Nakijkresultaten per leerling voor een bulk sessie
// ════════════════════════════════════════════════════════════
router.get('/resultaten/:id', async (req, res) => {
  try {
    const { supabase } = clients(req);

    const { data: nakijkSessies, error } = await supabase
      .from('nakijk_sessies')
      .select('*, antwoorden:nakijk_antwoorden(*)')
      .eq('bulk_sessie_id', req.params.id)
      .order('created_at');

    if (error) throw error;

    // Verrijk met leerlingdata
    const resultaten = await Promise.all((nakijkSessies || []).map(async s => {
      if (s.leerling_id) {
        const { data: ll } = await supabase
          .from('leerlingen_import')
          .select('id, roepnaam, tussenvoegsel, achternaam, klas, stamnummer')
          .eq('id', s.leerling_id).single();
        s.leerling = ll;
      }
      return s;
    }));

    // Bereken statistieken
    const cijfers = resultaten
      .map(r => r.cijfer_definitief ?? r.cijfer_suggestie)
      .filter(c => c !== null && c !== undefined);
    const gemiddeld = cijfers.length
      ? Math.round(cijfers.reduce((a,b) => a+b, 0) / cijfers.length * 10) / 10
      : null;
    const geslaagd = cijfers.filter(c => c >= 5.5).length;

    res.json({
      success: true,
      resultaten,
      statistieken: {
        gemiddeld_cijfer: gemiddeld,
        geslaagd,
        totaal: resultaten.length,
        cijfers,
      },
    });
  } catch(err) {
    console.error('[bulk/resultaten]', err);
    res.status(500).json({ error: 'Laden mislukt', details: err.message });
  }
});


module.exports = router;
