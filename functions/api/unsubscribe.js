import { clean } from './_shared.js';
import { verifyUnsubscribeToken } from './_email.js';

function page(title, message, success = true) {
  return new Response(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#fff8ee;font-family:Arial,sans-serif;color:#173b67;display:grid;place-items:center;min-height:100vh"><main style="width:min(520px,calc(100% - 32px));background:#fff;border:1px solid #f0e1cf;border-radius:24px;padding:36px;text-align:center;box-shadow:0 18px 45px rgba(23,59,103,.1)"><div style="font-size:54px">${success?'✅':'⚠️'}</div><h1>${title}</h1><p style="line-height:1.7;color:#5f7187">${message}</p><a href="/" style="display:inline-block;margin-top:14px;background:#ff6b16;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:700">חזרה לאתר</a></main></body></html>`,{status:success?200:400,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

async function handleUnsubscribe({ request, env }) {
  if (!env.DB) return page('לא ניתן להשלים את הפעולה','המערכת אינה מחוברת כרגע למסד הנתונים.',false);
  try {
    const url = new URL(request.url), id = Number(url.searchParams.get('id')), token = clean(url.searchParams.get('token'),200);
    if (!Number.isInteger(id) || id < 1 || !token) return page('קישור לא תקין','קישור ההסרה חסר או אינו תקין.',false);
    const subscriber = await env.DB.prepare('SELECT id,email,status FROM subscribers WHERE id=?').bind(id).first();
    if (!subscriber || !(await verifyUnsubscribeToken(env,subscriber,token))) return page('קישור לא תקין','לא הצלחנו לאמת את קישור ההסרה.',false);
    if (subscriber.status !== 'unsubscribed') await env.DB.prepare("UPDATE subscribers SET status='unsubscribed',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
    return page('הוסרת מרשימת התפוצה','לא יישלחו אליך ניוזלטרים נוספים. ניתן להירשם מחדש בכל עת דרך האתר.');
  } catch (error) {
    return page('לא ניתן להשלים את הפעולה','אירעה תקלה זמנית. נסו שוב מאוחר יותר.',false);
  }
}

export const onRequestGet = handleUnsubscribe;
export const onRequestPost = handleUnsubscribe;
