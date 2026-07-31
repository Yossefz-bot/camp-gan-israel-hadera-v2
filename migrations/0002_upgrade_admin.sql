-- להריץ פעם אחת בלבד ב־D1 Console אחרי העלאת גרסה V5.
PRAGMA foreign_keys = ON;

ALTER TABLE days ADD COLUMN label TEXT DEFAULT '';
ALTER TABLE days ADD COLUMN video_url TEXT DEFAULT '';
ALTER TABLE days ADD COLUMN video_aspect TEXT DEFAULT 'landscape';

ALTER TABLE media ADD COLUMN category TEXT DEFAULT 'gallery';
ALTER TABLE media ADD COLUMN original_name TEXT DEFAULT '';
ALTER TABLE media ADD COLUMN alt_text TEXT DEFAULT '';
ALTER TABLE media ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1;
ALTER TABLE media ADD COLUMN updated_at TEXT DEFAULT '';

ALTER TABLE messages ADD COLUMN updated_at TEXT DEFAULT '';

ALTER TABLE subscribers ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE subscribers ADD COLUMN updated_at TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 5,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_kind_publish_sort ON media(kind,is_published,sort_order,id);
CREATE INDEX IF NOT EXISTS idx_testimonials_status_sort ON testimonials(status,sort_order,id);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status,id);

UPDATE media SET category=CASE WHEN kind='audio' THEN 'song' WHEN day_id IS NULL THEN 'general' ELSE 'gallery' END WHERE category IS NULL OR category='';
UPDATE subscribers SET status='active' WHERE status IS NULL OR status='';

INSERT OR IGNORE INTO settings(key,value) VALUES
('camp_name','קעמפ גן ישראל חדרה'),
('city','חדרה'),
('phone',''),
('whatsapp',''),
('email',''),
('address',''),
('hero_kicker','קיץ של חוויה • שליחות • חברות'),
('hero_image_key',''),
('registration_video_url',''),
('registration_video_aspect','landscape'),
('registration_button_text','הרשמה לקעמפ'),
('registration_button_url',''),
('story_kicker','הסיפור שלנו'),
('story_title','קיץ של רגעים שלא שוכחים'),
('story_text',''),
('story_image_key',''),
('logo_key',''),
('footer_logo_1_key',''),
('footer_logo_2_key',''),
('footer_logo_3_key',''),
('footer_text',''),
('theme_primary','#2463eb'),
('theme_secondary','#101c3d'),
('theme_accent','#f0b429'),
('seo_title','קעמפ גן ישראל חדרה'),
('seo_description','גלריות, סרטונים והמנונים מקעמפ גן ישראל חדרה'),
('seo_keywords','קעמפ גן ישראל חדרה, גלריות קעמפ'),
('gallery_sort','oldest');
