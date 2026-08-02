תיקון V13.1 לגלריה ולמטמון

1. העתיקו את תיקיית public לתיקיית המאגר ואשרו החלפה.
2. Commit: Fix gallery script and service worker cache
3. Push origin והמתינו לפריסה ירוקה.
4. בדפדפן: F12 > Application > Service Workers > Unregister, ואז Storage > Clear site data.
5. פתחו מחדש את הגלריה.

התיקון כולל:
- בדיקות null לפני חיבור onclick.
- גרסת day.js חדשה v13.1.0.
- החלפת שם מטמון Service Worker כדי למחוק גרסאות ישנות.
