-- מיועד רק למסד שעליו הותקנה גרסת V9 הישנה.
-- שומר ימים, מדיה, הודעות, נרשמים ותגובות וממיר אותם למבנה V10.
PRAGMA foreign_keys = OFF;

ALTER TABLE days RENAME TO days_v9;
ALTER TABLE media RENAME TO media_v9;
ALTER TABLE messages RENAME TO messages_v9;
ALTER TABLE subscribers RENAME TO subscribers_v9;
ALTER TABLE testimonials RENAME TO testimonials_v9;

CREATE TABLE days (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '', date TEXT NOT NULL DEFAULT '', hebrew_date TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '', story TEXT NOT NULL DEFAULT '', cover_key TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '', video_key TEXT NOT NULL DEFAULT '',
  video_aspect TEXT NOT NULL DEFAULT 'landscape' CHECK(video_aspect IN ('landscape','portrait','square')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  sort_order INTEGER NOT NULL DEFAULT 0, starts_at TEXT NOT NULL DEFAULT '', published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT, day_id INTEGER,
  kind TEXT NOT NULL CHECK(kind IN ('image','video','audio','document')), category TEXT NOT NULL DEFAULT 'gallery',
  title TEXT NOT NULL DEFAULT '', original_name TEXT NOT NULL DEFAULT '', alt_text TEXT NOT NULL DEFAULT '', caption TEXT NOT NULL DEFAULT '',
  object_key TEXT NOT NULL UNIQUE, mime_type TEXT NOT NULL DEFAULT '', size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0, height INTEGER NOT NULL DEFAULT 0, duration_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','archived')),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK(is_featured IN (0,1)), sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(day_id) REFERENCES days(id) ON DELETE SET NULL
);

CREATE TABLE announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'info' CHECK(tone IN ('info','success','warning','urgent')),
  button_text TEXT NOT NULL DEFAULT '', button_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  starts_at TEXT NOT NULL DEFAULT '', ends_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','unsubscribed')), source TEXT NOT NULL DEFAULT 'אתר הקעמפ',
  consent INTEGER NOT NULL DEFAULT 1 CHECK(consent IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, relation TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 5 CHECK(rating BETWEEN 1 AND 5), message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO days(id,slug,title,label,date,description,cover_key,video_url,video_aspect,status,sort_order,created_at,updated_at)
SELECT id,slug,title,COALESCE(label,''),COALESCE(date,''),COALESCE(description,''),COALESCE(cover_key,''),COALESCE(video_url,''),COALESCE(video_aspect,'landscape'),CASE WHEN is_published=1 THEN 'published' ELSE 'draft' END,sort_order,created_at,updated_at FROM days_v9;

INSERT INTO media(id,day_id,kind,category,title,original_name,alt_text,object_key,mime_type,size_bytes,status,sort_order,created_at,updated_at)
SELECT id,day_id,kind,COALESCE(category,'gallery'),COALESCE(title,''),COALESCE(original_name,''),COALESCE(alt_text,''),object_key,COALESCE(mime_type,''),COALESCE(size_bytes,0),CASE WHEN is_published=1 THEN 'published' ELSE 'draft' END,sort_order,created_at,updated_at FROM media_v9;

INSERT INTO announcements(id,title,body,tone,button_text,button_url,status,created_at,updated_at)
SELECT id,title,body,CASE WHEN tone IN ('info','success','warning') THEN tone ELSE 'info' END,COALESCE(button_text,''),COALESCE(button_url,''),CASE WHEN is_active=1 THEN 'published' ELSE 'archived' END,created_at,updated_at FROM messages_v9;

INSERT INTO subscribers(id,name,phone,email,status,source,consent,created_at,updated_at)
SELECT id,COALESCE(name,''),COALESCE(phone,''),email,status,COALESCE(source,'אתר הקעמפ'),COALESCE(consent,1),created_at,updated_at FROM subscribers_v9;

INSERT INTO testimonials(id,name,relation,phone,rating,message,status,sort_order,created_at,updated_at)
SELECT id,name,COALESCE(relation,''),COALESCE(phone,''),rating,message,status,sort_order,created_at,updated_at FROM testimonials_v9;

DROP TABLE media_v9;
DROP TABLE days_v9;
DROP TABLE messages_v9;
DROP TABLE subscribers_v9;
DROP TABLE testimonials_v9;

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '', message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','read','handled','archived')),
  source TEXT NOT NULL DEFAULT 'אתר הקעמפ', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS analytics_daily (day TEXT NOT NULL,page_key TEXT NOT NULL,event_key TEXT NOT NULL DEFAULT 'view',count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,page_key,event_key));
CREATE TABLE IF NOT EXISTS rate_limits (rate_key TEXT PRIMARY KEY,window_start INTEGER NOT NULL,hits INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS admin_audit (id INTEGER PRIMARY KEY AUTOINCREMENT,action TEXT NOT NULL,entity_type TEXT NOT NULL DEFAULT '',entity_id TEXT NOT NULL DEFAULT '',details TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE INDEX IF NOT EXISTS idx_days_status_sort ON days(status,sort_order,date,id);
CREATE INDEX IF NOT EXISTS idx_media_day_status_sort ON media(day_id,status,sort_order,id);
CREATE INDEX IF NOT EXISTS idx_media_kind_status_sort ON media(kind,status,sort_order,id);
CREATE INDEX IF NOT EXISTS idx_media_category ON media(category,id);
CREATE INDEX IF NOT EXISTS idx_announcements_status_dates ON announcements(status,starts_at,ends_at,id);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status,id);
CREATE INDEX IF NOT EXISTS idx_testimonials_status_sort ON testimonials(status,sort_order,id);
CREATE INDEX IF NOT EXISTS idx_contacts_status_created ON contact_messages(status,created_at,id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit(created_at,id);

INSERT OR IGNORE INTO settings(key,value) VALUES
('season_label','קיץ תשפ״ו'),('hebrew_date',''),('hero_media_type','default'),('hero_video_key',''),('hero_video_url',''),('hero_video_poster_key',''),('hero_video_autoplay','1'),('hero_video_loop','1'),('hero_video_controls','0'),('story_media_type','default'),('story_video_key',''),('story_video_url',''),('story_video_poster_key',''),('story_video_autoplay','0'),('story_video_loop','0'),('story_video_controls','1'),('hero_primary_button_text','לגלריות הקעמפ'),('hero_primary_button_url','#galleries'),
('hero_secondary_button_text','צפו בסרטון'),('hero_secondary_button_url','#latest'),('countdown_target',''),('theme_green','#31b86b'),('theme_purple','#7b4ce2'),
('map_url',''),('instagram_url',''),('youtube_url',''),('facebook_url',''),('show_testimonials','1'),('show_songs','1'),('show_countdown','0'),
('allow_testimonial_submission','1'),('allow_newsletter_signup','1'),('allow_contact_form','1');

CREATE TABLE IF NOT EXISTS contact_replies (id INTEGER PRIMARY KEY AUTOINCREMENT,contact_id INTEGER NOT NULL,to_email TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,provider_id TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent','failed')),error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(contact_id) REFERENCES contact_messages(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS newsletter_campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT,subject TEXT NOT NULL,preheader TEXT NOT NULL DEFAULT '',body TEXT NOT NULL,cta_text TEXT NOT NULL DEFAULT '',cta_url TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sending','sent','partial','failed')),total_recipients INTEGER NOT NULL DEFAULT 0,sent_count INTEGER NOT NULL DEFAULT 0,failed_count INTEGER NOT NULL DEFAULT 0,started_at TEXT,completed_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS newsletter_deliveries (id INTEGER PRIMARY KEY AUTOINCREMENT,campaign_id INTEGER NOT NULL,subscriber_id INTEGER NOT NULL,email TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),provider_id TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '',attempts INTEGER NOT NULL DEFAULT 0,sent_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(campaign_id,subscriber_id),FOREIGN KEY(campaign_id) REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,FOREIGN KEY(subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS homepage_slides (id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL CHECK(kind IN ('image','video')),object_key TEXT NOT NULL DEFAULT '',video_url TEXT NOT NULL DEFAULT '',poster_key TEXT NOT NULL DEFAULT '',title TEXT NOT NULL DEFAULT '',alt_text TEXT NOT NULL DEFAULT '',duration_seconds INTEGER NOT NULL DEFAULT 6,status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','archived')),sort_order INTEGER NOT NULL DEFAULT 0,autoplay INTEGER NOT NULL DEFAULT 1 CHECK(autoplay IN (0,1)),loop INTEGER NOT NULL DEFAULT 0 CHECK(loop IN (0,1)),controls INTEGER NOT NULL DEFAULT 0 CHECK(controls IN (0,1)),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_contact_replies_contact ON contact_replies(contact_id,created_at,id);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_created ON newsletter_campaigns(created_at,id);
CREATE INDEX IF NOT EXISTS idx_newsletter_deliveries_campaign_status ON newsletter_deliveries(campaign_id,status,id);
CREATE INDEX IF NOT EXISTS idx_homepage_slides_status_sort ON homepage_slides(status,sort_order,id);
INSERT OR IGNORE INTO settings(key,value) VALUES('record_center_image_key','');

PRAGMA foreign_keys = ON;
