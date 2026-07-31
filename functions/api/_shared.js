export const DEFAULT_SETTINGS = Object.freeze({
  site_title: 'קעמפ גן ישראל חדרה',
  camp_name: 'קעמפ גן ישראל חדרה',
  city: 'חדרה',
  season_label: 'קיץ תשפ״ו',
  phone: '', whatsapp: '', email: '', address: '', map_url: '',
  instagram_url: '', youtube_url: '', facebook_url: '',
  hero_kicker: 'קיץ של אנרגיה • חברות • שליחות',
  hero_title: 'הקיץ מתחיל כאן',
  hero_text: 'כל התמונות, הסרטונים, ההמנונים והרגעים הגדולים של קעמפ גן ישראל חדרה — במקום אחד.',
  hero_image_key: '', hero_video_url: '',
  hero_primary_button_text: 'לגלריות הקעמפ', hero_primary_button_url: '#galleries',
  hero_secondary_button_text: 'צפו בסרטון', hero_secondary_button_url: '#latest',
  registration_button_text: 'הרשמה לקעמפ', registration_button_url: '', countdown_target: '',
  story_kicker: 'הסיפור שלנו', story_title: 'קיץ של רגעים שלא שוכחים',
  story_text: 'קעמפ הוא הרבה יותר מפעילות. זו חוויה של חברות, שמחה, ערכים ושליחות שנשארת עם הילדים הרבה אחרי שהקיץ נגמר.',
  story_image_key: '', logo_key: '', footer_logo_1_key: '', footer_logo_2_key: '', footer_logo_3_key: '',
  footer_text: 'כל החוויות. במקום אחד.',
  gallery_title: 'הגלריות של הקעמפ',
  gallery_text: 'כל יום מקבל מקום משלו — סרטון סיכום, תמונות ורגעים ששווה לחזור אליהם.',
  songs_title: 'המנוני הקעמפ', songs_text: 'כל השירים וההמנונים שמכניסים מיד לאווירה.',
  testimonials_title: 'מה ההורים מספרים', testimonials_text: 'תגובות אמיתיות מהמשפחות שחוו את הקעמפ איתנו.',
  updates_title: 'נשארים מחוברים לקעמפ', updates_text: 'גלריות חדשות, סרטונים ועדכונים חשובים ישירות אליכם.',
  contact_title: 'יצירת קשר', contact_text: 'לשאלות, הרשמה ופרטים נוספים — נשמח לדבר.',
  theme_primary: '#ff6b16', theme_secondary: '#173b67', theme_accent: '#ffd234',
  theme_green: '#31b86b', theme_purple: '#7b4ce2', theme_bg: '#fff9ef', theme_surface: '#ffffff',
  seo_title: 'קעמפ גן ישראל חדרה', seo_description: 'גלריות, סרטונים, המנונים ועדכונים מקעמפ גן ישראל חדרה',
  seo_keywords: 'קעמפ גן ישראל חדרה, גלריות קעמפ, קעמפ חב״ד', gallery_sort: 'oldest',
  show_testimonials: '1', show_songs: '1', show_countdown: '0', allow_testimonial_submission: '1',
  allow_newsletter_signup: '1', allow_contact_form: '1'
});

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    }
  });
}

export function clean(value, max = 1000) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

export function integer(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function booleanInt(value) {
  return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

export function statusValue(value, allowed, fallback) {
  const normalized = clean(value, 40);
  return allowed.includes(normalized) ? normalized : fallback;
}

export function slugify(value, fallback = '') {
  const input = clean(value, 180).toLowerCase();
  const slug = input
    .normalize('NFKC')
    .replace(/[׳״'"`]/g, '')
    .replace(/[^a-z0-9\u0590-\u05ff_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  return slug || fallback;
}

export function safeKeyPart(value) {
  return clean(value || 'file', 220)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180) || 'file';
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value, 200));
}

export function digits(value) {
  return clean(value, 80).replace(/\D/g, '');
}

export function isHttpUrl(value, allowRelative = true) {
  const text = clean(value, 1200);
  if (!text) return true;
  if (allowRelative && (text.startsWith('/') || text.startsWith('#'))) return true;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function mediaUrl(key, download = false) {
  const value = clean(key, 900);
  return value ? `/api/media/${value.split('/').map(encodeURIComponent).join('/')}${download ? '?download=1' : ''}` : '';
}

export async function parseJson(request) {
  return request.json().catch(() => ({}));
}

export async function loadSettings(env) {
  if (!env.DB) return { ...DEFAULT_SETTINGS };
  const result = await env.DB.prepare('SELECT key,value FROM settings').all();
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries((result.results || []).map(row => [row.key, row.value])) };
}

export function setupState(error, env) {
  const message = clean(error?.message || error || '', 600);
  return {
    required: true,
    db_binding: Boolean(env?.DB),
    r2_binding: Boolean(env?.MEDIA),
    database_ready: false,
    message: message || 'המערכת עדיין לא חוברה למסד הנתונים.'
  };
}

export function isSchemaError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('no such table') || message.includes('d1_error') || message.includes('binding') || message.includes('undefined');
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function enforceRateLimit({ env, request, action, limit = 5, windowSeconds = 3600 }) {
  if (!env.DB) return { allowed: true, remaining: limit };
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = await sha256(`${action}:${ip}`);
  const now = Math.floor(Date.now() / 1000);
  try {
    const row = await env.DB.prepare('SELECT window_start,hits FROM rate_limits WHERE rate_key=?').bind(key).first();
    if (!row || now - Number(row.window_start) >= windowSeconds) {
      await env.DB.prepare(`INSERT INTO rate_limits(rate_key,window_start,hits,updated_at) VALUES(?,?,1,CURRENT_TIMESTAMP)
        ON CONFLICT(rate_key) DO UPDATE SET window_start=excluded.window_start,hits=1,updated_at=CURRENT_TIMESTAMP`)
        .bind(key, now).run();
      return { allowed: true, remaining: Math.max(0, limit - 1) };
    }
    if (Number(row.hits) >= limit) return { allowed: false, remaining: 0 };
    await env.DB.prepare('UPDATE rate_limits SET hits=hits+1,updated_at=CURRENT_TIMESTAMP WHERE rate_key=?').bind(key).run();
    return { allowed: true, remaining: Math.max(0, limit - Number(row.hits) - 1) };
  } catch {
    return { allowed: true, remaining: limit };
  }
}

export async function audit(env, action, entityType = '', entityId = '', details = '') {
  if (!env.DB) return;
  try {
    await env.DB.prepare('INSERT INTO admin_audit(action,entity_type,entity_id,details) VALUES(?,?,?,?)')
      .bind(clean(action, 120), clean(entityType, 80), clean(entityId, 120), clean(details, 2000)).run();
  } catch {
    // Audit logging must never break the requested action.
  }
}

export function csvResponse(rows, filename) {
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const text = '\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n');
  return new Response(text, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store'
    }
  });
}

export function methodNotAllowed(allow = 'GET') {
  return json({ error: 'method_not_allowed' }, 405, { Allow: allow });
}
