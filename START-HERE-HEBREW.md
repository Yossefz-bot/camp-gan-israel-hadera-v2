# מתחילים כאן — קעמפ גן ישראל חדרה V12.1

המערכת בנויה ל־Cloudflare Pages + Pages Functions + D1 + R2. המענה לפניות והתפוצה פועלים דרך קישורי WhatsApp, ללא Resend וללא API חיצוני.

## 1. העלאת הקבצים ל־GitHub

1. חלץ את קובץ ה־ZIP.
2. ב־GitHub Desktop לחץ **Show in Explorer**.
3. העתק את כל תוכן החבילה לתיקיית המאגר ואשר החלפת קבצים.
4. ודא שאין במאגר קובץ פעיל בשם `wrangler.jsonc` או `wrangler.toml` אם החיבורים מנוהלים דרך Cloudflare Dashboard.
5. בצע Commit בשם `Install Camp V12.1` ואז **Push origin**.

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

- `ADMIN_PASSWORD` — Secret
- `SESSION_SECRET` — Secret, לפחות 32 תווים
- `SESSION_TTL_HOURS` — Plaintext, ערך `12`
- `MAX_UPLOAD_MB` — Plaintext, ערך `95`

אין צורך ב־Resend או ב־WhatsApp API.

## 5. מסד הנתונים

### אתר שכבר פועל על V12
לא צריך להריץ SQL נוסף עבור V12.1.

### אתר חדש וריק
הרץ את `migrations/0000_initial.sql` בלבד.

### אתר ישן לפני V12
הרץ לפי הוראות השדרוג הקודמות את `migrations/0002_communications_and_slides.sql` פעם אחת בלבד.

אל תריץ `RESET-AND-INSTALL.sql` כשיש מידע שחשוב לשמור.

## 6. שימוש יומיומי

- **פניות מהאתר** → פתיחת פנייה → **השב ב־WhatsApp**.
- **תפוצת WhatsApp** → כתיבת הודעה → פתיחת תור שליחה, העתקת מספרים או הורדת CSV.
- **מדיה והעלאות** → סימון כמה קבצים → פרסום, טיוטה, ארכיון או **מחיקת הנבחרים**.
- **תוכן ועיצוב → באנר ראשי** → תמונה, סרטון או מצגת מתחלפת.
- **תוכן ועיצוב → תוכן העמוד** → סרטון סיכום באזור „הסיפור שלנו”.
- **תוכן ועיצוב → נגן ההמנונים** → תמונה במרכז התקליט.

## 7. חשוב לגבי WhatsApp

המערכת מכינה את ההודעה ופותחת את הצ׳אט המתאים. היא לא לוחצת על כפתור השליחה במקומך ולא שולחת אוטומטית למאות אנשים. הדבר מונע צורך ב־WhatsApp Business API ושומר על תהליך פשוט וברור.

כתובת הניהול:

`https://camp-gan-israel-hadera-v2.pages.dev/admin/`
