import { json } from '../_shared.js';
import { requireAdmin } from './_auth.js';

export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  if (!env.DB) return json({ error: 'db_binding_missing' }, 503);
  try {
    const [days, photos, videos, songs, pendingTestimonials, subscribers, newMessages, recentMedia, recentMessages, views] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS n FROM days').first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM media WHERE kind='image'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM media WHERE kind='video'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM media WHERE kind='audio'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM testimonials WHERE status='pending'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE status='active'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE status='new'").first(),
      env.DB.prepare(`SELECT m.id,m.kind,m.title,m.object_key,m.created_at,d.title AS day_title
        FROM media m LEFT JOIN days d ON d.id=m.day_id ORDER BY m.id DESC LIMIT 8`).all(),
      env.DB.prepare("SELECT id,name,subject,status,created_at FROM contact_messages ORDER BY id DESC LIMIT 6").all(),
      env.DB.prepare("SELECT COALESCE(SUM(count),0) AS n FROM analytics_daily WHERE event_key='view' AND day>=date('now','-29 day')").first()
    ]);
    return json({
      stats: {
        days: Number(days?.n || 0), photos: Number(photos?.n || 0), videos: Number(videos?.n || 0), songs: Number(songs?.n || 0),
        pending_testimonials: Number(pendingTestimonials?.n || 0), subscribers: Number(subscribers?.n || 0),
        new_messages: Number(newMessages?.n || 0), views_30d: Number(views?.n || 0)
      },
      recent_media: recentMedia.results || [],
      recent_messages: recentMessages.results || []
    });
  } catch (error) {
    return json({ error: 'database_not_ready', message: error.message }, 503);
  }
}
