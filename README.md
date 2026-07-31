<<<<<<< HEAD
# Camp Gan Israel Hadera — V10 Pro

A full-stack Cloudflare Pages application for a camp website and content-management dashboard.

## Stack

- Cloudflare Pages
- Pages Functions
- Cloudflare D1 (`DB` binding)
- Cloudflare R2 (`MEDIA` binding)
- Vanilla HTML, CSS and JavaScript; no frontend build step
- Signed HttpOnly admin sessions using Web Crypto

## Local checks

```bash
npm install
npm run check
```

## Local development

Copy `.dev.vars.example` to `.dev.vars`, configure the bindings using `wrangler.example.jsonc`, then run:

```bash
npx wrangler pages dev public --d1 DB=<DATABASE_ID> --r2 MEDIA=camp-media
```

See `START-HERE-HEBREW.md` for the dashboard-first deployment workflow.
=======
# קעמפ גן ישראל חדרה V8

גרסה חדשה עם שפה עיצובית שמתאימה לקעמפ: צבעונית, אנרגטית, צעירה ומותאמת למובייל.

## כולל
- דף בית מלא
- גלריות לפי ימים
- סרטוני סיכום
- נגן המנונים
- תגובות הורים
- הרשמה לעדכונים
- מערכת ניהול
- Cloudflare Pages Functions
- הכנה ל-D1 ול-R2

ראו `START-HERE-HEBREW.txt` להוראות העלאה.
>>>>>>> parent of 1f05b72 (Initial complete camp system V9)
