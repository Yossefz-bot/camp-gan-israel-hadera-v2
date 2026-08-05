שדרוג סטטיסטיקות V23 — כולל חיבורים פעילים

מה נוסף
- חיבורים פעילים כרגע, מתעדכן כל 20 שניות.
- פירוט באילו עמודים נמצאים המבקרים הפעילים.
- חיבור פעיל הוא דפדפן ייחודי; כמה לשוניות באותו דפדפן אינן נספרות בנפרד.
- חיבור נחשב פעיל כאשר התקבל heartbeat ב-90 השניות האחרונות.
- כניסות של המנהל אינן נספרות, גם בצד הדפדפן וגם בצד השרת.
- צפייה כפולה באותו עמוד בתוך 30 דקות אינה מוסיפה צפייה.
- זמן צפייה נספר רק כשהעמוד גלוי.
- אין איסוף של כתובת IP או שם; החיבור מזוהה באמצעות מזהה אקראי מקומי בלבד.

הקבצים להחלפה
functions/api/track.js
functions/api/admin/analytics.js
public/assets/js/app.js
public/assets/js/day.js
public/assets/js/admin.js
public/assets/css/admin.css
public/index.html
public/day.html
public/admin/index.html

יצירת טבלת החיבורים
הקוד יוצר את הטבלה אוטומטית. מצורף גם migrations/0004_analytics_v23.sql להרצה ידנית במקרה הצורך.

כדי להחריג מכשיר שלך
היכנס ממנו פעם אחת למערכת הניהול. מאותו רגע הדפדפן לא ישלח נתוני סטטיסטיקה.

נתונים ישנים
אי אפשר להסיר רק את הכניסות הישנות שלך כי הן נשמרו כמספר מצטבר. כדי להתחיל מאפס, הרץ את optional/RESET-ANALYTICS.sql ב-D1 Console.

Summary
Add live connections and accurate engagement analytics V23
