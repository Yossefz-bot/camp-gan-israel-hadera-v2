export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type':'application/json; charset=utf-8', ...headers } });
}
export async function body(request) {
  return request.json().catch(() => ({}));
}
export function clean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}
export function integer(value, fallback = 0) {
  const n = Number(value); return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
export function booleanInt(value) { return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0; }
export function slugify(value) {
  return clean(value, 180).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
}
export function safeKeyPart(value) {
  return String(value || 'file').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,180);
}
export function validStatus(value, allowed, fallback) { return allowed.includes(value) ? value : fallback; }
