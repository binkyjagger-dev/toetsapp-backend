// ============================================================
// NAKIJK-ASSISTENT · Leerling matching
// Vergelijkt een uitgelezen naam met de leerlingenlijst
// via een eenvoudige maar effectieve fuzzy match.
// ============================================================

/**
 * Bereken de Levenshtein-afstand tussen twee strings.
 * Hoe lager, hoe meer de strings op elkaar lijken.
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

/**
 * Zet een naam om naar een genormaliseerde string voor vergelijking.
 * - Lowercase
 * - Verwijder tussenvoegsel (van, de, den, der, van den, enz.)
 *   voor de secundaire vergelijking
 */
function normalizeer(naam) {
  return naam.toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')                          // decompose accenten
    .replace(/[\u0300-\u036f]/g, '');          // strip accenten
}

const TUSSENVOEGSELS = ['van den', 'van der', 'van de', 'van', 'de', 'den', 'der', 'het', 'ten', 'ter'];

function stripTussenvoegsel(naam) {
  let n = naam.toLowerCase();
  for (const tv of TUSSENVOEGSELS) {
    n = n.replace(new RegExp(`\\b${tv}\\b`, 'g'), '').replace(/\s+/g, ' ').trim();
  }
  return n;
}

/**
 * Bereken een matchscore (0–100) tussen een uitgelezen naam
 * en een leerling uit de database.
 *
 * Strategie:
 * 1. Exacte match na normalisatie → 100
 * 2. Levenshtein op volledige naam → schaal naar 0–95
 * 3. Levenshtein zonder tussenvoegsel → bonus als dat beter matcht
 *    (bijv. "van der Berg" vs "van den Berg" → tussenvoegsel-verschil)
 */
function berekenMatchScore(uitgelezen, leerling) {
  const volledigeNaam = `${leerling.voornaam} ${leerling.achternaam}`;

  const a = normalizeer(uitgelezen);
  const b = normalizeer(volledigeNaam);

  // Exacte match
  if (a === b) return 100;

  // Levenshtein op volledige naam
  const maxLen = Math.max(a.length, b.length);
  const dist = levenshtein(a, b);
  const score = Math.round((1 - dist / maxLen) * 95);

  // Bonus: zonder tussenvoegsel vergelijken
  const aStripped = stripTussenvoegsel(a);
  const bStripped = stripTussenvoegsel(b);
  const distStripped = levenshtein(aStripped, bStripped);
  const maxStripped = Math.max(aStripped.length, bStripped.length);
  const scoreStripped = Math.round((1 - distStripped / maxStripped) * 92);

  return Math.max(score, scoreStripped);
}

/**
 * Geef een gesorteerde lijst van leerlingen met matchscores.
 *
 * @param {string}   uitgelezenNaam  - Naam zoals Claude die heeft uitgelezen
 * @param {Array}    leerlingen      - Array van leerlingobjecten uit Supabase
 * @param {number}   topN            - Aantal kandidaten om terug te geven (default 5)
 * @param {number}   minScore        - Minimale score om op te nemen (default 30)
 * @returns {Array}  Gesorteerde kandidaten met score en label
 */
function matchLeerling(uitgelezenNaam, leerlingen, topN = 5, minScore = 30) {
  if (!uitgelezenNaam || !leerlingen.length) return [];

  const kandidaten = leerlingen
    .map(l => ({
      leerling: l,
      score: berekenMatchScore(uitgelezenNaam, l),
    }))
    .filter(k => k.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((k, i) => ({
      ...k.leerling,
      match_score: k.score,
      match_label: k.score >= 95 ? 'exact'
                 : k.score >= 75 ? 'hoog'
                 : k.score >= 50 ? 'middel'
                 : 'laag',
      is_best_match: i === 0,
    }));

  return kandidaten;
}

module.exports = { matchLeerling, berekenMatchScore };
