import { clean, isEmail } from './_shared.js';

const RESEND_API = 'https://api.resend.com';

export function emailReady(env) {
  return Boolean(clean(env?.RESEND_API_KEY, 500) && clean(env?.EMAIL_FROM, 320));
}

export function emailConfigDetail(env) {
  const missing = [];
  if (!clean(env?.RESEND_API_KEY, 500)) missing.push('RESEND_API_KEY');
  if (!clean(env?.EMAIL_FROM, 320)) missing.push('EMAIL_FROM');
  return missing.length ? `חסרים: ${missing.join(', ')}` : 'שירות המייל מחובר';
}

export function escapeEmailHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

export function textToEmailHtml(value) {
  return escapeEmailHtml(clean(value, 20000)).replace(/\r?\n/g, '<br>');
}

export function emailShell({ title, preheader = '', bodyHtml = '', footerHtml = '' }) {
  const safeTitle = escapeEmailHtml(clean(title, 300));
  const safePreheader = escapeEmailHtml(clean(preheader, 300));
  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#fff8ee;font-family:Arial,'Helvetica Neue',sans-serif;color:#173b67;direction:rtl;text-align:right">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${safePreheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff8ee;padding:24px 10px"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #f0e1cf;box-shadow:0 12px 35px rgba(23,59,103,.08)">
      <tr><td style="background:linear-gradient(135deg,#ff6b16,#ff8a2d);padding:28px 34px;color:#fff"><div style="font-size:12px;font-weight:700;letter-spacing:.4px;opacity:.85">קעמפ גן ישראל חדרה</div><h1 style="margin:8px 0 0;font-size:28px;line-height:1.25">${safeTitle}</h1></td></tr>
      <tr><td style="padding:32px 34px;font-size:16px;line-height:1.75;color:#314b6b">${bodyHtml}</td></tr>
      <tr><td style="padding:20px 34px;background:#f7f9fc;border-top:1px solid #edf0f5;color:#718096;font-size:12px;line-height:1.6">${footerHtml || 'הודעה זו נשלחה ממערכת קעמפ גן ישראל חדרה.'}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function normalizedRecipients(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.map(item => clean(item, 200).toLowerCase()).filter(isEmail);
}

async function resendRequest(env, path, payload, idempotencyKey = '') {
  if (!emailReady(env)) throw new Error('email_not_configured');
  const headers = {
    authorization: `Bearer ${clean(env.RESEND_API_KEY, 500)}`,
    'content-type': 'application/json'
  };
  if (idempotencyKey) headers['Idempotency-Key'] = clean(idempotencyKey, 240);
  const response = await fetch(`${RESEND_API}${path}`, { method: 'POST', headers, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = clean(data?.message || data?.error?.message || data?.name || `Resend ${response.status}`, 700);
    throw new Error(message || 'email_send_failed');
  }
  return data;
}

export async function sendEmail(env, input, idempotencyKey = '') {
  const to = normalizedRecipients(input.to);
  if (!to.length) throw new Error('invalid_recipient');
  const payload = {
    from: clean(env.EMAIL_FROM, 320),
    to,
    subject: clean(input.subject, 500),
    html: String(input.html || ''),
    text: clean(input.text, 20000)
  };
  const replyTo = clean(input.replyTo || env.EMAIL_REPLY_TO, 320);
  if (replyTo && isEmail(replyTo.replace(/^.*<([^>]+)>.*$/, '$1'))) payload.reply_to = replyTo;
  if (input.headers && typeof input.headers === 'object') payload.headers = input.headers;
  if (Array.isArray(input.tags) && input.tags.length) payload.tags = input.tags;
  return resendRequest(env, '/emails', payload, idempotencyKey);
}

export async function sendEmailBatch(env, messages, idempotencyKey = '') {
  const payload = messages.slice(0, 100).map(input => {
    const to = normalizedRecipients(input.to);
    if (!to.length) throw new Error('invalid_recipient');
    const message = {
      from: clean(env.EMAIL_FROM, 320),
      to,
      subject: clean(input.subject, 500),
      html: String(input.html || ''),
      text: clean(input.text, 20000)
    };
    const replyTo = clean(input.replyTo || env.EMAIL_REPLY_TO, 320);
    if (replyTo) message.reply_to = replyTo;
    if (input.headers && typeof input.headers === 'object') message.headers = input.headers;
    if (Array.isArray(input.tags) && input.tags.length) message.tags = input.tags;
    return message;
  });
  if (!payload.length) throw new Error('no_messages');
  return resendRequest(env, '/emails/batch', payload, idempotencyKey);
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(value)));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  const left = String(a || ''), right = String(b || '');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export async function createUnsubscribeToken(env, subscriber) {
  const secret = clean(env?.SESSION_SECRET, 1000);
  if (!secret) throw new Error('session_secret_missing');
  return hmacHex(secret, `${subscriber.id}:${String(subscriber.email).toLowerCase()}:unsubscribe:v1`);
}

export async function verifyUnsubscribeToken(env, subscriber, token) {
  const expected = await createUnsubscribeToken(env, subscriber);
  return safeEqual(expected, clean(token, 200));
}

export function publicBaseUrl(request, env) {
  const configured = clean(env?.PUBLIC_SITE_URL, 500).replace(/\/$/, '');
  if (configured) return configured;
  return new URL(request.url).origin;
}
