import { authorized, denied } from './_auth.js';
import { json, body, clean, integer, booleanInt, slugify } from './_helpers.js';

export async function onRequest({ request, env }) {
  if (!authorized(request, env)) return denied();
  try {
    if (request.method === 'GET') {
      const rows = await env.DB.prepare(`
        SELECT d.*,
          (SELECT COUNT(*) FROM media m WHERE m.day_id=d.id) AS media_count,
          (SELECT object_key FROM media m WHERE m.day_id=d.id AND m.kind='image' ORDER BY m.sort_order,m.id LIMIT 1) AS fallback_cover_key
        FROM days d ORDER BY d.sort_order ASC, COALESCE(d.date,'') DESC, d.id DESC
      `).all();
      return json({ days: rows.results || [] });
    }

    if (request.method === 'POST') {
      const b = await body(request), title = clean(b.title, 180), slug = slugify(b.slug);
      if (!title || !slug) return json({ error:'חסרים שם יום או כתובת באנגלית' }, 400);
      const result = await env.DB.prepare(`INSERT INTO days(slug,title,label,date,description,video_url,video_aspect,is_published,sort_order,updated_at) VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`)
        .bind(slug,title,clean(b.label,120),clean(b.date,20)||null,clean(b.description,2000),clean(b.video_url,1000),clean(b.video_aspect,20)||'landscape',1,integer(b.sort_order)).run();
      return json({ ok:true, id:result.meta.last_row_id });
    }

    if (request.method === 'PATCH') {
      const b = await body(request);
      if (b.action === 'reorder' && Array.isArray(b.ids)) {
        const statements = b.ids.slice(0,500).map((id,index) => env.DB.prepare('UPDATE days SET sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(index, integer(id)));
        if (statements.length) await env.DB.batch(statements);
        return json({ ok:true });
      }
      const id = integer(b.id); if (!id) return json({ error:'חסר מזהה יום' },400);
      const current = await env.DB.prepare('SELECT * FROM days WHERE id=?').bind(id).first();
      if (!current) return json({ error:'היום לא נמצא' },404);
      const title = b.title === undefined ? current.title : clean(b.title,180);
      const slug = b.slug === undefined ? current.slug : slugify(b.slug);
      if (!title || !slug) return json({ error:'שם וכתובת באנגלית הם שדות חובה' },400);
      await env.DB.prepare(`UPDATE days SET slug=?,title=?,label=?,date=?,description=?,video_url=?,video_aspect=?,cover_key=?,is_published=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(slug,title,b.label===undefined?current.label:clean(b.label,120),b.date===undefined?current.date:(clean(b.date,20)||null),b.description===undefined?current.description:clean(b.description,2000),b.video_url===undefined?current.video_url:clean(b.video_url,1000),b.video_aspect===undefined?current.video_aspect:clean(b.video_aspect,20),b.cover_key===undefined?current.cover_key:(clean(b.cover_key,800)||null),b.is_published===undefined?current.is_published:booleanInt(b.is_published),b.sort_order===undefined?current.sort_order:integer(b.sort_order),id).run();
      return json({ ok:true });
    }

    if (request.method === 'DELETE') {
      const b = await body(request), id = integer(b.id); if (!id) return json({ error:'חסר מזהה יום' },400);
      if (b.delete_media) {
        const rows = await env.DB.prepare('SELECT object_key FROM media WHERE day_id=?').bind(id).all();
        const keys = (rows.results||[]).map(r=>r.object_key).filter(Boolean);
        for (let i=0;i<keys.length;i+=1000) await env.MEDIA.delete(keys.slice(i,i+1000));
        await env.DB.prepare('DELETE FROM media WHERE day_id=?').bind(id).run();
      }
      await env.DB.prepare('DELETE FROM days WHERE id=?').bind(id).run();
      return json({ ok:true });
    }
    return json({ error:'Method not allowed' },405);
  } catch (error) {
    const duplicate = String(error.message||'').includes('UNIQUE');
    return json({ error:duplicate?'הכתובת באנגלית כבר קיימת. בחר כתובת אחרת.':error.message }, duplicate?409:500);
  }
}
