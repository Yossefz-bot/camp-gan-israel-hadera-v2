-- קעמפ גן ישראל חדרה — התקנה חדשה מלאה
-- מיועד למסד D1 חדש וריק. להריץ פעם אחת בלבד.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  label TEXT DEFAULT '',
  date TEXT DEFAULT '',
  description TEXT DEFAULT '',
  cover_key TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  video_aspect TEXT NOT NULL DEFAULT 'landscape',
  is_published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id INTEGER,
  kind TEXT NOT NULL CHECK(kind IN ('image','video','audio')),
  category TEXT NOT NULL DEFAULT 'gallery',
  title TEXT DEFAULT '',
  original_name TEXT DEFAULT '',
  alt_text TEXT DEFAULT '',
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(day_id) REFERENCES days(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  tone TEXT NOT NULL DEFAULT 'info' CHECK(tone IN ('info','success','warning')),
  button_text TEXT DEFAULT '',
  button_url TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','unsubscribed')),
  source TEXT NOT NULL DEFAULT 'אתר הקעמפ',
  consent INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  relation TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 5 CHECK(rating BETWEEN 1 AND 5),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_days_publish_sort ON days(is_published,sort_order,date,id);
CREATE INDEX IF NOT EXISTS idx_media_day_sort ON media(day_id,is_published,sort_order,id);
CREATE INDEX IF NOT EXISTS idx_media_kind_publish_sort ON media(kind,is_published,sort_order,id);
CREATE INDEX IF NOT EXISTS idx_messages_active_id ON messages(is_active,id);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status,id);
CREATE INDEX IF NOT EXISTS idx_subscribers_phone ON subscribers(phone);
CREATE INDEX IF NOT EXISTS idx_testimonials_status_sort ON testimonials(status,sort_order,id);

INSERT OR IGNORE INTO settings(key,value) VALUES
('site_title','קעמפ גן ישראל חדרה'),
('camp_name','קעמפ גן ישראל חדרה'),
('city','חדרה'),
('phone',''),
('whatsapp',''),
('email',''),
('address',''),
('hero_kicker','קיץ של אנרגיה • חברות • שליחות'),
('hero_title','הקיץ מתחיל כאן'),
('hero_text','כל התמונות, הסרטונים, ההמנונים והרגעים הגדולים של קעמפ גן ישראל חדרה'),
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
('footer_text','כל החוויות. במקום אחד.'),
('gallery_title','הגלריות של הקעמפ'),
('gallery_text','כל יום מקבל מקום משלו — סרטון סיכום, תמונות ורגעים ששווה לחזור אליהם.'),
('songs_title','המנוני הקעמפ'),
('songs_text','בחרו שיר, הפעילו מעבר אוטומטי, או השאירו את ההמנון האהוב בלופ.'),
('testimonials_title','מה ההורים מספרים'),
('testimonials_text','תגובות אמיתיות מהמשפחות שחוו את הקעמפ איתנו.'),
('updates_title','לקבלת עדכונים מהקעמפ'),
('updates_text','גלריות חדשות, סרטונים ועדכונים חשובים ישירות אליכם.'),
('contact_title','יצירת קשר'),
('contact_text','לשאלות, הרשמה ופרטים נוספים — נשמח לדבר.'),
('theme_primary','#ff6b16'),
('theme_secondary','#173b67'),
('theme_accent','#ffd234'),
('theme_bg','#fff9ef'),
('theme_surface','#ffffff'),
('seo_title','קעמפ גן ישראל חדרה'),
('seo_description','גלריות, סרטונים והמנונים מקעמפ גן ישראל חדרה'),
('seo_keywords','קעמפ גן ישראל חדרה, גלריות קעמפ'),
('gallery_sort','oldest');
