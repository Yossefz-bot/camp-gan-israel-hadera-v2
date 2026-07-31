-- קעמפ גן ישראל חדרה — שדרוג V6
-- להריץ פעם אחת בלבד אחרי 0002_upgrade_admin.sql
PRAGMA foreign_keys = ON;

ALTER TABLE subscribers ADD COLUMN phone TEXT DEFAULT '';
ALTER TABLE subscribers ADD COLUMN source TEXT DEFAULT 'אתר הקעמפ';
ALTER TABLE subscribers ADD COLUMN consent INTEGER NOT NULL DEFAULT 1;

ALTER TABLE testimonials ADD COLUMN relation TEXT DEFAULT '';

ALTER TABLE messages ADD COLUMN tone TEXT DEFAULT 'info';
ALTER TABLE messages ADD COLUMN button_text TEXT DEFAULT '';
ALTER TABLE messages ADD COLUMN button_url TEXT DEFAULT '';

INSERT OR IGNORE INTO settings(key,value) VALUES
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
('theme_bg','#f5f8ff'),
('theme_surface','#ffffff');

CREATE INDEX IF NOT EXISTS idx_subscribers_phone ON subscribers(phone);
CREATE INDEX IF NOT EXISTS idx_messages_active_id ON messages(is_active,id);
