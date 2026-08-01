import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'public/index.html','public/day.html','public/admin/index.html','public/assets/css/main.css','public/assets/css/admin.css',
  'public/assets/js/app.js','public/assets/js/day.js','public/assets/js/admin.js','functions/api/site.js','functions/api/day.js',
  'functions/api/admin/login.js','functions/api/admin/health.js','functions/api/admin/upload.js','migrations/0000_initial.sql'
];
let failed = false;
for (const file of required) {
  if (!existsSync(join(root,file))) { console.error(`Missing: ${file}`); failed = true; }
}
if (existsSync(join(root,'wrangler.jsonc')) || existsSync(join(root,'wrangler.toml'))) {
  console.error('Active Wrangler config found. Dashboard-first package must not include one.'); failed = true;
}
function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir,name); return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
for (const file of walk(root).filter(file => file.endsWith('.js') || file.endsWith('.mjs'))) {
  const result = spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if (result.status !== 0) { console.error(`Syntax error: ${file}\n${result.stderr}`); failed = true; }
}
for (const file of ['package.json','public/manifest.webmanifest','public/_routes.json']) {
  try { JSON.parse(readFileSync(join(root,file),'utf8')); } catch (error) { console.error(`Invalid JSON: ${file}: ${error.message}`); failed = true; }
}
for (const file of walk(join(root,'functions')).filter(file => file.endsWith('.js'))) {
  const source = readFileSync(file,'utf8');
  for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    const target = resolve(dirname(file),match[1]);
    if (!existsSync(target)) { console.error(`Broken import in ${file}: ${match[1]}`); failed = true; }
  }
}
if (failed) process.exit(1);
const v11Files = {
  'public/index.html': ['id="memories"','id="mobile-dock"'],
  'public/admin/index.html': ['id="readiness-score"','id="media-picker-modal"'],
  'functions/api/site.js': ['featured_media'],
  'functions/api/admin/dashboard.js': ['readiness','media_bytes']
};
for (const [file, needles] of Object.entries(v11Files)) {
  const source = readFileSync(join(root,file),'utf8');
  for (const needle of needles) if (!source.includes(needle)) { console.error(`V11 feature missing in ${file}: ${needle}`); failed = true; }
}
if (failed) process.exit(1);
console.log('V11 Publish Ready checks passed.');
