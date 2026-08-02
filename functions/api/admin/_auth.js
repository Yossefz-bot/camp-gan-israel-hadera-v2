import { clean, json } from '../_shared.js';

const COOKIE_NAME = 'camp_admin_session';

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

function parseCookies(request) {
  const result = {};
  const header = request.headers.get('cookie') || '';
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index < 0) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function constantTimeEqual(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (left[index % Math.max(1, left.length)] || 0) ^ (right[index % Math.max(1, right.length)] || 0);
  }
  return diff === 0;
}

export function secretsReady(env) {
  return clean(env.ADMIN_PASSWORD, 500).length >= 8 && clean(env.SESSION_SECRET, 1000).length >= 32;
}

async function pbkdf2Hex(password,salt){
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:120000},material,256);
  return [...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function passwordMatches(password, env) {
  if (!secretsReady(env)) return false;
  if(env.DB){
    try{
      const rows=await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('admin_password_hash','admin_password_salt')").all();
      const values=Object.fromEntries((rows.results||[]).map(r=>[r.key,r.value]));
      if(values.admin_password_hash&&values.admin_password_salt){
        const candidate=await pbkdf2Hex(clean(password,500),values.admin_password_salt);
        return constantTimeEqual(candidate,values.admin_password_hash);
      }
    }catch{}
  }
  return constantTimeEqual(clean(password, 500), clean(env.ADMIN_PASSWORD, 500));
}
export async function makePasswordHash(password,salt){return pbkdf2Hex(clean(password,500),salt)}


export async function createSession(env) {
  if (!secretsReady(env)) throw new Error('admin_secrets_missing');
  const hours = Math.min(72, Math.max(1, Number(env.SESSION_TTL_HOURS) || 12));
  const payload = {
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + hours * 3600,
    csrf: crypto.randomUUID(),
    nonce: crypto.randomUUID()
  };
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = base64UrlEncode(await hmac(env.SESSION_SECRET, encoded));
  return { token: `${encoded}.${signature}`, payload, maxAge: hours * 3600 };
}

export async function verifySession(request, env) {
  if (!secretsReady(env)) return null;
  const token = parseCookies(request)[COOKIE_NAME] || '';
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  try {
    const expected = await hmac(env.SESSION_SECRET, encoded);
    const received = base64UrlDecode(signature);
    if (expected.length !== received.length) return null;
    let diff = 0;
    for (let index = 0; index < expected.length; index += 1) diff |= expected[index] ^ received[index];
    if (diff !== 0) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded)));
    if (payload.role !== 'admin' || Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function requireAdmin(request, env, { csrf = false } = {}) {
  const session = await verifySession(request, env);
  if (!session) return { response: json({ error: 'unauthorized' }, 401), session: null };
  if (csrf && request.headers.get('x-csrf-token') !== session.csrf) {
    return { response: json({ error: 'csrf_failed' }, 403), session: null };
  }
  return { response: null, session };
}

export function sessionCookie(request, token, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
