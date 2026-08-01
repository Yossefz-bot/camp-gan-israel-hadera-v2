import { json } from '../_shared.js';
import { emailConfigDetail, emailReady } from '../_email.js';
import { requireAdmin, secretsReady } from './_auth.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const result = {
    ok: false,
    admin_secrets: secretsReady(env),
    db_binding: Boolean(env.DB),
    database_ready: false,
    r2_binding: Boolean(env.MEDIA),
    r2_ready: false,
    email_ready: emailReady(env),
    time: new Date().toISOString(),
    checks: []
  };
  if (env.DB) {
    try {
      const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
      const names = (tables.results || []).map(row => row.name);
      const requiredTables = ['settings','days','media','contact_messages','contact_replies','subscribers','newsletter_campaigns','newsletter_deliveries','homepage_slides'];
      const missingTables = requiredTables.filter(name => !names.includes(name));
      result.database_ready = missingTables.length === 0;
      result.checks.push({ name: 'D1', ok: result.database_ready, detail: result.database_ready ? 'מסד הנתונים מוכן ל־V12' : `חסרות טבלאות: ${missingTables.join(', ')}. יש להריץ migrations/0002_communications_and_slides.sql` });
    } catch (error) {
      result.checks.push({ name: 'D1', ok: false, detail: error.message });
    }
  } else result.checks.push({ name: 'D1', ok: false, detail: 'Binding בשם DB לא הוגדר' });

  if (env.MEDIA) {
    try {
      await env.MEDIA.list({ limit: 1 });
      result.r2_ready = true;
      result.checks.push({ name: 'R2', ok: true, detail: 'הדלי מחובר' });
    } catch (error) {
      result.checks.push({ name: 'R2', ok: false, detail: error.message });
    }
  } else result.checks.push({ name: 'R2', ok: false, detail: 'Binding בשם MEDIA לא הוגדר' });

  result.checks.push({ name: 'סודות מנהל', ok: result.admin_secrets, detail: result.admin_secrets ? 'מוגדרים' : 'יש להגדיר ADMIN_PASSWORD ו-SESSION_SECRET' });
  result.checks.push({ name: 'שליחת מיילים', ok: result.email_ready, detail: emailConfigDetail(env) });
  result.ok = result.admin_secrets && result.database_ready && result.r2_ready && result.email_ready;
  return json(result, result.ok ? 200 : 503);
}
