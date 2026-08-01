# Camp Gan Israel Hadera — V12

מערכת מלאה לאתר קעמפ ולניהול תוכן על Cloudflare Pages.

## תשתית

- Cloudflare Pages + Pages Functions
- Cloudflare D1 בשם החיבור `DB`
- Cloudflare R2 בשם החיבור `MEDIA`
- Resend לשליחת תשובות לפניות וניוזלטרים
- HTML, CSS ו־JavaScript ללא שלב Build
- התחברות מנהל עם Cookie חתום, HttpOnly ו־CSRF

## חידושי V12

- תשובה לפנייה מתוך הניהול ושליחה ישירה למייל הפונה.
- יצירה, בדיקה ושליחת ניוזלטר לרשימת התפוצה.
- קישור הסרה אישי בכל ניוזלטר ומעקב אחר הצלחה/כישלון.
- מצגת מתחלפת בבאנר הראשי, עם תמונות וסרטונים.
- סרטון סיכום באזור „הסיפור שלנו”.
- תמונה מותאמת במרכז התקליט בנגן ההמנונים.
- כל יכולות V11.1: ניהול מדיה, טיוטה/פרסום מרוכז, ייבוא Excel ועוד.

## בדיקות מקומיות

```bash
npm install
npm run check
```

## פיתוח מקומי

העתק `.dev.vars.example` אל `.dev.vars`, הגדר D1 ו־R2 לפי `wrangler.example.jsonc`, ואז הפעל:

```bash
npx wrangler pages dev public --d1 DB=<DATABASE_ID> --r2 MEDIA=camp-media
```

הוראות התקנה מלאות נמצאות ב־`START-HERE-HEBREW.md`.
