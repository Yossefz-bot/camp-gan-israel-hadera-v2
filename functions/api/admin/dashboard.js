import { json, loadSettings } from '../_shared.js';
import { requireAdmin } from './_auth.js';

function readiness(settings, stats) {
  const checks = [
    { key: 'branding', label: 'מיתוג ובאנר ראשי', ok: Boolean(settings.camp_name && (settings.hero_image_key || stats.photos > 0)), hint: 'הוסיפו שם קעמפ ותמונה ראשית.' },
    { key: 'content', label: 'יום אחד לפחות מפורסם', ok: stats.published_days > 0, hint: 'פרסמו יום קעמפ ראשון.' },
    { key: 'media', label: 'תמונות באתר', ok: stats.photos >= 3, hint: 'העלו לפחות 3 תמונות.' },
    { key: 'contact', label: 'פרטי קשר', ok: Boolean(settings.phone || settings.whatsapp || settings.email), hint: 'הגדירו טלפון, וואטסאפ או אימייל.' },
    { key: 'seo', label: 'כותרת ותיאור לחיפוש', ok: Boolean(settings.seo_title && settings.seo_description && settings.seo_description.length >= 30), hint: 'מלאו SEO בכותרת ותיאור.' },
    { key: 'alt', label: 'נגישות תמונות', ok: stats.missing_alt === 0, hint: `חסר טקסט חלופי ב־${stats.missing_alt} תמונות.` }
  ];
  const completed = checks.filter(item => item.ok).length;
  return { score: Math.round(completed / checks.length * 100), completed, total: checks.length, checks };
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!env.DB) return json({ error: 'db_binding_missing' }, 503);
  try {
    const [settings, days, publishedDays, draftDays, photos, videos, songs, mediaBytes, missingAlt, pendingTestimonials, subscribers, newMessages, recentMedia, recentMessages, recentAudit, views] = await Promise.all([
      loadSettings(env),
      env.DB.prepare('SELECT COUNT(*) AS n FROM days').first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM days WHERE status='published'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM days WHERE status='draft'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM media WHERE kind='image'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM media WHERE kind='video'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM media WHERE kind='audio'").first(),
      env.DB.prepare('SELECT COALESCE(SUM(size_bytes),0) AS n FROM media').first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM media WHERE kind='image' AND status='published' AND TRIM(COALESCE(alt_text,''))=''").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM testimonials WHERE status='pending'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE status='active'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE status='new'").first(),
      env.DB.prepare(`SELECT m.id,m.kind,m.title,m.object_key,m.size_bytes,m.created_at,d.title AS day_title
        FROM media m LEFT JOIN days d ON d.id=m.day_id ORDER BY m.id DESC LIMIT 8`).all(),
      env.DB.prepare("SELECT id,name,subject,status,created_at FROM contact_messages ORDER BY id DESC LIMIT 6").all(),
      env.DB.prepare("SELECT id,action,entity_type,entity_id,details,created_at FROM admin_audit ORDER BY id DESC LIMIT 10").all(),
      env.DB.prepare("SELECT COALESCE(SUM(count),0) AS n FROM analytics_daily WHERE event_key='view' AND day>=date('now','-29 day')").first()
    ]);
    const stats = {
      days: Number(days?.n || 0), published_days: Number(publishedDays?.n || 0), draft_days: Number(draftDays?.n || 0),
      photos: Number(photos?.n || 0), videos: Number(videos?.n || 0), songs: Number(songs?.n || 0),
      media_bytes: Number(mediaBytes?.n || 0), missing_alt: Number(missingAlt?.n || 0),
      pending_testimonials: Number(pendingTestimonials?.n || 0), subscribers: Number(subscribers?.n || 0),
      new_messages: Number(newMessages?.n || 0), views_30d: Number(views?.n || 0)
    };
    return json({
      stats,
      readiness: readiness(settings, stats),
      recent_media: recentMedia.results || [],
      recent_messages: recentMessages.results || [],
      recent_activity: recentAudit.results || []
    });
  } catch (error) {
    return json({ error: 'database_not_ready', message: error.message }, 503);
  }
}
