import { clean, integer, json, loadSettings, mediaUrl } from './_shared.js';

function decorate(item) {
  return { ...item, url: mediaUrl(item.object_key), download_url: mediaUrl(item.object_key, true) };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'setup_required' }, 503);
  const url = new URL(request.url);
  const slug = clean(url.searchParams.get('slug'), 160);
  const offset = Math.max(0, integer(url.searchParams.get('offset'), 0));
  const limit = Math.min(120, Math.max(12, integer(url.searchParams.get('limit'), 48)));
  const kind = clean(url.searchParams.get('kind'), 20);
  if (!slug) return json({ error: 'missing_slug' }, 400);

  try {
    const day = await env.DB.prepare("SELECT * FROM days WHERE slug=? AND status='published'").bind(slug).first();
    if (!day) return json({ error: 'not_found' }, 404);
    const settings = await loadSettings(env);
    const sortDirection = settings.gallery_sort === 'newest' ? 'DESC' : 'ASC';
    const filters = ["day_id=?", "status='published'"];
    const bindings = [day.id];
    if (['image', 'video', 'audio', 'document'].includes(kind)) {
      filters.push('kind=?');
      bindings.push(kind);
    }
    const where = filters.join(' AND ');
    const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM media WHERE ${where}`).bind(...bindings).first();
    const media = await env.DB.prepare(`SELECT * FROM media WHERE ${where} ORDER BY is_featured DESC,sort_order ${sortDirection},id ${sortDirection} LIMIT ? OFFSET ?`)
      .bind(...bindings, limit, offset).all();
    const totalCount = Number(total?.n || 0);
    const items = (media.results || []).map(decorate);
    const coverKey = day.cover_key || items.find(item => item.kind === 'image')?.object_key || '';
    return json({
      day: {
        ...day,
        cover_key: coverKey,
        cover_url: mediaUrl(coverKey),
        video_src: day.video_key ? mediaUrl(day.video_key) : day.video_url || ''
      },
      media: items,
      total: totalCount,
      offset,
      next_offset: offset + items.length < totalCount ? offset + items.length : null
    }, 200, { 'cache-control': 'public,max-age=60,stale-while-revalidate=300' });
  } catch (error) {
    console.error('day api', error);
    return json({ error: 'database_error', message: error.message }, 500);
  }
}
