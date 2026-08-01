import { clean, digits, enforceRateLimit, isEmail, json, loadSettings, parseJson } from './_shared.js';

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'setup_required' }, 503);
  const settings = await loadSettings(env).catch(() => ({}));
  if (settings.allow_contact_form === '0') return json({ error: 'disabled' }, 403);
  const rate = await enforceRateLimit({ env, request, action: 'contact', limit: 5, windowSeconds: 3600 });
  if (!rate.allowed) return json({ error: 'too_many_requests', message: 'נשלחו יותר מדי הודעות. נסו שוב מאוחר יותר.' }, 429);

  const body = await parseJson(request);
  if (clean(body.website, 200)) return json({ ok: true });
  const name = clean(body.name, 160);
  const phone = clean(body.phone, 80);
  const email = clean(body.email, 200).toLowerCase();
  const subject = clean(body.subject, 240);
  const message = clean(body.message, 4000);
  if (name.length < 2 || message.length < 10) return json({ error: 'invalid_fields', message: 'יש להזין שם והודעה של לפחות 10 תווים.' }, 400);
  if (digits(phone).length < 9 || digits(phone).length > 15) return json({ error: 'invalid_phone', message: 'יש להזין מספר טלפון תקין כדי שנוכל לחזור אליכם ב־WhatsApp.' }, 400);
  if (email && !isEmail(email)) return json({ error: 'invalid_email', message: 'כתובת האימייל אינה תקינה.' }, 400);

  await env.DB.prepare("INSERT INTO contact_messages(name,phone,email,subject,message,status,source,updated_at) VALUES(?,?,?,?,?,'new','אתר הקעמפ',CURRENT_TIMESTAMP)")
    .bind(name, phone, email, subject, message).run();
  return json({ ok: true, message: 'ההודעה נשלחה בהצלחה. נחזור אליכם בהקדם.' });
}
