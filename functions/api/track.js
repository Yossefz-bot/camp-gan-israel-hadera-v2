import { clean, enforceRateLimit, integer, json, parseJson } from './_shared.js';
import { verifySession } from './admin/_auth.js';

const ACTIVE_WINDOW_SECONDS = 90;
const MAX_ENGAGED_SECONDS = 60;

let tablesPromise = null;

function ensureTables(env) {
  if (!env.DB) return Promise.resolve();
  if (!tablesPromise) {
    tablesPromise = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS analytics_visitors (
        visitor_id TEXT PRIMARY KEY,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        first_source TEXT NOT NULL DEFAULT 'direct',
        first_device TEXT NOT NULL DEFAULT 'unknown'
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_analytics_visitors_last_seen
        ON analytics_visitors(last_seen)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS analytics_sessions (
        session_id TEXT PRIMARY KEY,
        visitor_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        day TEXT NOT NULL,
        entry_page TEXT NOT NULL,
        current_page TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'direct',
        device TEXT NOT NULL DEFAULT 'unknown',
        page_views INTEGER NOT NULL DEFAULT 0,
        engaged_seconds INTEGER NOT NULL DEFAULT 0,
        max_scroll INTEGER NOT NULL DEFAULT 0
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started
        ON analytics_sessions(started_at)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_analytics_sessions_visitor
        ON analytics_sessions(visitor_id)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_analytics_sessions_day
        ON analytics_sessions(day)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS analytics_page_sessions (
        session_id TEXT NOT NULL,
        visitor_id TEXT NOT NULL,
        day TEXT NOT NULL,
        page_key TEXT NOT NULL,
        page_title TEXT NOT NULL DEFAULT '',
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        views INTEGER NOT NULL DEFAULT 0,
        engaged_seconds INTEGER NOT NULL DEFAULT 0,
        max_scroll INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(session_id,page_key)
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_analytics_page_sessions_day
        ON analytics_page_sessions(day)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_analytics_page_sessions_page
        ON analytics_page_sessions(page_key)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_analytics_page_sessions_visitor
        ON analytics_page_sessions(visitor_id)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS analytics_content_daily (
        day TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_key TEXT NOT NULL,
        content_label TEXT NOT NULL DEFAULT '',
        event_key TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        value INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(day,content_type,content_key,event_key)
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_analytics_content_day
        ON analytics_content_daily(day)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_analytics_content_type
        ON analytics_content_daily(content_type)`),
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
      tablesPromise = null;
      throw error;
    });
  }
  return tablesPromise;
}

function normalizeId(value) {
  const id = clean(value, 90).toLowerCase();
  return /^[a-z0-9-]{16,90}$/.test(id) ? id : '';
}

function normalizePage(value) {
  return clean(value || '/', 180)
    .replace(/[^a-zA-Z0-9_\-/\u0590-\u05ff]/g, '')
    .slice(0, 180) || '/';
}

function normalizeLabel(value, max = 180) {
  return clean(value, max).replace(/[\u0000-\u001f]/g, ' ').slice(0, max);
}

function normalizeToken(value, fallback = 'unknown', max = 60) {
  const token = clean(value, max).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return token || fallback;
}

function normalizeScroll(value) {
  return Math.min(100, Math.max(0, integer(value, 0)));
}

function normalizeSeconds(value) {
  return Math.min(MAX_ENGAGED_SECONDS, Math.max(0, integer(value, 0)));
}

function activeStatement(env, visitorId, pageKey, now) {
  return env.DB.prepare(`INSERT INTO analytics_active_visitors(
      visitor_id,page_key,last_seen,updated_at
    ) VALUES(?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(visitor_id) DO UPDATE SET
      page_key=excluded.page_key,
      last_seen=excluded.last_seen,
      updated_at=CURRENT_TIMESTAMP`)
    .bind(visitorId, pageKey, now);
}

async function recordPageView({ env, body, request }) {
  const visitorId = normalizeId(body.visitor_id);
  const sessionId = normalizeId(body.session_id);
  if (!visitorId || !sessionId) return json({ ok: true, ignored: true });

  const pageKey = normalizePage(body.page);
  const pageTitle = normalizeLabel(body.page_title || pageKey, 180);
  const source = normalizeToken(body.source, 'direct', 50);
  const device = normalizeToken(body.device, 'unknown', 30);
  const now = Math.floor(Date.now() / 1000);
  const day = new Date(now * 1000).toISOString().slice(0, 10);

  const rate = await enforceRateLimit({
    env,
    request,
    action: 'analytics-page-view-v24',
    limit: 10000,
    windowSeconds: 3600
  });
  if (!rate.allowed) return json({ ok: true, rate_limited: true });

  await env.DB.batch([
    env.DB.prepare(`INSERT INTO analytics_visitors(
        visitor_id,first_seen,last_seen,first_source,first_device
      ) VALUES(?,?,?,?,?)
      ON CONFLICT(visitor_id) DO UPDATE SET
        last_seen=excluded.last_seen`)
      .bind(visitorId, now, now, source, device),

    env.DB.prepare(`INSERT OR IGNORE INTO analytics_sessions(
        session_id,visitor_id,started_at,last_seen,day,entry_page,current_page,
        source,device,page_views,engaged_seconds,max_scroll
      ) VALUES(?,?,?,?,?,?,?,?,?,0,0,0)`)
      .bind(sessionId, visitorId, now, now, day, pageKey, pageKey, source, device),

    env.DB.prepare(`UPDATE analytics_sessions SET
        last_seen=?,current_page=?,page_views=page_views+1
      WHERE session_id=? AND visitor_id=?`)
      .bind(now, pageKey, sessionId, visitorId),

    env.DB.prepare(`INSERT INTO analytics_page_sessions(
        session_id,visitor_id,day,page_key,page_title,first_seen,last_seen,
        views,engaged_seconds,max_scroll
      ) VALUES(?,?,?,?,?,?,?,1,0,0)
      ON CONFLICT(session_id,page_key) DO UPDATE SET
        page_title=excluded.page_title,
        last_seen=excluded.last_seen,
        views=analytics_page_sessions.views+1`)
      .bind(sessionId, visitorId, day, pageKey, pageTitle, now, now),

    activeStatement(env, visitorId, pageKey, now)
  ]);

  return json({ ok: true, active_window_seconds: ACTIVE_WINDOW_SECONDS });
}

async function recordHeartbeat({ env, body, request }) {
  const visitorId = normalizeId(body.visitor_id);
  const sessionId = normalizeId(body.session_id);
  if (!visitorId || !sessionId) return json({ ok: true, ignored: true });

  const pageKey = normalizePage(body.page);
  const pageTitle = normalizeLabel(body.page_title || pageKey, 180);
  const source = normalizeToken(body.source, 'direct', 50);
  const device = normalizeToken(body.device, 'unknown', 30);
  const seconds = normalizeSeconds(body.engaged_seconds ?? body.value);
  const maxScroll = normalizeScroll(body.max_scroll);
  const now = Math.floor(Date.now() / 1000);
  const day = new Date(now * 1000).toISOString().slice(0, 10);

  const rate = await enforceRateLimit({
    env,
    request,
    action: 'analytics-heartbeat-v24',
    limit: 20000,
    windowSeconds: 3600
  });
  if (!rate.allowed) return json({ ok: true, rate_limited: true });

  await env.DB.batch([
    env.DB.prepare(`INSERT INTO analytics_visitors(
        visitor_id,first_seen,last_seen,first_source,first_device
      ) VALUES(?,?,?,?,?)
      ON CONFLICT(visitor_id) DO UPDATE SET
        last_seen=excluded.last_seen`)
      .bind(visitorId, now, now, source, device),

    env.DB.prepare(`INSERT OR IGNORE INTO analytics_sessions(
        session_id,visitor_id,started_at,last_seen,day,entry_page,current_page,
        source,device,page_views,engaged_seconds,max_scroll
      ) VALUES(?,?,?,?,?,?,?,?,?,0,0,0)`)
      .bind(sessionId, visitorId, now, now, day, pageKey, pageKey, source, device),

    env.DB.prepare(`UPDATE analytics_sessions SET
        last_seen=?,current_page=?,
        engaged_seconds=engaged_seconds+?,
        max_scroll=CASE WHEN max_scroll>? THEN max_scroll ELSE ? END
      WHERE session_id=? AND visitor_id=?`)
      .bind(now, pageKey, seconds, maxScroll, maxScroll, sessionId, visitorId),

    env.DB.prepare(`INSERT INTO analytics_page_sessions(
        session_id,visitor_id,day,page_key,page_title,first_seen,last_seen,
        views,engaged_seconds,max_scroll
      ) VALUES(?,?,?,?,?,?,?,0,?,?)
      ON CONFLICT(session_id,page_key) DO UPDATE SET
        page_title=excluded.page_title,
        last_seen=excluded.last_seen,
        engaged_seconds=analytics_page_sessions.engaged_seconds+excluded.engaged_seconds,
        max_scroll=CASE
          WHEN analytics_page_sessions.max_scroll>excluded.max_scroll
          THEN analytics_page_sessions.max_scroll
          ELSE excluded.max_scroll
        END`)
      .bind(sessionId, visitorId, day, pageKey, pageTitle, now, now, seconds, maxScroll),

    activeStatement(env, visitorId, pageKey, now)
  ]);

  if (Math.random() < 0.02) {
    await env.DB.prepare('DELETE FROM analytics_active_visitors WHERE last_seen<?')
      .bind(now - 86400)
      .run()
      .catch(() => null);
  }

  return json({ ok: true, active_window_seconds: ACTIVE_WINDOW_SECONDS });
}

async function recordContent({ env, body, request }) {
  const visitorId = normalizeId(body.visitor_id);
  const sessionId = normalizeId(body.session_id);
  if (!visitorId || !sessionId) return json({ ok: true, ignored: true });

  const pageKey = normalizePage(body.page);
  const contentType = normalizeToken(body.content_type, 'other', 40);
  const contentKey = normalizeLabel(body.content_key || 'unknown', 220);
  const contentLabel = normalizeLabel(body.content_label || contentKey, 180);
  const contentEvent = normalizeToken(body.content_event, 'interaction', 50);
  const rawValue = Math.min(3600, Math.max(0, integer(body.value, 0)));
  const isDuration = contentEvent.endsWith('_seconds');
  const count = isDuration
    ? 0
    : Math.min(100, Math.max(1, integer(body.value, 1)));
  const value = isDuration ? rawValue : 0;
  const now = Math.floor(Date.now() / 1000);
  const day = new Date(now * 1000).toISOString().slice(0, 10);

  const rate = await enforceRateLimit({
    env,
    request,
    action: 'analytics-content-v24',
    limit: 10000,
    windowSeconds: 3600
  });
  if (!rate.allowed) return json({ ok: true, rate_limited: true });

  await env.DB.batch([
    env.DB.prepare(`INSERT INTO analytics_content_daily(
        day,content_type,content_key,content_label,event_key,count,value
      ) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(day,content_type,content_key,event_key) DO UPDATE SET
        content_label=excluded.content_label,
        count=analytics_content_daily.count+excluded.count,
        value=analytics_content_daily.value+excluded.value`)
      .bind(day, contentType, contentKey, contentLabel, contentEvent, count, value),

    env.DB.prepare(`UPDATE analytics_sessions SET
        last_seen=?,current_page=?
      WHERE session_id=? AND visitor_id=?`)
      .bind(now, pageKey, sessionId, visitorId),

    activeStatement(env, visitorId, pageKey, now)
  ]);

  return json({ ok: true });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: true });

  const adminSession = await verifySession(request, env).catch(() => null);
  if (adminSession) {
    return json({ ok: true, excluded: true, reason: 'admin_session' });
  }

  await ensureTables(env);
  const body = await parseJson(request);
  const event = normalizeToken(body.event, 'page_view', 40);

  if (event === 'page_view' || event === 'view') {
    return recordPageView({ env, body, request });
  }
  if (event === 'heartbeat' || event === 'presence' || event === 'engaged_seconds') {
    return recordHeartbeat({ env, body, request });
  }
  if (event === 'content') {
    return recordContent({ env, body, request });
  }

  return json({ ok: true, ignored: true });
}
