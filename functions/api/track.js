import { clean, enforceRateLimit, integer, json, parseJson } from './_shared.js';
import { verifySession } from './admin/_auth.js';

const VIEW_EVENT = 'view';
const ENGAGED_SECONDS_EVENT = 'engaged_seconds';

function normalizePageKey(value) {
  return clean(value || '/', 160)
    .replace(/[^a-zA-Z0-9_\-/\u0590-\u05ff]/g, '')
    .slice(0, 160) || '/';
}

function normalizeEventKey(value) {
  return clean(value || VIEW_EVENT, 80)
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80) || VIEW_EVENT;
}

function eventValue(eventKey, rawValue) {
  if (eventKey !== ENGAGED_SECONDS_EVENT) return 1;
  return Math.min(60, Math.max(0, integer(rawValue, 0)));
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DB) return json({ ok: true });

  const adminSession = await verifySession(request, env).catch(() => null);
  if (adminSession) {
    return json({ ok: true, excluded: true, reason: 'admin_session' });
  }

  const body = await parseJson(request);
  const pageKey = normalizePageKey(body.page);
  const eventKey = normalizeEventKey(body.event);
  const value = eventValue(eventKey, body.value);

  if (eventKey === ENGAGED_SECONDS_EVENT && value < 1) {
    return json({ ok: true, ignored: true });
  }

  const isEngagement = eventKey === ENGAGED_SECONDS_EVENT;
  const rate = await enforceRateLimit({
    env,
    request,
    action: isEngagement ? 'analytics-engagement' : 'analytics-event',
    limit: isEngagement ? 5000 : 1000,
    windowSeconds: 3600
  });

  if (!rate.allowed) return json({ ok: true, rate_limited: true });

  const day = new Date().toISOString().slice(0, 10);
  const task = env.DB.prepare(`
    INSERT INTO analytics_daily(day,page_key,event_key,count)
    VALUES(?,?,?,?)
    ON CONFLICT(day,page_key,event_key)
    DO UPDATE SET count=count+excluded.count
  `)
    .bind(day, pageKey, eventKey, value)
    .run()
    .catch(() => null);

  if (waitUntil) waitUntil(task);
  else await task;

  return json({ ok: true });
}
