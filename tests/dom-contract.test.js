'use strict';
const fs   = require('fs');
const path = require('path');

// IDs die de JS zelf aanmaakt in innerHTML — niet verwacht in statische HTML.
// Voeg hier een ID toe als je een nieuwe dynamisch gemaakte ID introduceert,
// met een comment waarom het dynamisch is.
const DYNAMISCH_AANGEMAAKT = new Set([
  'antwoord-error',      // renderSpelerRonde: invoer-fase HTML
  'argument-input',      // renderSpelerRonde: invoer-fase HTML
  'argument-sectie',     // renderSpelerRonde: invoer-fase HTML
  'briefing-start-btn',  // renderSpelerBriefing: dynamische knoprij
  'briefing-wacht',      // renderSpelerBriefing: wacht-sectie
  'briefing-wacht-grid', // renderSpelerBriefing: wacht-grid
  'discussie-vraag',     // renderDiscussiescherm: vraag-card
  'gh-keuze-lijst',      // renderSpelerBriefing: groepshoofd-keuze
  'gh-status',           // renderSpelerBriefing: status-label
  'gh-winnaar-badge',    // renderGroepshoofBekendmaking: badge na keuze
  'groepshoofd-sectie',  // renderSpelerBriefing: groepshoofd-blok
  'stem-error',          // renderSpelerRonde: stem-fase HTML
  'submit-antwoord-btn', // renderSpelerRonde: invoer-fase HTML
  'submit-stem-btn',     // dode code — vervangen door groepshoofIndienen()
  'gh-wacht',            // dode code — badge-positionering vervangen
]);

test('alle statische getElementById-aanroepen in speler.js hebben een element in mol-lesvorm.html', () => {
  const spelerSrc = fs.readFileSync(
    path.join(__dirname, '../netlify-deploy/mol-js/speler.js'), 'utf-8');
  const htmlSrc = fs.readFileSync(
    path.join(__dirname, '../netlify-deploy/mol-lesvorm.html'), 'utf-8');

  const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
  const ontbrekend = [];
  let m;
  while ((m = regex.exec(spelerSrc)) !== null) {
    const id = m[1];
    if (DYNAMISCH_AANGEMAAKT.has(id)) continue;
    if (!htmlSrc.includes(`id="${id}"`)) {
      ontbrekend.push(id);
    }
  }

  if (ontbrekend.length > 0) {
    throw new Error(
      `DOM-contract geschonden. De volgende IDs staan in speler.js maar ` +
      `niet in mol-lesvorm.html:\n  ${ontbrekend.join('\n  ')}\n\n` +
      `Fix: voeg het element toe aan mol-lesvorm.html, OF voeg de ID toe ` +
      `aan DYNAMISCH_AANGEMAAKT als de JS het zelf aanmaakt.`
    );
  }
  expect(ontbrekend).toEqual([]);
});
