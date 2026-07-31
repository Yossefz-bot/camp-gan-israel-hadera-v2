-- אזהרה: קובץ זה מוחק את כל הנתונים הקיימים במסד ומתקין את V10 מחדש.
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS admin_audit;
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS analytics_daily;
DROP TABLE IF EXISTS contact_messages;
DROP TABLE IF EXISTS testimonials;
DROP TABLE IF EXISTS subscribers;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS days;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS d1_migrations;
PRAGMA foreign_keys = ON;
-- לאחר הרצת החלק הזה, יש להריץ מיד את 0000_initial.sql.
