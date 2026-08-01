PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  hebrew_date TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  story TEXT NOT NULL DEFAULT '',
  cover_key TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  video_key TEXT NOT NULL DEFAULT '',
  video_aspect TEXT NOT NULL DEFAULT 'landscape' CHECK(video_aspect IN ('landscape','portrait','square')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id INTEGER,
  kind TEXT NOT NULL CHECK(kind IN ('image','video','audio','document')),
  category TEXT NOT NULL DEFAULT 'gallery',
  title TEXT NOT NULL DEFAULT '',
  original_name TEXT NOT NULL DEFAULT '',
  alt_text TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','archived')),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK(is_featured IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(day_id) REFERENCES days(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'info' CHECK(tone IN ('info','success','warning','urgent')),
  button_text TEXT NOT NULL DEFAULT '',
  button_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  starts_at TEXT NOT NULL DEFAULT '',
  ends_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','unsubscribed')),
  source TEXT NOT NULL DEFAULT 'אתר הקעמפ',
  consent INTEGER NOT NULL DEFAULT 1 CHECK(consent IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  relation TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 5 CHECK(rating BETWEEN 1 AND 5),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','read','handled','archived')),
  source TEXT NOT NULL DEFAULT 'אתר הקעמפ',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_daily (
  day TEXT NOT NULL,
  page_key TEXT NOT NULL,
  event_key TEXT NOT NULL DEFAULT 'view',
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day,page_key,event_key)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
('site_title','קעמפ גן ישראל חדרה'),
('camp_name','קעמפ גן ישראל חדרה'),
('city','חדרה'),
('season_label','קיץ תשפ״ו'),
('phone',''),
('whatsapp',''),
('email',''),
('address',''),
('map_url',''),
('instagram_url',''),
('youtube_url',''),
('facebook_url',''),
('hero_kicker','קיץ של אנרגיה • חברות • שליחות'),
('hero_title','הקיץ מתחיל כאן'),
('hero_text','כל התמונות, הסרטונים, ההמנונים והרגעים הגדולים של קעמפ גן ישראל חדרה — במקום אחד.'),
('hero_media_type','default'),
('hero_image_key',''),
('hero_video_key',''),
('hero_video_url',''),
('hero_video_poster_key',''),
('hero_video_autoplay','1'),
('hero_video_loop','1'),
('hero_video_controls','0'),
('hero_primary_button_text','לגלריות הקעמפ'),
('hero_primary_button_url','#galleries'),
('hero_secondary_button_text','צפו בסרטון'),
('hero_secondary_button_url','#latest'),
('registration_button_text','הרשמה לקעמפ'),
('registration_button_url',''),
('countdown_target',''),
('story_kicker','הסיפור שלנו'),
('story_title','קיץ של רגעים שלא שוכחים'),
('story_text','קעמפ הוא הרבה יותר מפעילות. זו חוויה של חברות, שמחה, ערכים ושליחות שנשארת עם הילדים הרבה אחרי שהקיץ נגמר.'),
('story_media_type','default'),
('story_image_key',''),
('story_video_key',''),
('story_video_url',''),
('story_video_poster_key',''),
('story_video_autoplay','1'),
('story_video_loop','1'),
('story_video_controls','0'),
('logo_key',''),
('footer_logo_1_key',''),
('footer_logo_2_key',''),
('footer_logo_3_key',''),
('footer_text','כל החוויות. במקום אחד.'),
('gallery_title','הגלריות של הקעמפ'),
('gallery_text','כל יום מקבל מקום משלו — סרטון סיכום, תמונות ורגעים ששווה לחזור אליהם.'),
('songs_title','המנוני הקעמפ'),
('songs_text','כל השירים וההמנונים שמכניסים מיד לאווירה.'),
('testimonials_title','מה ההורים מספרים'),
('testimonials_text','תגובות אמיתיות מהמשפחות שחוו את הקעמפ איתנו.'),
('updates_title','נשארים מחוברים לקעמפ'),
('updates_text','גלריות חדשות, סרטונים ועדכונים חשובים ישירות אליכם.'),
('contact_title','יצירת קשר'),
('contact_text','לשאלות, הרשמה ופרטים נוספים — נשמח לדבר.'),
('theme_primary','#ff6b16'),
('theme_secondary','#173b67'),
('theme_accent','#ffd234'),
('theme_green','#31b86b'),
('theme_purple','#7b4ce2'),
('theme_bg','#fff9ef'),
('theme_surface','#ffffff'),
('seo_title','קעמפ גן ישראל חדרה'),
('seo_description','גלריות, סרטונים, המנונים ועדכונים מקעמפ גן ישראל חדרה'),
('seo_keywords','קעמפ גן ישראל חדרה, גלריות קעמפ, קעמפ חב״ד'),
('gallery_sort','oldest'),
('show_testimonials','1'),
('show_songs','1'),
('show_countdown','0'),
('allow_testimonial_submission','1'),
('allow_newsletter_signup','1'),
('allow_contact_form','1');
