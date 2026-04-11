// ============================================================
// NAKIJK BULK — Express routes (vereenvoudigd)
// Alles in één upload-call: split → segmenteer → groepeer
// Geen Storage-afhankelijkheid voor kerntaken
// ============================================================

const express   = require('express');
const multer    = require('multer');
const mammoth   = require('mammoth');
const pdfParse  = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 },
});

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
  catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Geen geldige JSON in Claude-respons');
  }
}

async function extractTekst(buffer, mimetype) {
  if (mimetype === 'application/pdf') return (await pdfParse(buffer)).text;
  if (mimetype.includes('wordprocessingml') || mimetype.includes('msword'))
    return (await mammoth.extractRawText({ buffer })).value;
  return buffer.toString('utf8');
}

async function splitPDF(pdfBuffer) {
  const doc = await PDFDocument.load(pdfBuffer);
  const n = doc.getPageCount();
  const buffers = [];
  for (let i = 0; i < n; i++) {
    const nieuw = await PDFDocument.create();
    const [p] = await nieuw.copyPages(doc, [i]);
    nieuw.addPage(p);
    buffers.push(Buffer.from(await nieuw.save()));
  }
  return buffers;
}

async function segmenteerPagina(nr, pdfBuffer, anthropic) {
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: 'Je analyseert één pagina van een handgeschreven toets. Reageer ALLEEN met geldige JSON.',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBuffer.toString('base64') },
          },
          {
            type: 'text',
            text: `Analyseer deze pagina. Geef terug als JSON:
{
  "naam_gevonden": true,
  "naam": "Voornaam Achternaam of null",
  "naam_zekerheid": "hoog/middel/laag/geen",
  "vraagnummers": [1, 2],
  "is_eerste_pagina": true
}`,
          },
        ],
      }],
    });
    return { pagina_nr: nr, ...parseClaudeJSON(resp.content[0].text) };
  } catch(e) {
    console.warn(`[bulk] pagina ${nr} segmentatie fout:`, e.message);
    return { pagina_nr: nr, naam_gevonden: false, naam: null, naam_zekerheid: 'geen', vraagnummers: [], is_eerste_pagina: false };
  }
}

async function groepeerPaginas(paginaMeta, leerlingen, anthropic) {
  const namen = leerlingen.map(l =>
    [l.roepnaam, l.tussenvoegsel, l.achternaam].filter(Boolean).join(' ')
  );
  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: 'Je groepeert toetspaginas per leerling. Reageer ALLEEN met geldige JSON.',
    messages: [{
      role: 'user',
      content: `Groepeer paginas per leerling op basis van namen, vraagnummercontinuïteit en volgorde.

Bekende leerlingen:
${namen.map((n,i) => `${i+1}. ${n}`).join('\n') || '(geen leerlingenlijst beschikbaar)'}

Pagina metadata:
${JSON.stringify(paginaMeta, null, 2)}

Geef JSON:
{
  "groepen": [
    {
      "leerling_naam": "naam",
      "paginas": [1,2,3],
      "volgorde": [1,2,3],
      "zekerheid": "hoog/middel/laag"
    }
  ],
  "niet_herkend": [7, 15]
}`,
    }],
  });
  return parseClaudeJSON(resp.content[0].text);
}

