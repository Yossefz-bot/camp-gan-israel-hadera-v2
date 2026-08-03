# Camp Gan Israel Hadera — V12.1

מערכת מלאה לאתר קעמפ ולניהול תוכן על Cloudflare Pages.

## תשתית

- Cloudflare Pages + Pages Functions
- Cloudflare D1 בשם החיבור `DB`
- Cloudflare R2 בשם החיבור `MEDIA`
- HTML, CSS ו־JavaScript ללא שלב Build
- התחברות מנהל עם Cookie חתום, HttpOnly ו־CSRF
- מענה ותפוצה דרך WhatsApp ללא שירות מייל או API חיצוני

## חידושי V12.1

- תשובה לפניות באמצעות צ׳אט WhatsApp עם הודעה מוכנה.
- כלי תפוצה ידני: הודעה, קישור, העתקת מספרים, CSV ותור נמען־נמען.
- מחיקה מרוכזת של כמה קובצי מדיה בבת אחת.
- ניקוי אוטומטי של הפניות לקבצים שנמחקו מתמונות שער, מצגת והגדרות.
- מספר טלפון חובה בטופס הפנייה.
- כל יכולות V12: מצגת בדף הבית, סרטון סיכום, תמונה במרכז התקליט ועוד.

## בדיקות מקומיות

```bash
npm install
npm run check
```

הוראות התקנה מלאות נמצאות ב־`START-HERE-HEBREW.md`.
