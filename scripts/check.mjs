import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else out.push(path);
  }
  return out;
}

const files = await walk(new URL('..', import.meta.url).pathname);
const required = ['public/index.html', 'public/admin/index.html', 'public/assets/css/main.css', 'public/assets/js/app.js', 'functions/api/site.js', 'migrations/0000_fresh_install.sql'];
for (const rel of required) {
  if (!files.some(file => file.endsWith(rel))) throw new Error(`Missing required file: ${rel}`);
}
const htmlFiles = files.filter(file => file.endsWith('.html') && !file.includes('googlecaff839023abe494.html'));
for (const file of htmlFiles) {
  const text = await readFile(file, 'utf8');
  if (!text.includes('<!doctype html>')) throw new Error(`Invalid HTML document: ${file}`);
}
console.log(`Project check passed: ${files.length} files, ${htmlFiles.length} HTML pages.`);