function lev(a, b) {
  const dp = Array.from({ length: a.length+1 }, (_,i) =>
    Array.from({ length: b.length+1 }, (_,j) => i===0?j:j===0?i:0));
  for (let i=1; i<=a.length; i++)
    for (let j=1; j<=b.length; j++)
      dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

function matchLeerling(naam, leerlingen) {
  if (!naam || !leerlingen.length) return null;
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
  return besteScore >= 45 ? { leerling: beste, score: Math.round(besteScore) } : null;
}

// ── Optioneel: sla buffer op in Supabase Storage ─────────
async function slaOpInStorage(supabase, pad, buffer, contentType) {
  try {
    const { data, error } = await supabase.storage
      .from('nakijk-toetsen')
      .upload(pad, buffer, { contentType, upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('nakijk-toetsen').getPublicUrl(pad);
    return urlData?.publicUrl || null;
  } catch(e) {
    console.warn('[bulk] Storage upload mislukt (niet kritisch):', e.message);
    return null;
  }
}


// ════════════════════════════════════════════════════════════
// ROUTE 1 — POST /api/nakijk/bulk/upload
// Doet alles: split + segmenteer + groepeer in één call
// ════════════════════════════════════════════════════════════
router.post('/upload', upload.fields([
  { name: 'toetsen', maxCount: 1 },
  { name: 'antwoordmodel', maxCount: 1 },
]), async (req, res) => {
  try {
    optionalAuth(req);
    const { supabase, anthropic } = clients(req);
    const toetsenFile = req.files?.toetsen?.[0];
    const modelFile   = req.files?.antwoordmodel?.[0];
    const klas_naam   = req.body?.klas_naam || null;
    const lesperiode  = req.body?.lesperiode || null;

    if (!toetsenFile || !modelFile)
      return res.status(400).json({ error: 'Beide bestanden zijn verplicht (toetsen + antwoordmodel)' });

    console.log(`[bulk/upload] start: ${toetsenFile.originalname}, klas: ${klas_naam}`);

    // 1. Antwoordmodel analyseren
    const modelTekst = await extractTekst(modelFile.buffer, modelFile.mimetype);
    let modelData = { toets_naam: 'Onbekende toets', niveau: null, max_score: 20, aantal_vragen: 5 };
    try {
      const modelResp = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'Analyseer antwoordmodel. Reageer alleen met geldige JSON.',
        messages: [{ role: 'user', content: `${modelTekst}\n\nGeef JSON: {"toets_naam":"...","niveau":"...","max_score":20,"aantal_vragen":5}` }],
      });
      modelData = { ...modelData, ...parseClaudeJSON(modelResp.content[0].text) };
    } catch(e) { console.warn('[bulk] modelanalyse mislukt:', e.message); }

    // 2. PDF splitsen
    console.log('[bulk/upload] PDF splitsen...');
    const paginaBuffers = await splitPDF(toetsenFile.buffer);
    const aantalPaginas = paginaBuffers.length;
    console.log(`[bulk/upload] ${aantalPaginas} paginas`);

    // 3. Sessie aanmaken
    const { data: sessie, error: sessieErr } = await supabase
      .from('nakijk_bulk_sessies')
      .insert({
        leraar_id:     req.leraar?.id || null,
        klas_naam:     klas_naam || 'Onbekend',
        toets_naam:    modelData.toets_naam,
        niveau:        modelData.niveau,
        max_score:     modelData.max_score,
        aantal_vragen: modelData.aantal_vragen,
        totaal_paginas: aantalPaginas,
        status:        'segmenting',
      })
      .select().single();
    if (sessieErr) throw new Error('Sessie aanmaken mislukt: ' + sessieErr.message);

    // 4. Pagina's opslaan in Storage (optioneel — werkt ook zonder)
    const paginaUrls = [];
    for (let i = 0; i < paginaBuffers.length; i++) {
      const pad = `bulk/${sessie.id}/pagina-${String(i+1).padStart(3,'0')}.pdf`;
      const url = await slaOpInStorage(supabase, pad, paginaBuffers[i], 'application/pdf');
      paginaUrls.push(url);
    }

    // 5. Pagina-records aanmaken
    await supabase.from('nakijk_bulk_paginas').insert(
      paginaBuffers.map((_, i) => ({
        bulk_sessie_id: sessie.id,
        pagina_nr:      i + 1,
        pagina_url:     paginaUrls[i] || null,
      }))
    );

    // 6. Segmentatie — parallel in batches van 8
    console.log('[bulk/upload] segmentatie starten...');
    const BATCH = 8;
    const segResultaten = [];
    for (let i = 0; i < paginaBuffers.length; i += BATCH) {
      const batch = paginaBuffers.slice(i, i + BATCH);
      const batchRes = await Promise.all(
        batch.map((buf, j) => segmenteerPagina(i + j + 1, buf, anthropic))
      );
      // Sla op in DB
      for (const r of batchRes) {
        await supabase.from('nakijk_bulk_paginas').update({
          naam_gelezen:     r.naam || null,
          naam_zekerheid:   r.naam_zekerheid || 'geen',
          vraagnummers:     r.vraagnummers || [],
          is_eerste_pagina: r.is_eerste_pagina || false,
        }).eq('bulk_sessie_id', sessie.id).eq('pagina_nr', r.pagina_nr);
      }
      segResultaten.push(...batchRes);
    }
    console.log('[bulk/upload] segmentatie klaar');

    // 7. Leerlingen ophalen voor groepering
    let leerlingen = [];
    try {
      let q = supabase.from('leerlingen_import')
        .select('id, roepnaam, tussenvoegsel, achternaam, klas, stamnummer');
      if (klas_naam) q = q.eq('klas', klas_naam);
      if (lesperiode) q = q.eq('lesperiode', lesperiode);
      const { data } = await q;
      leerlingen = data || [];
    } catch(e) { console.warn('[bulk] leerlingen ophalen mislukt:', e.message); }

    // 8. Groepering
    console.log('[bulk/upload] groepering starten...');
    let groepering = { groepen: [], niet_herkend: [] };
    try {
      groepering = await groepeerPaginas(
        segResultaten.map(r => ({
          pagina_nr:        r.pagina_nr,
          naam_gevonden:    !!r.naam,
          naam:             r.naam,
          naam_zekerheid:   r.naam_zekerheid,
          vraagnummers:     r.vraagnummers,
          is_eerste_pagina: r.is_eerste_pagina,
        })),
        leerlingen,
        anthropic
      );
    } catch(e) { console.warn('[bulk] groepering mislukt:', e.message); }

    // 9. Koppelingen opslaan
    for (const groep of (groepering.groepen || [])) {
      const match = matchLeerling(groep.leerling_naam, leerlingen);
      const leerlingId = match?.leerling?.id || null;
      const zekerheid = match?.score >= 85 ? (groep.zekerheid || 'hoog')
                      : match?.score >= 60 ? 'middel' : 'laag';
      for (let idx = 0; idx < groep.paginas.length; idx++) {
        await supabase.from('nakijk_bulk_paginas').update({
          leerling_id:         leerlingId,
          volgorde_in_toets:   groep.volgorde?.[idx] ?? (idx + 1),
          koppeling_zekerheid: leerlingId ? zekerheid : 'laag',
        }).eq('bulk_sessie_id', sessie.id).eq('pagina_nr', groep.paginas[idx]);
      }
    }
    for (const nr of (groepering.niet_herkend || [])) {
      await supabase.from('nakijk_bulk_paginas').update({
        leerling_id: null, koppeling_zekerheid: 'onbekend',
      }).eq('bulk_sessie_id', sessie.id).eq('pagina_nr', nr);
    }

    // 10. Status bijwerken
    await supabase.from('nakijk_bulk_sessies')
      .update({ status: 'verificatie' }).eq('id', sessie.id);

    // 11. Volledige pagina-data ophalen voor response
    const { data: paginas } = await supabase
      .from('nakijk_bulk_paginas').select('*')
      .eq('bulk_sessie_id', sessie.id).order('pagina_nr');

    console.log('[bulk/upload] klaar');

    res.json({
      success:       true,
      sessie_id:     sessie.id,
      totaal_paginas: aantalPaginas,
      model_data:    modelData,
      leerlingen,
      paginas:       paginas || [],
      groepering,
    });

  } catch(err) {
    console.error('[bulk/upload] FOUT:', err);
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n')[0] });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 2 — PATCH /api/nakijk/bulk/pagina/:id
// Wijs een pagina handmatig toe aan leerling
// ════════════════════════════════════════════════════════════
router.patch('/pagina/:id', async (req, res) => {
  try {
    const { supabase } = clients(req);
    const { leerling_id, volgorde_in_toets } = req.body;
    const { error } = await supabase.from('nakijk_bulk_paginas').update({
      leerling_id,
      volgorde_in_toets: volgorde_in_toets || null,
      handmatig_toegewezen: true,
      koppeling_zekerheid: leerling_id ? 'hoog' : 'onbekend',
    }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 3 — POST /api/nakijk/bulk/nakijken
// Kijk alle leerlingen na
// ════════════════════════════════════════════════════════════
router.post('/nakijken', async (req, res) => {
  try {
    optionalAuth(req);
    const { supabase, anthropic } = clients(req);
    const { sessie_id } = req.body;
    if (!sessie_id) return res.status(400).json({ error: 'sessie_id verplicht' });

    const { data: bulkSessie } = await supabase
      .from('nakijk_bulk_sessies').select('*').eq('id', sessie_id).single();

    const { data: paginas } = await supabase
      .from('nakijk_bulk_paginas').select('*')
      .eq('bulk_sessie_id', sessie_id)
      .not('leerling_id', 'is', null)
      .order('leerling_id').order('volgorde_in_toets');

    // Groepeer per leerling
    const perLeerling = {};
    for (const p of (paginas || [])) {
      if (!perLeerling[p.leerling_id]) perLeerling[p.leerling_id] = [];
      perLeerling[p.leerling_id].push(p);
    }

    // Antwoordmodel tekst ophalen
    let antwoordmodelTekst = '';
    if (bulkSessie?.antwoordmodel_url) {
      try {
        const resp = await fetch(bulkSessie.antwoordmodel_url);
        const buf = Buffer.from(await resp.arrayBuffer());
        antwoordmodelTekst = (await pdfParse(buf)).text;
      } catch(e) { console.warn('[bulk/nakijken] antwoordmodel laden mislukt'); }
    }

    const NAKIJK_SYSTEM = `Je bent een ervaren economiedocent die toetsen nakijkt.
Beoordeel inhoudelijk — strekking telt. Gedeeltelijke punten zijn mogelijk.
Cijfer: (score/max)*9+1, afgerond op 1 decimaal. Reageer ALLEEN met geldige JSON.`;

    const resultaten = [];
    const BATCH = 5;
    const leerlingIds = Object.keys(perLeerling);

    for (let i = 0; i < leerlingIds.length; i += BATCH) {
      const batch = leerlingIds.slice(i, i + BATCH);
      const batchRes = await Promise.all(batch.map(async (leerlingId) => {
        const llPaginas = perLeerling[leerlingId]
          .sort((a,b) => (a.volgorde_in_toets||0) - (b.volgorde_in_toets||0));
        try {
          // Download pagina's
          const paginaContent = [];
          for (const p of llPaginas) {
            if (!p.pagina_url) continue;
            const pRes = await fetch(p.pagina_url);
            const pBuf = Buffer.from(await pRes.arrayBuffer());
            paginaContent.push({
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pBuf.toString('base64') },
            });
          }
          if (!paginaContent.length) throw new Error('Geen paginas beschikbaar');

          const claudeResp = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            system: NAKIJK_SYSTEM,
            messages: [{
              role: 'user',
              content: [
                ...paginaContent,
                { type: 'text', text: `Antwoordmodel:\n${antwoordmodelTekst}\n\nGeef JSON:\n{"leerling_naam":"...","vragen":[{"vraagnummer":1,"antwoord_leerling":"...","leeszekerheid":"zeker","score":2,"max_score":3,"behaalde_punten":[{"onderdeel":"...","behaald":true}],"feedback":"...","argumentatie":"..."}],"totaal_score":13,"max_score":20,"cijfer_suggestie":6.8,"algemene_opmerking":"..."}` },
              ],
            }],
          });

          const beoordeling = parseClaudeJSON(claudeResp.content[0].text);

          const { data: sessie } = await supabase.from('nakijk_sessies').insert({
            naam_op_toets:      beoordeling.leerling_naam || null,
            naam_zekerheid:     'hoog',
            toets_naam:         bulkSessie.toets_naam,
            vak:                bulkSessie.vak,
            niveau:             bulkSessie.niveau,
            aantal_vragen:      beoordeling.vragen?.length || 0,
            max_score:          beoordeling.max_score,
            totaal_score:       beoordeling.totaal_score,
            cijfer_suggestie:   beoordeling.cijfer_suggestie,
            algemene_opmerking: beoordeling.algemene_opmerking,
            status:             'nagekeken',
            leerling_id:        leerlingId,
            leraar_id:          req.leraar?.id || null,
            bulk_sessie_id:     sessie_id,
            toets_url:          llPaginas[0]?.pagina_url || null,
          }).select().single();

          if (sessie) {
            await supabase.from('nakijk_antwoorden').insert(
              (beoordeling.vragen || []).map(v => ({
                sessie_id:       sessie.id,
                vraagnummer:     v.vraagnummer,
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
          }
          return { leerling_id: leerlingId, sessie_id: sessie?.id, ok: true };
        } catch(e) {
          console.error(`[bulk/nakijken] leerling ${leerlingId}:`, e.message);
          return { leerling_id: leerlingId, ok: false, fout: e.message };
        }
      }));
      resultaten.push(...batchRes);
    }

    await supabase.from('nakijk_bulk_sessies')
      .update({ status: 'afgerond' }).eq('id', sessie_id);

    res.json({
      success: true,
      gelukt:  resultaten.filter(r => r.ok).length,
      totaal:  leerlingIds.length,
      resultaten,
    });
  } catch(err) {
    console.error('[bulk/nakijken]', err);
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 4 — GET /api/nakijk/bulk/sessie/:id
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

    const { data: nakijkSessies } = await supabase
      .from('nakijk_sessies')
      .select('id, leerling_id, naam_op_toets, totaal_score, max_score, cijfer_suggestie, status')
      .eq('bulk_sessie_id', req.params.id);

    const leerlingIds = [...new Set((paginas || []).filter(p => p.leerling_id).map(p => p.leerling_id))];
    let leerlingen = [];
    if (leerlingIds.length) {
      const { data } = await supabase.from('leerlingen_import')
        .select('id, roepnaam, tussenvoegsel, achternaam, klas, stamnummer')
        .in('id', leerlingIds);
      leerlingen = data || [];
    }

    res.json({ success: true, sessie, paginas: paginas || [], nakijk_sessies: nakijkSessies || [], leerlingen });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 5 — GET /api/nakijk/bulk/overzicht
// ════════════════════════════════════════════════════════════
router.get('/overzicht', async (req, res) => {
  try {
    optionalAuth(req);
    const { supabase } = clients(req);
    let q = supabase.from('nakijk_bulk_sessies')
      .select('id, klas_naam, toets_naam, niveau, totaal_paginas, status, created_at')
      .order('created_at', { ascending: false }).limit(20);
    if (req.leraar?.id) q = q.eq('leraar_id', req.leraar.id);
    const { data: sessies, error } = await q;
    if (error) throw error;
    res.json({ success: true, sessies: sessies || [] });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});


// ════════════════════════════════════════════════════════════
// ROUTE 6 — GET /api/nakijk/bulk/resultaten/:id
// ════════════════════════════════════════════════════════════
router.get('/resultaten/:id', async (req, res) => {
  try {
    const { supabase } = clients(req);
    const { data: nakijkSessies, error } = await supabase
      .from('nakijk_sessies')
      .select('*, antwoorden:nakijk_antwoorden(*)')
      .eq('bulk_sessie_id', req.params.id);
    if (error) throw error;

    const resultaten = await Promise.all((nakijkSessies || []).map(async s => {
      if (s.leerling_id) {
        const { data: ll } = await supabase.from('leerlingen_import')
          .select('id, roepnaam, tussenvoegsel, achternaam, klas, stamnummer')
          .eq('id', s.leerling_id).single();
        s.leerling = ll;
      }
      return s;
    }));

    const cijfers = resultaten
      .map(r => r.cijfer_definitief ?? r.cijfer_suggestie)
      .filter(c => c !== null && c !== undefined);
    const gemiddeld = cijfers.length
      ? Math.round(cijfers.reduce((a,b) => a+b, 0) / cijfers.length * 10) / 10 : null;

    res.json({
      success: true,
      resultaten,
      statistieken: {
        gemiddeld_cijfer: gemiddeld,
        geslaagd: cijfers.filter(c => c >= 5.5).length,
        totaal: resultaten.length,
        cijfers,
      },
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
