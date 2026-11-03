const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

function copyFile(rel) {
  const src = path.join(root, rel);
  const dst = path.join(out, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function copyDir(rel) {
  fs.cpSync(path.join(root, rel), path.join(out, rel), { recursive: true });
}

[
  'index.html',
  'app.js',
  'style.css',
  'strings.js',
  'sw.js',
  'manifest.webmanifest'
].forEach(copyFile);

copyDir('assets');
copyDir('vendor/cropperjs');

[
  'vendor/docx.umd.js',
  'vendor/jspdf.umd.min.js',
  'vendor/pdffont_base64.js',
  'vendor/Rubik.ttf',
  'vendor/paddleocr/textrec-ocr-worker.js'
].forEach(copyFile);

console.log('Pages build ready: dist/');
