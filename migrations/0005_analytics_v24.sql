CREATE TABLE IF NOT EXISTS analytics_visitors (
  visitor_id TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  first_source TEXT NOT NULL DEFAULT 'direct',
  first_device TEXT NOT NULL DEFAULT 'unknown'
);

CREATE INDEX IF NOT EXISTS idx_analytics_visitors_last_seen
  ON analytics_visitors(last_seen);

CREATE TABLE IF NOT EXISTS analytics_sessions (
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
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started
  ON analytics_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_visitor
  ON analytics_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_day
  ON analytics_sessions(day);

CREATE TABLE IF NOT EXISTS analytics_page_sessions (
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
);

CREATE INDEX IF NOT EXISTS idx_analytics_page_sessions_day
  ON analytics_page_sessions(day);
CREATE INDEX IF NOT EXISTS idx_analytics_page_sessions_page
  ON analytics_page_sessions(page_key);
CREATE INDEX IF NOT EXISTS idx_analytics_page_sessions_visitor
  ON analytics_page_sessions(visitor_id);

CREATE TABLE IF NOT EXISTS analytics_content_daily (
  day TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_key TEXT NOT NULL,
  content_label TEXT NOT NULL DEFAULT '',
  event_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day,content_type,content_key,event_key)
);

CREATE INDEX IF NOT EXISTS idx_analytics_content_day
  ON analytics_content_daily(day);
CREATE INDEX IF NOT EXISTS idx_analytics_content_type
  ON analytics_content_daily(content_type);

CREATE TABLE IF NOT EXISTS analytics_active_visitors (
  visitor_id TEXT PRIMARY KEY,
  page_key TEXT NOT NULL,
  last_seen INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_active_last_seen
  ON analytics_active_visitors(last_seen);
