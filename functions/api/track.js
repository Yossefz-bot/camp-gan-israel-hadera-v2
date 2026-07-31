import { clean, enforceRateLimit, json, parseJson } from './_shared.js';

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DB) return json({ ok: true });
  const rate = await enforceRateLimit({ env, request, action: 'analytics', limit: 120, windowSeconds: 3600 });
  if (!rate.allowed) return json({ ok: true });
  const body = await parseJson(request);
  const pageKey = clean(body.page || '/', 160).replace(/[^a-zA-Z0-9_\-/\u0590-\u05ff]/g, '').slice(0, 160) || '/';
  const eventKey = clean(body.event || 'view', 80).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'view';
  const day = new Date().toISOString().slice(0, 10);
  const task = env.DB.prepare(`INSERT INTO analytics_daily(day,page_key,event_key,count) VALUES(?,?,?,1)
    ON CONFLICT(day,page_key,event_key) DO UPDATE SET count=count+1`)
    .bind(day, pageKey, eventKey).run().catch(() => null);
  if (waitUntil) waitUntil(task); else await task;
  return json({ ok: true });
}
