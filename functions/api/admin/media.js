import { audit, booleanInt, clean, integer, json, parseJson, statusValue } from '../_shared.js';
import { requireAdmin } from './_auth.js';

export async function onRequest({ request, env }) {
  const mutating = request.method !== 'GET';
  const auth = await requireAdmin(request, env, { csrf: mutating });
  if (auth.response) return auth.response;
  if (!env.DB) return json({ error: 'db_binding_missing' }, 503);

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const limit = Math.min(200, Math.max(1, integer(url.searchParams.get('limit'), 60)));
      const offset = Math.max(0, integer(url.searchParams.get('offset'), 0));
      const filters = ['1=1'];
      const bindings = [];
      const dayId = integer(url.searchParams.get('day_id'));
      const kind = clean(url.searchParams.get('kind'), 20);
      const status = clean(url.searchParams.get('status'), 20);
      const search = clean(url.searchParams.get('search'), 120);
      if (dayId) { filters.push('m.day_id=?'); bindings.push(dayId); }
      if (['image','video','audio','document'].includes(kind)) { filters.push('m.kind=?'); bindings.push(kind); }
      if (['draft','published','archived'].includes(status)) { filters.push('m.status=?'); bindings.push(status); }
      if (search) { filters.push('(m.title LIKE ? OR m.original_name LIKE ? OR m.alt_text LIKE ?)'); bindings.push(`%${search}%`, `%${search}%`, `%${search}%`); }
      const where = filters.join(' AND ');
      const [rows, count] = await Promise.all([
        env.DB.prepare(`SELECT m.*,d.title AS day_title FROM media m LEFT JOIN days d ON d.id=m.day_id WHERE ${where} ORDER BY m.sort_order ASC,m.id DESC LIMIT ? OFFSET ?`).bind(...bindings,limit,offset).all(),
        env.DB.prepare(`SELECT COUNT(*) AS n FROM media m WHERE ${where}`).bind(...bindings).first()
      ]);
      return json({ media: rows.results || [], total: Number(count?.n || 0), offset, limit });
    }

    const body = await parseJson(request);
    if (request.method === 'PATCH') {
      if (body.action === 'reorder' && Array.isArray(body.ids)) {
        const statements = body.ids.slice(0, 1000).map((id, index) => env.DB.prepare('UPDATE media SET sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(index, integer(id)));
        if (statements.length) await env.DB.batch(statements);
        await audit(env, 'reorder_media', 'media', '', `${statements.length} items`);
        return json({ ok: true });
      }
      if (body.action === 'bulk_status' && Array.isArray(body.ids)) {
        const status = statusValue(body.status, ['draft','published','archived'], 'published');
        const statements = body.ids.slice(0, 1000).map(id => env.DB.prepare('UPDATE media SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, integer(id)));
        if (statements.length) await env.DB.batch(statements);
        await audit(env, 'bulk_media_status', 'media', '', `${status}:${statements.length}`);
        return json({ ok: true });
      }
      if (body.action === 'set_cover') {
        const id = integer(body.id);
        const item = await env.DB.prepare("SELECT id,day_id,object_key FROM media WHERE id=? AND kind='image'").bind(id).first();
        if (!item?.day_id) return json({ error: 'invalid_cover', message: 'אפשר לבחור כתמונת שער רק תמונה המשויכת ליום.' }, 400);
        await env.DB.batch([
          env.DB.prepare('UPDATE media SET is_featured=CASE WHEN id=? THEN 1 ELSE 0 END,updated_at=CURRENT_TIMESTAMP WHERE day_id=? AND kind=\'image\'').bind(id,item.day_id),
          env.DB.prepare('UPDATE days SET cover_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(item.object_key,item.day_id)
        ]);
        await audit(env, 'set_day_cover', 'media', String(id), `day=${item.day_id}`);
        return json({ ok: true });
      }
      const id = integer(body.id);
      const current = await env.DB.prepare('SELECT * FROM media WHERE id=?').bind(id).first();
      if (!current) return json({ error: 'not_found', message: 'הקובץ לא נמצא.' }, 404);
      const dayId = body.day_id === undefined ? current.day_id : (integer(body.day_id) || null);
      await env.DB.prepare(`UPDATE media SET day_id=?,kind=?,category=?,title=?,alt_text=?,caption=?,status=?,is_featured=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(
          dayId,
          body.kind===undefined?current.kind:statusValue(body.kind,['image','video','audio','document'],current.kind),
          body.category===undefined?current.category:clean(body.category,60),
          body.title===undefined?current.title:clean(body.title,240),
          body.alt_text===undefined?current.alt_text:clean(body.alt_text,500),
          body.caption===undefined?current.caption:clean(body.caption,1500),
          body.status===undefined?current.status:statusValue(body.status,['draft','published','archived'],current.status),
          body.is_featured===undefined?current.is_featured:booleanInt(body.is_featured),
          body.sort_order===undefined?current.sort_order:integer(body.sort_order),
          id
        ).run();
      await audit(env, 'update_media', 'media', String(id), current.original_name);
      return json({ ok: true });
    }

    if (request.method === 'DELETE') {
      const ids = Array.isArray(body.ids) ? body.ids.map(integer).filter(Boolean).slice(0,1000) : [integer(body.id)].filter(Boolean);
      if (!ids.length) return json({ error: 'id_required' }, 400);
      const placeholders = ids.map(() => '?').join(',');
      const rows = await env.DB.prepare(`SELECT id,object_key FROM media WHERE id IN (${placeholders})`).bind(...ids).all();
      const keys = (rows.results || []).map(row => row.object_key).filter(Boolean);
      if (env.MEDIA && keys.length) {
        for (let index = 0; index < keys.length; index += 1000) await env.MEDIA.delete(keys.slice(index,index+1000));
      }
      await env.DB.prepare(`DELETE FROM media WHERE id IN (${placeholders})`).bind(...ids).run();
      await audit(env, 'delete_media', 'media', '', `${ids.length} items`);
      return json({ ok: true, deleted: ids.length });
    }

    return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, PATCH, DELETE' });
  } catch (error) {
    return json({ error: 'operation_failed', message: error.message }, 500);
  }
}
