שדרוג סטטיסטיקות V22 — קעמפ גן ישראל חדרה

מה נוסף
========
1. כל דפדפן שנכנס לניהול מסומן אוטומטית כמכשיר ניהול ולא נספר.
2. השרת מתעלם גם מדיווחים שמגיעים בזמן שחיבור המנהל פעיל.
3. רענון חוזר באותו עמוד בתוך 30 דקות אינו מוסיף צפייה חדשה.
4. זמן צפייה נספר רק כשהעמוד גלוי; לשונית ברקע או מסך נעול אינם נספרים.
5. בניהול מוצגים זמן כולל, ממוצע לצפייה וזמן לכל עמוד.

קבצים להחלפה
=============
functions/api/track.js
functions/api/admin/analytics.js
public/assets/js/app.js
public/assets/js/day.js
public/assets/js/admin.js
public/assets/css/admin.css
public/index.html
public/day.html
public/admin/index.html

אין צורך ב-Migration — נעשה שימוש בטבלה analytics_daily הקיימת.

חשוב לגבי הנתונים הישנים
========================
הנתונים הישנים נשמרו בצורה מצטברת ולכן אי אפשר להסיר רק את הצפיות הישנות שלך.
כדי להתחיל מאפס, הרץ פעם אחת ב-D1 את optional/RESET-ANALYTICS.sql.
הפעולה אופציונלית ומוחקת את כל הסטטיסטיקה הישנה.

כדי להחריג מכשיר נוסף, התחבר ממנו פעם אחת למערכת הניהול.

Summary ל-GitHub
================
Add accurate views and per-page watch time V22
