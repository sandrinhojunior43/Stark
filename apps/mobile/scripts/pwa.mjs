// Depois do `expo export`, completa cada página HTML com os metadados de app instalável (PWA)
// e o registro do service worker. Roda no build da Vercel.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const head = [
  '<meta name="description" content="Seu espaço pessoal para anotações, projetos e ideias.">',
  '<meta name="theme-color" content="#04081A">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="STARK">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<style>html,body{background:#04081A}</style>',
  '<link rel="manifest" href="/manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  "<script>if('serviceWorker' in navigator){addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}</script>",
].join('');

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

let count = 0;
for await (const file of htmlFiles(dist)) {
  let html = await readFile(file, 'utf8');
  if (html.includes('rel="manifest"')) continue;
  if (!html.includes('</head>')) throw new Error(`Sem </head>: ${file}`);
  html = html
    .replace(/<html lang="[^"]*"/, '<html lang="pt-BR"')
    .replace(/<meta name="viewport" content="[^"]*"\/?>/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
    .replace('</head>', `${head}</head>`);
  await writeFile(file, html);
  count++;
}
if (count === 0) throw new Error('Nenhuma página HTML encontrada em dist/. O expo export rodou?');
console.log(`PWA: ${count} páginas atualizadas.`);
