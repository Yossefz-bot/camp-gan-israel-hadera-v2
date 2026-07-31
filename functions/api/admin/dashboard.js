import { authorized, denied } from './_auth.js';
import { json } from './_helpers.js';
export async function onRequestGet({ request, env }) {
  if (!authorized(request, env)) return denied();
  try {
    const [days, images, videos, songs, pending, subscribers] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS n FROM days').first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM media WHERE kind='image'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM media WHERE kind='video'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM media WHERE kind='audio'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM testimonials WHERE status='pending'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE status='active'").first()
    ]);
    return json({ stats: { days:days?.n||0, images:images?.n||0, videos:videos?.n||0, songs:songs?.n||0, pending_testimonials:pending?.n||0, subscribers:subscribers?.n||0 } });
  } catch (error) { return json({ error:error.message }, 500); }
}
