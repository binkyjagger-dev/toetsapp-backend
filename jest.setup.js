// Jest setup: overschrijf JWT_SECRET met de testwaarde vóór elke testsuite.
// Dit zorgt dat server.js dezelfde sleutel gebruikt als de testbestanden.
process.env.JWT_SECRET = 'stanislascollege_mol_secret_2025';
