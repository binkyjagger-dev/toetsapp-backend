const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const htmlPath = path.join(__dirname, '..', 'netlify-deploy', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Extract inline <script> blocks (skips <script src="...">)
const regex = /<script>([\s\S]*?)<\/script>/gi;
let match;
let js = '';
let blockCount = 0;

while ((match = regex.exec(html)) !== null) {
  blockCount++;
  // Add newline padding so line numbers in errors are traceable
  js += `// ── script block ${blockCount} ──\n${match[1]}\n`;
}

if (!blockCount) {
  console.log('lint:html — geen inline <script> blokken gevonden');
  process.exit(0);
}

const tmp = path.join(os.tmpdir(), 'lint-html-check.js');
fs.writeFileSync(tmp, js);

try {
  execSync(`node --check "${tmp}"`, { stdio: 'inherit' });
  console.log(`lint:html — ${blockCount} script-blokken OK`);
} catch {
  console.error(`lint:html — syntaxfout gevonden in index.html`);
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmp); } catch {}
}
