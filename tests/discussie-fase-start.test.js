/**
 * TICKET-014 — Discussiefase start per groep.
 *
 * Regressietest: POST /api/mol/antwoord mag mol_sessies.ronde_fase
 * niet meer op 'stem' zetten. Die sessie-brede shortcut zorgde dat
 * bepaalGroepStatus voor álle groepen 'stem' teruggaf, terwijl de
 * frontend (speler.js) geen handler voor 'stem' heeft. Met de shortcut
 * weg gebruikt bepaalGroepStatus de per-groep-tak en retourneert
 * 'discussie' zodra een groep compleet is.
 */

const fs = require('fs');
const path = require('path');

describe('TICKET-014 — POST /api/mol/antwoord update mol_sessies niet meer', () => {
  let src;
  let handler;

  beforeAll(() => {
    src = fs.readFileSync(
      path.join(__dirname, '..', 'server.js'), 'utf8'
    );
    const match = src.match(
      /app\.post\(['"]\/api\/mol\/antwoord['"][\s\S]*?^\}\);/m
    );
    handler = match ? match[0] : null;
  });

  it('handler-blok is vindbaar in server.js', () => {
    expect(handler).not.toBeNull();
  });

  it('bevat geen ronde_fase: \'stem\' meer in /api/mol/antwoord-handler', () => {
    expect(handler).not.toMatch(/ronde_fase\s*:\s*['"]stem['"]/);
  });

  it('roept geen mol_sessies.update aan in /api/mol/antwoord', () => {
    expect(handler).not.toMatch(/from\(['"]mol_sessies['"]\)\s*\.update/);
  });
});
