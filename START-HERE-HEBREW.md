# מתחילים כאן — קעמפ גן ישראל חדרה V12

המערכת בנויה ל־Cloudflare Pages + Pages Functions + D1 + R2, ולשליחת מיילים דרך Resend.

## 1. העלאת הקבצים ל־GitHub

1. חלץ את קובץ ה־ZIP.
2. ב־GitHub Desktop לחץ **Show in Explorer**.
3. העתק את כל תוכן החבילה לתיקיית המאגר ואשר החלפת קבצים.
4. ודא שאין במאגר קובץ פעיל בשם `wrangler.jsonc` או `wrangler.toml` אם החיבורים מנוהלים דרך Cloudflare Dashboard.
5. בצע Commit בשם `Install Camp V12` ואז **Push origin**.

## 2. הגדרות Cloudflare Pages

- Framework preset: `None`
- Build command: ריק
- Build output directory: `public`
- Root directory: `/`

## 3. חיבורי D1 ו־R2

ב־**Settings → Bindings**:

- D1 database: שם משתנה `DB`, מסד `camp-database`
- R2 bucket: שם משתנה `MEDIA`, דלי `camp-media`

## 4. משתנים וסודות

ב־**Settings → Variables and secrets**:

### קיימים וחובה
- `ADMIN_PASSWORD` — Secret
- `SESSION_SECRET` — Secret, לפחות 32 תווים
- `SESSION_TTL_HOURS` — Plaintext, ערך `12`
- `MAX_UPLOAD_MB` — Plaintext, ערך `95`

### חדשים עבור מיילים
- `RESEND_API_KEY` — Secret, מפתח API של Resend
- `EMAIL_FROM` — Plaintext, למשל `קעמפ גן ישראל חדרה <updates@updates.your-domain.co.il>`
- `EMAIL_REPLY_TO` — Plaintext, כתובת שאליה יגיעו תשובות ההורים; מומלץ
- `PUBLIC_SITE_URL` — Plaintext, כתובת האתר המלאה ללא `/` בסוף; מומלץ

יש לאמת ב־Resend את הדומיין או תת־הדומיין שמופיע ב־`EMAIL_FROM`.

## 5. עדכון מסד הנתונים

### אתר שכבר פועל על V10/V11
הרץ פעם אחת בלבד ב־D1 Console את:

`migrations/0002_communications_and_slides.sql`

הקובץ מוסיף את טבלאות המיילים, הניוזלטרים והמצגת ואינו מוחק מידע קיים.

### מסד חדש וריק
הרץ את `migrations/0000_initial.sql` בלבד.

### חשוב
אל תריץ `RESET-AND-INSTALL.sql` כשיש מידע שחשוב לשמור.

## 6. פריסה מחדש

לאחר הוספת המשתנים והרצת ה־SQL, בצע **Retry deployment** או Push חדש. לאחר Success רענן את הניהול עם `Ctrl + F5`.

## 7. איפה מנהלים כל יכולת

- **פניות מהאתר** → פתיחת פנייה → **השב במייל**
- **ניוזלטר** → יצירת הודעה → שליחת בדיקה → שליחה לרשימה
- **תוכן ועיצוב → באנר ראשי** → בחירת `מצגת מתחלפת` והוספת תמונות/סרטונים
- **תוכן ועיצוב → תוכן העמוד** → בחירת סרטון סיכום באזור „הסיפור שלנו”
- **תוכן ועיצוב → נגן ההמנונים** → בחירת תמונה למרכז התקליט

## 8. בדיקת פרסום מומלצת

1. שלח פנייה עם כתובת מייל שלך והשב לה מהניהול.
2. שלח ניוזלטר בדיקה לכתובת שלך.
3. הוסף שתי תמונות וסרטון למצגת ובדוק מעבר ביניהם.
4. הגדר סרטון סיכום ובדוק ניגון במחשב ובטלפון.
5. בחר תמונה מרובעת למרכז התקליט.
6. בדוק שהקישור להסרה מרשימת התפוצה עובד.

כתובת הניהול:

`https://camp-gan-israel-hadera-v2.pages.dev/admin/`
