import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'public/index.html','public/day.html','public/admin/index.html','public/assets/css/main.css','public/assets/css/admin.css',
  'public/assets/js/app.js','public/assets/js/day.js','public/assets/js/admin.js','functions/api/site.js','functions/api/day.js',
  'functions/api/admin/login.js','functions/api/admin/health.js','functions/api/admin/upload.js','functions/api/admin/contacts.js',
  'functions/api/admin/media.js','functions/api/admin/settings.js','functions/api/admin/subscribers.js','functions/api/admin/slides.js',
  'migrations/0000_initial.sql','migrations/0002_communications_and_slides.sql','migrations/0003_management_upgrade.sql'
];
let failed = false;
const fail = message => { console.error(message); failed = true; };
for (const file of required) if (!existsSync(join(root,file))) fail(`Missing: ${file}`);
if (existsSync(join(root,'wrangler.jsonc')) || existsSync(join(root,'wrangler.toml'))) fail('Active Wrangler config found. Dashboard-first package must not include one.');

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir,name); return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
for (const file of walk(root).filter(file => file.endsWith('.js') || file.endsWith('.mjs'))) {
  const result = spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if (result.status !== 0) fail(`Syntax error: ${file}\n${result.stderr}`);
}
for (const file of ['package.json','public/manifest.webmanifest','public/_routes.json']) {
  try { JSON.parse(readFileSync(join(root,file),'utf8')); } catch (error) { fail(`Invalid JSON: ${file}: ${error.message}`); }
}
for (const file of walk(join(root,'functions')).filter(file => file.endsWith('.js'))) {
  const source = readFileSync(file,'utf8');
  for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    const target = resolve(dirname(file),match[1]);
    if (!existsSync(target)) fail(`Broken import in ${file}: ${match[1]}`);
  }
}

const adminJs = readFileSync(join(root,'public/assets/js/admin.js'),'utf8');
const adminHtml = readFileSync(join(root,'public/admin/index.html'),'utf8');
const dayJs = readFileSync(join(root,'public/assets/js/day.js'),'utf8');
const dayApi = readFileSync(join(root,'functions/api/day.js'),'utf8');
const mediaApi = readFileSync(join(root,'functions/api/admin/media.js'),'utf8');
for (const fn of ['bulkDeleteMedia','bulkMediaDay','bulkMediaCategory','bulkMediaStatus']) {
  if (!adminJs.includes(`function ${fn}`) && !adminJs.includes(`async function ${fn}`)) fail(`Missing admin runtime function: ${fn}`);
}
if (!adminHtml.includes('id="set-day-video"') || !adminJs.includes("action:'set_day_video'") || !mediaApi.includes("body.action === 'set_day_video'")) fail('Day summary-video control is incomplete.');
if (adminHtml.includes('summary-video-section')) fail('Obsolete homepage-summary section still exists in admin media view.');
if (!dayApi.includes("filters.push('id<>?')") || !dayApi.includes('summary_video_id')) fail('Day API does not exclude the summary video from the gallery.');
if (dayJs.includes('ensureSummaryVideo') || dayJs.includes('isSummaryVideo')) fail('Old client-side summary-video heuristics remain in day.js.');

const version = '16.0.0';
for (const file of ['public/index.html','public/day.html','public/admin/index.html','public/sw.js']) {
  const source = readFileSync(join(root,file),'utf8');
  if (!source.includes(version)) fail(`Asset version ${version} missing from ${file}`);
}
if (failed) process.exit(1);
console.log('V16 syntax, runtime controls, saving, links and gallery checks passed.');
