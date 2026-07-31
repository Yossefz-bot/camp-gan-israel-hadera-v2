import { clean, enforceRateLimit, integer, json, loadSettings, parseJson } from './_shared.js';

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'setup_required' }, 503);
  const settings = await loadSettings(env).catch(() => ({}));
  if (settings.allow_testimonial_submission === '0') return json({ error: 'disabled' }, 403);
  const rate = await enforceRateLimit({ env, request, action: 'testimonial', limit: 3, windowSeconds: 3600 });
  if (!rate.allowed) return json({ error: 'too_many_requests', message: 'נשלחו יותר מדי תגובות. נסו שוב מאוחר יותר.' }, 429);

  const body = await parseJson(request);
  if (clean(body.website, 200)) return json({ ok: true });
  const name = clean(body.name, 160);
  const relation = clean(body.relation, 160);
  const phone = clean(body.phone, 80);
  const message = clean(body.message, 3000);
  const rating = Math.min(5, Math.max(1, integer(body.rating, 5)));
  if (name.length < 2 || message.length < 10) return json({ error: 'invalid_fields', message: 'יש להזין שם ותגובה של לפחות 10 תווים.' }, 400);

  await env.DB.prepare("INSERT INTO testimonials(name,relation,phone,rating,message,status,sort_order,updated_at) VALUES(?,?,?,?,?,'pending',0,CURRENT_TIMESTAMP)")
    .bind(name, relation, phone, rating, message).run();
  return json({ ok: true, message: 'תודה! התגובה נשלחה לאישור.' });
}
