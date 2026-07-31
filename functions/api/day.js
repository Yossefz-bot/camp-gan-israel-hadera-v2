export async function onRequestGet({ request, env }) {
  const url = new URL(request.url), slug = url.searchParams.get('slug');
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  const limit = Math.min(180, Math.max(24, Number(url.searchParams.get('limit')) || 80));
  if (!slug) return Response.json({ error:'missing slug' }, { status:400 });
  try {
    const day = await env.DB.prepare('SELECT * FROM days WHERE slug=? AND is_published=1').bind(slug).first();
    if (!day) return Response.json({ error:'not found' }, { status:404 });
    const sort = (await env.DB.prepare("SELECT value FROM settings WHERE key='gallery_sort'").first())?.value === 'newest' ? 'DESC' : 'ASC';
    const totalRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM media WHERE day_id=? AND is_published=1').bind(day.id).first();
    const media = await env.DB.prepare(`SELECT * FROM media WHERE day_id=? AND is_published=1 ORDER BY sort_order ${sort},id ${sort} LIMIT ? OFFSET ?`).bind(day.id,limit,offset).all();
    const total = Number(totalRow?.n)||0;
    return Response.json({ day, media:media.results||[], total, offset, next_offset:offset+(media.results||[]).length<total?offset+(media.results||[]).length:null }, { headers:{'cache-control':'public,max-age=60'} });
  } catch (error) { return Response.json({ error:error.message }, { status:500 }); }
}
