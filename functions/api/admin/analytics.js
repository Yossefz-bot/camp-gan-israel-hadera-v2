import { integer, json } from '../_shared.js';
import { requireAdmin } from './_auth.js';

const VIEW_EVENT = 'view';
const ENGAGED_SECONDS_EVENT = 'engaged_seconds';
const ACTIVE_WINDOW_SECONDS = 90;

let activeTablePromise = null;

function ensureActiveTable(env) {
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

function normalizePage(row) {
  const views = Number(row.views || 0);
  const engagedSeconds = Number(row.engaged_seconds || 0);
  return {
    page_key: row.page_key,
    views,
    engaged_seconds: engagedSeconds,
    average_seconds: views > 0 ? Math.round(engagedSeconds / views) : 0
  };
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!env.DB) return json({ error: 'db_binding_missing' }, 503);

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(7, integer(url.searchParams.get('days'), 30)));
  const since = `-${days - 1} day`;
  const activeSince = Math.floor(Date.now() / 1000) - ACTIVE_WINDOW_SECONDS;

  try {
    await ensureActiveTable(env);

    const [timeline, pages, events, totals, activeTotal, activePages] = await Promise.all([
      env.DB.prepare(`SELECT
          day,
          SUM(CASE WHEN event_key=? THEN count ELSE 0 END) AS views,
          SUM(CASE WHEN event_key=? THEN count ELSE 0 END) AS engaged_seconds
        FROM analytics_daily
        WHERE day>=date('now',?)
        GROUP BY day
        ORDER BY day`)
        .bind(VIEW_EVENT, ENGAGED_SECONDS_EVENT, since)
        .all(),

      env.DB.prepare(`SELECT * FROM (
          SELECT
            page_key,
            SUM(CASE WHEN event_key=? THEN count ELSE 0 END) AS views,
            SUM(CASE WHEN event_key=? THEN count ELSE 0 END) AS engaged_seconds
          FROM analytics_daily
          WHERE day>=date('now',?)
          GROUP BY page_key
        )
        WHERE views>0 OR engaged_seconds>0
        ORDER BY views DESC, engaged_seconds DESC
        LIMIT 20`)
        .bind(VIEW_EVENT, ENGAGED_SECONDS_EVENT, since)
        .all(),

      env.DB.prepare(`SELECT event_key,SUM(count) AS count
        FROM analytics_daily
        WHERE day>=date('now',?) AND event_key NOT IN (?,?)
        GROUP BY event_key
        ORDER BY count DESC`)
        .bind(since, ENGAGED_SECONDS_EVENT, VIEW_EVENT)
        .all(),

      env.DB.prepare(`SELECT
          COALESCE(SUM(CASE WHEN event_key=? THEN count ELSE 0 END),0) AS views,
          COALESCE(SUM(CASE WHEN event_key=? THEN count ELSE 0 END),0) AS engaged_seconds
        FROM analytics_daily
        WHERE day>=date('now',?)`)
        .bind(VIEW_EVENT, ENGAGED_SECONDS_EVENT, since)
        .first(),

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
        .all()
    ]);

    const totalViews = Number(totals?.views || 0);
    const totalSeconds = Number(totals?.engaged_seconds || 0);

    return json({
      days,
      total_views: totalViews,
      total_engaged_seconds: totalSeconds,
      average_engaged_seconds: totalViews > 0
        ? Math.round(totalSeconds / totalViews)
        : 0,
      active_connections: Number(activeTotal?.n || 0),
      active_window_seconds: ACTIVE_WINDOW_SECONDS,
      active_pages: (activePages.results || []).map(row => ({
        page_key: row.page_key,
        active: Number(row.active || 0)
      })),
      timeline: (timeline.results || []).map(row => ({
        day: row.day,
        views: Number(row.views || 0),
        engaged_seconds: Number(row.engaged_seconds || 0)
      })),
      pages: (pages.results || []).map(normalizePage),
      events: events.results || []
    });
  } catch (error) {
    return json({
      error: 'operation_failed',
      message: error.message
    }, 500);
  }
}
