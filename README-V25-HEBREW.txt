V25 — שו״ת + נעים להכיר + הנפשות
קעמפ גן ישראל חדרה

מה נוסף
========
1. עמוד חדש /faq.html — שאלות ותשובות באקורדיון עם אנימציה.
2. אזור חדש בניהול: "שאלות ותשובות".
   - כפתור + הוספת שאלה
   - עריכת שאלה ותשובה
   - הצגה / הסתרה
   - סדר הופעה
   - הזזה למעלה / למטה
   - מחיקה
3. API ציבורי: /api/faq
4. API ניהול: /api/admin/faq
5. עמוד חדש /team.html — "נעים להכיר" עם הסבר על תפקידי הצוות.
6. שדרוג הנפשות: כניסה מלמטה / צדדים / Scale, תנועה עדינה ו-Prefers Reduced Motion.
7. קישורי "נעים להכיר" ו-"שו״ת" נוספו לתפריט הראשי והמובייל.
8. התאמה מלאה למובייל ולמצב כהה.

מסד נתונים
===========
ה-API יוצר אוטומטית את טבלת faq_items בפעם הראשונה, כך שאין חובה להריץ SQL ידנית.
מצורף גם migrations/0006_faq.sql כדי לשמור את סכמת הפרויקט מסודרת.

איך להעלות
==========
מעלים את תוכן החבילה לתוך הריפו הקיים ושומרים את מבנה התיקיות.
לא למחוק קבצים אחרים שקיימים בריפו ואינם מופיעים בחבילה — זו חבילת שדרוג על גבי V24 הקיים.
לאחר הפריסה:
1. לפתוח /admin
2. לבחור "שאלות ותשובות"
3. ללחוץ "+ הוספת שאלה"
4. להוסיף שאלה ותשובה ולשמור
5. לפתוח /faq.html ולבדוק שהשאלה מופיעה

קבצים מרכזיים
=============
public/index.html
public/faq.html
public/team.html
public/admin/index.html
public/assets/css/main.css
public/assets/css/admin.css
public/assets/js/info-pages.js
public/assets/js/admin.js
functions/api/faq.js
functions/api/admin/faq.js
migrations/0006_faq.sql

GitHub Summary
==============
Add FAQ manager, team page and animated UI V25
