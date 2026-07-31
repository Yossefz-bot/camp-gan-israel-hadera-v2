# מתחילים כאן — קעמפ גן ישראל חדרה V10 Pro

הגרסה הזו בנויה במיוחד ל־Cloudflare Pages + Pages Functions + D1 + R2.

## חשוב לפני ההעתקה

במאגר GitHub הישן קיים כנראה קובץ `wrangler.jsonc`. מחק אותו. בגרסה הזו אין קובץ Wrangler פעיל, כדי שאפשר יהיה להוסיף את החיבורים דרך הממשק של Cloudflare בלי שהכפתור יהיה מושבת.

## 1. העלאת הקבצים ל־GitHub

1. חלץ את קובץ ה־ZIP.
2. ב־GitHub Desktop לחץ **Show in Explorer**.
3. מחק את כל הקבצים הישנים שבתיקיית המאגר.
4. העתק לתיקיית המאגר את **כל מה שנמצא בתוך** התיקייה `camp-gan-israel-hadera-v10-pro`.
5. ודא שאין במאגר קובץ בשם `wrangler.jsonc` או `wrangler.toml`.
6. ב־GitHub Desktop בצע Commit בשם:
   `Install Camp V10 Pro`
7. לחץ **Push origin**.

## 2. הגדרות הפרויקט ב־Cloudflare Pages

- Framework preset: `None`
- Build command: להשאיר ריק
- Build output directory: `public`
- Root directory: `/`

## 3. חיבור D1 ו־R2

בפרויקט Pages פתח **Settings → Bindings**.

הוסף:

- D1 database
  - Variable name: `DB`
  - Database: `camp-database`

- R2 bucket
  - Variable name: `MEDIA`
  - Bucket: `camp-media`

## 4. הגדרת סודות מנהל

ב־**Settings → Variables and secrets** הוסף כ־Secret:

- `ADMIN_PASSWORD` — סיסמת ניהול חזקה באורך 8 תווים לפחות.
- `SESSION_SECRET` — רצף אקראי ארוך של 32 תווים לפחות.

אפשר להוסיף כמשתנים רגילים:

- `SESSION_TTL_HOURS` = `12`
- `MAX_UPLOAD_MB` = `95`

## 5. התקנת מסד הנתונים

פתח את D1 `camp-database` והיכנס ל־Console.

- אם המסד חדש או ריק: הרץ את `migrations/0000_initial.sql`.
- אם כבר הותקנה עליו גרסת V9 ויש נתונים שחשוב לשמור: הרץ במקום זאת את `migrations/0001_upgrade_from_v9.sql`.
- אם יש מסד ישן שאין בו חומר חשוב ורוצים להתחיל נקי: הרץ את `migrations/RESET-AND-INSTALL.sql`, ואז מיד את `migrations/0000_initial.sql`.

אין להריץ את קובץ האיפוס כאשר יש מידע שחשוב לשמור.

## 6. פריסה מחדש

אחרי הוספת Bindings, Secrets והתקנת המסד, בצע **Retry deployment** או Push נוסף ל־GitHub.

## 7. כניסה למערכת

כתובת הניהול:

`https://camp-gan-israel-hadera-v2.pages.dev/admin/`

הזן את הערך שהגדרת ב־`ADMIN_PASSWORD`.

בתפריט **מצב המערכת** אמורים להופיע שלושה סימונים ירוקים:

- D1
- R2
- סודות מנהל

## מה כלול

- אתר ציבורי מתקדם ומותאם לטלפון.
- גלריות לפי ימים עם טעינה מדורגת.
- Lightbox, מועדפים, בחירת תמונות והורדה.
- סרטון יומי והטמעת YouTube/Vimeo.
- נגן המנונים מלא.
- תגובות הורים עם אישור מנהל.
- הרשמה לעדכונים ופניות מהאתר.
- מערכת ניהול מאובטחת עם Cookie חתום ו־CSRF.
- העלאה ל־R2 עם התקדמות לכל קובץ.
- ניהול ימים, מדיה, תוכן, צבעים, SEO והודעות.
- סטטיסטיקות צפייה וייצוא CSV.
- PWA, מצב כהה, SEO, נגישות וכותרות אבטחה.

## קובץ Wrangler אופציונלי

הקובץ `wrangler.example.jsonc` הוא דוגמה בלבד ואינו מופעל. אין לשנות את שמו ל־`wrangler.jsonc` אלא אם עובדים דרך Wrangler ומכניסים את מזהה ה־D1 האמיתי.
