export async function onRequestGet({ env }) {
  try {
    const settingsRows = await env.DB.prepare('SELECT key,value FROM settings').all();
    const settings = Object.fromEntries((settingsRows.results || []).map(r => [r.key, r.value]));
    const days = await env.DB.prepare(`
      SELECT d.*,
        (SELECT COUNT(*) FROM media m WHERE m.day_id=d.id AND m.is_published=1) AS media_count,
        (SELECT COUNT(*) FROM media m WHERE m.day_id=d.id AND m.kind='image' AND m.is_published=1) AS photo_count,
        (SELECT object_key FROM media m WHERE m.day_id=d.id AND m.kind='image' AND m.is_published=1 ORDER BY m.sort_order,m.id LIMIT 1) AS fallback_cover_key
      FROM days d WHERE d.is_published=1
      ORDER BY d.sort_order ASC, COALESCE(d.date,'') DESC, d.id DESC
    `).all();
    const message = await env.DB.prepare('SELECT * FROM messages WHERE is_active=1 ORDER BY id DESC LIMIT 1').first();
    const songs = await env.DB.prepare("SELECT * FROM media WHERE kind='audio' AND is_published=1 ORDER BY sort_order,id").all();
    const testimonials = await env.DB.prepare("SELECT id,name,relation,rating,message FROM testimonials WHERE status='approved' ORDER BY sort_order,id DESC LIMIT 24").all();
    const totals = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM days WHERE is_published=1) AS days,
      (SELECT COUNT(*) FROM media WHERE kind='image' AND is_published=1) AS photos,
      (SELECT COUNT(*) FROM media WHERE kind='audio' AND is_published=1) AS songs`).first();
    return Response.json({ settings, days:days.results||[], message, songs:songs.results||[], testimonials:testimonials.results||[], totals:totals||{} }, { headers:{'cache-control':'public,max-age=60'} });
  } catch (error) { return Response.json({ error:error.message }, { status:500 }); }
}
