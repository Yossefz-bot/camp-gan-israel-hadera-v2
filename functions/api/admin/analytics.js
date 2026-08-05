import { integer, json } from '../_shared.js';
import { requireAdmin } from './_auth.js';

const ACTIVE_WINDOW_SECONDS = 90;
let tablesPromise = null;

function ensureTables(env) {
  if (!tablesPromise) {
    tablesPromise = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS analytics_visitors (
        visitor_id TEXT PRIMARY KEY,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        first_source TEXT NOT NULL DEFAULT 'direct',
        first_device TEXT NOT NULL DEFAULT 'unknown'
      )`),
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

function percentChange(current, previous) {
  const now = Number(current || 0);
  const before = Number(previous || 0);
  if (!before) return now ? 100 : 0;
  return Math.round(((now - before) / before) * 100);
}

function periodBounds(days) {
  const now = Math.floor(Date.now() / 1000);
  const today = new Date();
  const todayStart = Math.floor(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  ) / 1000);
  const start = todayStart - (days - 1) * 86400;
  const previousStart = start - days * 86400;
  return {
    now,
    start,
    end: now,
    previousStart,
    previousEnd: start - 1,
    startDay: new Date(start * 1000).toISOString().slice(0, 10)
  };
}

async function summaryForRange(env, start, end, now) {
  const [summary, returning] = await Promise.all([
    env.DB.prepare(`SELECT
        COUNT(*) AS sessions,
        COUNT(DISTINCT visitor_id) AS unique_visitors,
        COALESCE(SUM(page_views),0) AS page_views,
        COALESCE(SUM(engaged_seconds),0) AS engaged_seconds,
        COALESCE(SUM(CASE
          WHEN last_seen<? AND page_views=1 AND engaged_seconds<10
          THEN 1 ELSE 0 END),0) AS quick_exits,
        COALESCE(SUM(CASE WHEN last_seen<? THEN 1 ELSE 0 END),0) AS completed_sessions
      FROM analytics_sessions
      WHERE started_at>=? AND started_at<=?`)
      .bind(now - ACTIVE_WINDOW_SECONDS, now - ACTIVE_WINDOW_SECONDS, start, end)
      .first(),

    env.DB.prepare(`SELECT COUNT(DISTINCT s.visitor_id) AS n
      FROM analytics_sessions s
      JOIN analytics_visitors v ON v.visitor_id=s.visitor_id
      WHERE s.started_at>=? AND s.started_at<=? AND v.first_seen<?`)
      .bind(start, end, start)
      .first()
  ]);

  const sessions = Number(summary?.sessions || 0);
  const uniqueVisitors = Number(summary?.unique_visitors || 0);
  const pageViews = Number(summary?.page_views || 0);
  const engagedSeconds = Number(summary?.engaged_seconds || 0);
  const quickExits = Number(summary?.quick_exits || 0);
  const completedSessions = Number(summary?.completed_sessions || 0);
  const returningVisitors = Number(returning?.n || 0);

  return {
    sessions,
    unique_visitors: uniqueVisitors,
    page_views: pageViews,
    engaged_seconds: engagedSeconds,
    average_session_seconds: sessions ? Math.round(engagedSeconds / sessions) : 0,
    pages_per_session: sessions ? Number((pageViews / sessions).toFixed(2)) : 0,
    returning_visitors: returningVisitors,
    returning_rate: uniqueVisitors ? Math.round((returningVisitors / uniqueVisitors) * 100) : 0,
    quick_exit_rate: completedSessions ? Math.round((quickExits / completedSessions) * 100) : 0
  };
}

function contentGroups(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const id = `${row.content_type}\u0000${row.content_key}`;
    if (!groups.has(id)) {
      groups.set(id, {
        content_type: row.content_type,
        content_key: row.content_key,
        content_label: row.content_label || row.content_key,
        metrics: {}
      });
    }
    const item = groups.get(id);
    item.content_label = row.content_label || item.content_label;
    item.metrics[row.event_key] = row.event_key.endsWith('_seconds')
      ? Number(row.value || 0)
      : Number(row.count || 0);
  }

  const result = { videos: [], audio: [], galleries: [], actions: [] };
  for (const item of groups.values()) {
    if (item.content_type === 'video') result.videos.push(item);
    else if (item.content_type === 'audio') result.audio.push(item);
    else if (item.content_type === 'gallery') result.galleries.push(item);
    else result.actions.push(item);
  }

  result.videos.sort((a, b) => (b.metrics.start || 0) - (a.metrics.start || 0));
  result.audio.sort((a, b) => (b.metrics.start || 0) - (a.metrics.start || 0));
  result.galleries.sort((a, b) => (b.metrics.open || 0) - (a.metrics.open || 0));
  return result;
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!env.DB) return json({ error: 'db_binding_missing' }, 503);

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, integer(url.searchParams.get('days'), 30)));
  const bounds = periodBounds(days);
  const activeSince = bounds.now - ACTIVE_WINDOW_SECONDS;

  try {
    await ensureTables(env);

    const [current, previous, timeline, pages, sources, devices, activeTotal,
      activePages, contentRows, legacy] = await Promise.all([
      summaryForRange(env, bounds.start, bounds.end, bounds.now),
      summaryForRange(env, bounds.previousStart, bounds.previousEnd, bounds.now),

      env.DB.prepare(`SELECT
          day,
          COUNT(*) AS sessions,
          COUNT(DISTINCT visitor_id) AS visitors,
          COALESCE(SUM(page_views),0) AS page_views,
          COALESCE(SUM(engaged_seconds),0) AS engaged_seconds
        FROM analytics_sessions
        WHERE started_at>=? AND started_at<=?
        GROUP BY day
        ORDER BY day`)
        .bind(bounds.start, bounds.end)
        .all(),

      env.DB.prepare(`SELECT
          page_key,
          MAX(page_title) AS page_title,
          COUNT(*) AS sessions,
          COUNT(DISTINCT visitor_id) AS visitors,
          COALESCE(SUM(views),0) AS page_views,
          COALESCE(SUM(engaged_seconds),0) AS engaged_seconds,
          ROUND(AVG(max_scroll)) AS average_scroll,
          COALESCE(SUM(CASE
            WHEN last_seen<? AND views=1 AND engaged_seconds<10
            THEN 1 ELSE 0 END),0) AS quick_exits,
          COALESCE(SUM(CASE WHEN last_seen<? THEN 1 ELSE 0 END),0) AS completed_sessions
        FROM analytics_page_sessions
        WHERE first_seen>=? AND first_seen<=?
        GROUP BY page_key
        ORDER BY page_views DESC,engaged_seconds DESC
        LIMIT 50`)
        .bind(activeSince, activeSince, bounds.start, bounds.end)
        .all(),

      env.DB.prepare(`SELECT
          source,
          COUNT(*) AS sessions,
          COUNT(DISTINCT visitor_id) AS visitors
        FROM analytics_sessions
        WHERE started_at>=? AND started_at<=?
        GROUP BY source
        ORDER BY sessions DESC`)
        .bind(bounds.start, bounds.end)
        .all(),

      env.DB.prepare(`SELECT
          device,
          COUNT(*) AS sessions,
          COUNT(DISTINCT visitor_id) AS visitors
        FROM analytics_sessions
        WHERE started_at>=? AND started_at<=?
        GROUP BY device
        ORDER BY sessions DESC`)
        .bind(bounds.start, bounds.end)
        .all(),

      env.DB.prepare(`SELECT COUNT(*) AS n
        FROM analytics_active_visitors
        WHERE last_seen>=?`)
        .bind(activeSince)
        .first(),

      env.DB.prepare(`SELECT page_key,COUNT(*) AS active
        FROM analytics_active_visitors
        WHERE last_seen>=?
        GROUP BY page_key
        ORDER BY active DESC,page_key
        LIMIT 20`)
        .bind(activeSince)
        .all(),

      env.DB.prepare(`SELECT
          content_type,content_key,MAX(content_label) AS content_label,
          event_key,SUM(count) AS count,SUM(value) AS value
        FROM analytics_content_daily
        WHERE day>=?
        GROUP BY content_type,content_key,event_key
        ORDER BY content_type,content_key`)
        .bind(bounds.startDay)
        .all(),

      env.DB.prepare(`SELECT COALESCE(SUM(count),0) AS views
        FROM analytics_daily
        WHERE event_key='view'`)
        .first()
        .catch(() => ({ views: 0 }))
    ]);

    const comparison = {};
    for (const key of [
      'unique_visitors','sessions','page_views','engaged_seconds',
      'average_session_seconds','returning_rate','quick_exit_rate'
    ]) {
      comparison[key] = {
        current: Number(current[key] || 0),
        previous: Number(previous[key] || 0),
        delta: percentChange(current[key], previous[key])
      };
    }

    return json({
      days,
      summary: {
        ...current,
        active_connections: Number(activeTotal?.n || 0)
      },
      comparison,
      timeline: (timeline.results || []).map(row => ({
        day: row.day,
        visitors: Number(row.visitors || 0),
        sessions: Number(row.sessions || 0),
        page_views: Number(row.page_views || 0),
        engaged_seconds: Number(row.engaged_seconds || 0)
      })),
      pages: (pages.results || []).map(row => {
        const sessions = Number(row.sessions || 0);
        const completed = Number(row.completed_sessions || 0);
        return {
          page_key: row.page_key,
          page_title: row.page_title || row.page_key,
          visitors: Number(row.visitors || 0),
          sessions,
          page_views: Number(row.page_views || 0),
          engaged_seconds: Number(row.engaged_seconds || 0),
          average_seconds: sessions
            ? Math.round(Number(row.engaged_seconds || 0) / sessions)
            : 0,
          average_scroll: Number(row.average_scroll || 0),
          quick_exit_rate: completed
            ? Math.round((Number(row.quick_exits || 0) / completed) * 100)
            : 0
        };
      }),
      sources: (sources.results || []).map(row => ({
        source: row.source,
        sessions: Number(row.sessions || 0),
        visitors: Number(row.visitors || 0)
      })),
      devices: (devices.results || []).map(row => ({
        device: row.device,
        sessions: Number(row.sessions || 0),
        visitors: Number(row.visitors || 0)
      })),
      active_window_seconds: ACTIVE_WINDOW_SECONDS,
      active_pages: (activePages.results || []).map(row => ({
        page_key: row.page_key,
        active: Number(row.active || 0)
      })),
      content: contentGroups(contentRows.results || []),
      legacy_views: Number(legacy?.views || 0)
    });
  } catch (error) {
    return json({
      error: 'operation_failed',
      message: error.message
    }, 500);
  }
}
