-- V14 management upgrade: per-song artwork and editable site text
PRAGMA foreign_keys = ON;
ALTER TABLE media ADD COLUMN artwork_key TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS text_overrides (
  selector TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO settings(key,value) VALUES
('floating_registration_enabled','1'),
('floating_registration_text','הרשמה לקעמפ');
