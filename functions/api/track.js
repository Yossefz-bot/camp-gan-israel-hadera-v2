import { clean, enforceRateLimit, integer, json, parseJson } from './_shared.js';
import { verifySession } from './admin/_auth.js';

const VIEW_EVENT = 'view';
const ENGAGED_SECONDS_EVENT = 'engaged_seconds';
const PRESENCE_EVENT = 'presence';
const ACTIVE_WINDOW_SECONDS = 90;

let activeTablePromise = null;

function ensureActiveTable(env) {
  if (!env.DB) return Promise.resolve();
  if (!activeTablePromise) {
    activeTablePromise = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS analytics_active_visitors (
        visitor_id TEXT PRIMARY KEY,
        page_key TEXT NOT NULL,
        last_seen INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_analytics_active_last_seen
        ON analytics_active_visitors(last_seen)`)
    ]).catch(error => {
      activeTablePromise = null;
      throw error;
    });
  }
  return activeTablePromise;
}

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

function normalizeVisitorId(value) {
  const visitorId = clean(value, 80).toLowerCase();
  return /^[a-z0-9-]{16,80}$/.test(visitorId) ? visitorId : '';
}

function eventValue(eventKey, rawValue) {
  if (eventKey !== ENGAGED_SECONDS_EVENT) return 1;
  return Math.min(60, Math.max(0, integer(rawValue, 0)));
}

async function recordPresence({ env, request, pageKey, visitorId }) {
  if (!visitorId) return json({ ok: true, ignored: true });

  const rate = await enforceRateLimit({
    env,
    request,
    action: 'analytics-presence',
    limit: 2500,
    windowSeconds: 3600
  });
  if (!rate.allowed) return json({ ok: true, rate_limited: true });

  await ensureActiveTable(env);

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`INSERT INTO analytics_active_visitors(
      visitor_id,page_key,last_seen,updated_at
    ) VALUES(?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(visitor_id) DO UPDATE SET
      page_key=excluded.page_key,
      last_seen=excluded.last_seen,
      updated_at=CURRENT_TIMESTAMP`)
    .bind(visitorId, pageKey, now)
    .run();

  /* ניקוי נדיר של רשומות ישנות, בלי להוסיף פעולה לכל heartbeat. */
  if (Math.random() < 0.02) {
    await env.DB.prepare('DELETE FROM analytics_active_visitors WHERE last_seen<?')
      .bind(now - 86400)
      .run()
      .catch(() => null);
  }

  return json({
    ok: true,
    active_window_seconds: ACTIVE_WINDOW_SECONDS
  });
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DB) return json({ ok: true });

  /*
   * מכשיר שמחובר לניהול מוחרג גם בצד השרת.
   * כך כניסות המנהל אינן נספרות אפילו אם המטמון בדפדפן ישן.
   */
  const adminSession = await verifySession(request, env).catch(() => null);
  if (adminSession) {
    return json({ ok: true, excluded: true, reason: 'admin_session' });
  }

  const body = await parseJson(request);
  const pageKey = normalizePageKey(body.page);
  const eventKey = normalizeEventKey(body.event);

  if (eventKey === PRESENCE_EVENT) {
    return recordPresence({
      env,
      request,
      pageKey,
      visitorId: normalizeVisitorId(body.visitor_id)
    });
  }

  const value = eventValue(eventKey, body.value);
  if (eventKey === ENGAGED_SECONDS_EVENT && value < 1) {
    return json({ ok: true, ignored: true });
  }

  const isEngagement = eventKey === ENGAGED_SECONDS_EVENT;
  const rate = await enforceRateLimit({
    env,
    request,
    action: isEngagement ? 'analytics-engagement' : 'analytics-event',
    limit: isEngagement ? 500 : 1000,
    windowSeconds: 3600
  });
  if (!rate.allowed) return json({ ok: true, rate_limited: true });

  const day = new Date().toISOString().slice(0, 10);
  const task = env.DB.prepare(`INSERT INTO analytics_daily(
      day,page_key,event_key,count
    ) VALUES(?,?,?,?)
    ON CONFLICT(day,page_key,event_key)
    DO UPDATE SET count=count+excluded.count`)
    .bind(day, pageKey, eventKey, value)
    .run()
    .catch(() => null);

  if (waitUntil) waitUntil(task);
  else await task;

  return json({ ok: true });
}
