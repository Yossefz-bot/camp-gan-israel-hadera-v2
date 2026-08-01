-- V12: תשובות במייל, ניוזלטרים, מצגת דף הבית ותמונת מרכז לתקליט.
-- בטוח להרצה על מסד קיים: כל הטבלאות נוצרות רק אם אינן קיימות.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS contact_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  provider_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent','failed')),
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(contact_id) REFERENCES contact_messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  preheader TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  cta_text TEXT NOT NULL DEFAULT '',
  cta_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sending','sent','partial','failed')),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS newsletter_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  subscriber_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
  provider_id TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id,subscriber_id),
  FOREIGN KEY(campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY(subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS homepage_slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK(kind IN ('image','video')),
  object_key TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  poster_key TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  alt_text TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 6,
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  autoplay INTEGER NOT NULL DEFAULT 1 CHECK(autoplay IN (0,1)),
  loop INTEGER NOT NULL DEFAULT 0 CHECK(loop IN (0,1)),
  controls INTEGER NOT NULL DEFAULT 0 CHECK(controls IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_replies_contact ON contact_replies(contact_id,created_at,id);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_created ON newsletter_campaigns(created_at,id);
CREATE INDEX IF NOT EXISTS idx_newsletter_deliveries_campaign_status ON newsletter_deliveries(campaign_id,status,id);
CREATE INDEX IF NOT EXISTS idx_homepage_slides_status_sort ON homepage_slides(status,sort_order,id);

INSERT OR IGNORE INTO settings(key,value) VALUES
('record_center_image_key','');
