const sharp = require('sharp');
const path = require('path');

const svg = `<svg xmlns="http://www.w3.org/2000/svg"
  width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#1B3A6B"/>
  <text x="16" y="24" text-anchor="middle"
    font-family="Georgia, serif" font-size="22"
    font-weight="700" fill="#C8A951">S</text>
  <rect x="6" y="27" width="20" height="2"
    rx="1" fill="#C8A951"/>
</svg>`;

const outPath = path.join(__dirname, '..', 'netlify-deploy', 'favicon.ico');

sharp(Buffer.from(svg))
  .resize(32, 32)
  .toFile(outPath, (err) => {
    if (err) console.error(err);
    else console.log('favicon.ico aangemaakt in netlify-deploy/');
  });
