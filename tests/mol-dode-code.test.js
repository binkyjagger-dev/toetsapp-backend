const fs = require('fs');
const path = require('path');

const docentSetupPath = path.join(__dirname, '..', 'netlify-deploy', 'mol-js', 'docent-setup.js');

describe('mol — dode code verwijderd', () => {
  const c = fs.readFileSync(docentSetupPath, 'utf8');

  const dodeFuncties = [
    'naarVragenEditor', 'genereerVragenPreview',
    'herGenereerAlleVragen', 'herGenereerVraag',
    'renderVragenEditor', 'renderVraagKaart',
    'renderMcOpties', 'autoResizeMcInput',
    'autoResizeAllMcInputs', 'updateVraag',
    'setVraagtype', 'toggleMcCorrect', 'toggleMcMol',
    'updateMcOptie', 'voegMcOptieToe', 'verwijderMcOptie',
  ];

  dodeFuncties.forEach(naam => {
    it(`${naam} is verwijderd`, () => {
      expect(c).not.toContain('function ' + naam);
    });
  });
});
