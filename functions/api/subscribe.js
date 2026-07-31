import { clean, digits, enforceRateLimit, isEmail, json, loadSettings, parseJson } from './_shared.js';

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'setup_required', message: 'המערכת עדיין לא חוברה למסד הנתונים.' }, 503);
  const settings = await loadSettings(env).catch(() => ({}));
  if (settings.allow_newsletter_signup === '0') return json({ error: 'disabled' }, 403);
  const rate = await enforceRateLimit({ env, request, action: 'subscribe', limit: 6, windowSeconds: 3600 });
  if (!rate.allowed) return json({ error: 'too_many_requests', message: 'נשלחו יותר מדי בקשות. נסו שוב מאוחר יותר.' }, 429);

  const body = await parseJson(request);
  if (clean(body.website, 200)) return json({ ok: true });
  const name = clean(body.name, 120);
  const phone = clean(body.phone, 40);
  const email = clean(body.email, 200).toLowerCase();
  if (name.length < 2) return json({ error: 'invalid_name', message: 'יש להזין שם.' }, 400);
  if (digits(phone).length < 9 || digits(phone).length > 15) return json({ error: 'invalid_phone', message: 'מספר הטלפון אינו תקין.' }, 400);
  if (!isEmail(email)) return json({ error: 'invalid_email', message: 'כתובת האימייל אינה תקינה.' }, 400);
  if (body.consent !== true) return json({ error: 'consent_required', message: 'יש לאשר קבלת עדכונים.' }, 400);

  await env.DB.prepare(`INSERT INTO subscribers(name,phone,email,status,source,consent,updated_at)
    VALUES(?,?,?,'active','אתר הקעמפ',1,CURRENT_TIMESTAMP)
    ON CONFLICT(email) DO UPDATE SET name=excluded.name,phone=excluded.phone,status='active',consent=1,updated_at=CURRENT_TIMESTAMP`)
    .bind(name, phone, email).run();
  return json({ ok: true, message: 'נרשמתם בהצלחה לעדכוני הקעמפ!' });
}
