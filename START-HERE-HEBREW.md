# פריסה נקייה V16 — קעמפ גן ישראל חדרה

## אתר קיים

הגרסה אינה מוחקת או מאפסת מידע ב־D1 או קבצים ב־R2. אין צורך להריץ SQL עבור האתר הקיים.

1. חלץ את קובץ ה־ZIP.
2. העתק את כל הקבצים אל שורש המאגר `camp-gan-israel-hadera-v2` ואשר החלפה.
3. אין להעתיק תיקיית `.git` ממקום אחר ואין למחוק את `.git` הקיימת במאגר.
4. ב־GitHub Desktop צור Commit בשם:
   `Clean full deployment V16`
5. לחץ `Push origin`.
6. המתן שהפריסה ב־Cloudflare תסתיים בהצלחה.
7. פתח את האתר בחלון פרטי או בצע רענון קשיח. אם נשארה גרסה ישנה, מחק את נתוני האתר/Service Worker פעם אחת.

## הגדרות Cloudflare שצריכות להישאר

- Build command: ריק
- Build output directory: `public`
- D1 binding בשם `DB` אל `camp-database`
- R2 binding בשם `MEDIA` אל `camp-media`
- `ADMIN_PASSWORD` — Secret
- `SESSION_SECRET` — Secret, לפחות 32 תווים
- `SESSION_TTL_HOURS` — לדוגמה `12`
- `MAX_UPLOAD_MB` — מומלץ `95`

## אתר חדש וריק בלבד

במסד חדש יש להריץ לפי הסדר:

1. `migrations/0000_initial.sql`
2. `migrations/0003_management_upgrade.sql`

אין להריץ `RESET-AND-INSTALL.sql` באתר קיים עם מידע.

## סרטון סיכום של יום

בניהול: `מדיה והעלאות` → עריכת סרטון המשויך ליום → `הגדרה כסרטון סיכום היום`.
הסרטון יוצג מעל התמונות ולא יופיע שוב בתוך רשת הגלריה.
