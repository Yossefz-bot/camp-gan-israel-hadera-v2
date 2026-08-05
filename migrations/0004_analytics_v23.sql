CREATE TABLE IF NOT EXISTS analytics_active_visitors (
  visitor_id TEXT PRIMARY KEY,
  page_key TEXT NOT NULL,
  last_seen INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_active_last_seen
  ON analytics_active_visitors(last_seen);
