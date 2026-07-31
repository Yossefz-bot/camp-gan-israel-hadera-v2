import { audit, booleanInt, clean, integer, json, parseJson, slugify, statusValue } from '../_shared.js';
import { requireAdmin } from './_auth.js';

async function listDays(env) {
  const result = await env.DB.prepare(`
    SELECT d.*,
      (SELECT COUNT(*) FROM media m WHERE m.day_id=d.id) AS media_count,
      (SELECT COUNT(*) FROM media m WHERE m.day_id=d.id AND m.kind='image') AS photo_count,
      (SELECT object_key FROM media m WHERE m.day_id=d.id AND m.kind='image' ORDER BY m.is_featured DESC,m.sort_order,m.id LIMIT 1) AS fallback_cover_key
    FROM days d ORDER BY d.sort_order ASC,CASE WHEN d.date='' THEN 1 ELSE 0 END,d.date DESC,d.id DESC
  `).all();
  return result.results || [];
}

export async function onRequest({ request, env }) {
  const mutating = request.method !== 'GET';
  const auth = await requireAdmin(request, env, { csrf: mutating });
  if (auth.response) return auth.response;
  if (!env.DB) return json({ error: 'db_binding_missing' }, 503);

  try {
    if (request.method === 'GET') return json({ days: await listDays(env) });
    const body = await parseJson(request);

    if (request.method === 'POST') {
      if (body.action === 'duplicate') {
        const sourceId = integer(body.id);
        const source = await env.DB.prepare('SELECT * FROM days WHERE id=?').bind(sourceId).first();
        if (!source) return json({ error: 'not_found', message: 'היום לא נמצא.' }, 404);
        const slug = slugify(body.slug, `${source.slug}-copy-${Date.now().toString(36)}`);
        const title = clean(body.title || `${source.title} — עותק`, 180);
        const result = await env.DB.prepare(`INSERT INTO days(slug,title,label,date,hebrew_date,description,story,cover_key,video_url,video_key,video_aspect,status,sort_order,starts_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`)
          .bind(slug,title,source.label,source.date,source.hebrew_date,source.description,source.story,source.cover_key,source.video_url,source.video_key,source.video_aspect,'draft',source.sort_order,source.starts_at).run();
        await audit(env, 'duplicate_day', 'day', String(result.meta.last_row_id), `source=${sourceId}`);
        return json({ ok: true, id: result.meta.last_row_id });
      }
      const title = clean(body.title, 180);
      if (!title) return json({ error: 'title_required', message: 'יש להזין שם ליום.' }, 400);
      const slug = slugify(body.slug, `day-${Date.now().toString(36)}`);
      const status = statusValue(body.status, ['draft','published','archived'], 'draft');
      const result = await env.DB.prepare(`INSERT INTO days(slug,title,label,date,hebrew_date,description,story,video_url,video_key,video_aspect,status,sort_order,starts_at,published_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`)
        .bind(slug,title,clean(body.label,120),clean(body.date,20),clean(body.hebrew_date,100),clean(body.description,3000),clean(body.story,10000),clean(body.video_url,1200),clean(body.video_key,900),statusValue(body.video_aspect,['landscape','portrait','square'],'landscape'),status,integer(body.sort_order),clean(body.starts_at,40),status==='published'?new Date().toISOString():null).run();
      await audit(env, 'create_day', 'day', String(result.meta.last_row_id), title);
      return json({ ok: true, id: result.meta.last_row_id });
    }

    if (request.method === 'PATCH') {
      if (body.action === 'reorder' && Array.isArray(body.ids)) {
        const statements = body.ids.slice(0, 500).map((id, index) => env.DB.prepare('UPDATE days SET sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(index, integer(id)));
        if (statements.length) await env.DB.batch(statements);
        await audit(env, 'reorder_days', 'day', '', `${statements.length} items`);
        return json({ ok: true });
      }
      const id = integer(body.id);
      const current = await env.DB.prepare('SELECT * FROM days WHERE id=?').bind(id).first();
      if (!current) return json({ error: 'not_found', message: 'היום לא נמצא.' }, 404);
      const status = body.status === undefined ? current.status : statusValue(body.status, ['draft','published','archived'], current.status);
      const title = body.title === undefined ? current.title : clean(body.title, 180);
      const slug = body.slug === undefined ? current.slug : slugify(body.slug, current.slug);
      if (!title || !slug) return json({ error: 'required_fields', message: 'שם היום והכתובת הם שדות חובה.' }, 400);
      const publishedAt = status === 'published' && current.status !== 'published' ? new Date().toISOString() : current.published_at;
      await env.DB.prepare(`UPDATE days SET slug=?,title=?,label=?,date=?,hebrew_date=?,description=?,story=?,cover_key=?,video_url=?,video_key=?,video_aspect=?,status=?,sort_order=?,starts_at=?,published_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(
          slug,title,
          body.label===undefined?current.label:clean(body.label,120),
          body.date===undefined?current.date:clean(body.date,20),
          body.hebrew_date===undefined?current.hebrew_date:clean(body.hebrew_date,100),
          body.description===undefined?current.description:clean(body.description,3000),
          body.story===undefined?current.story:clean(body.story,10000),
          body.cover_key===undefined?current.cover_key:clean(body.cover_key,900),
          body.video_url===undefined?current.video_url:clean(body.video_url,1200),
          body.video_key===undefined?current.video_key:clean(body.video_key,900),
          body.video_aspect===undefined?current.video_aspect:statusValue(body.video_aspect,['landscape','portrait','square'],current.video_aspect),
          status,
          body.sort_order===undefined?current.sort_order:integer(body.sort_order),
          body.starts_at===undefined?current.starts_at:clean(body.starts_at,40),
          publishedAt,
          id
        ).run();
      await audit(env, 'update_day', 'day', String(id), title);
      return json({ ok: true });
    }

    if (request.method === 'DELETE') {
      const id = integer(body.id);
      const day = await env.DB.prepare('SELECT id,title FROM days WHERE id=?').bind(id).first();
      if (!day) return json({ error: 'not_found' }, 404);
      if (booleanInt(body.delete_media)) {
        const rows = await env.DB.prepare('SELECT object_key FROM media WHERE day_id=?').bind(id).all();
        const keys = (rows.results || []).map(row => row.object_key).filter(Boolean);
        if (env.MEDIA && keys.length) {
          for (let index = 0; index < keys.length; index += 1000) await env.MEDIA.delete(keys.slice(index, index + 1000));
        }
        await env.DB.prepare('DELETE FROM media WHERE day_id=?').bind(id).run();
      }
      await env.DB.prepare('DELETE FROM days WHERE id=?').bind(id).run();
      await audit(env, 'delete_day', 'day', String(id), day.title);
      return json({ ok: true });
    }

    return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, POST, PATCH, DELETE' });
  } catch (error) {
    const duplicate = String(error.message || '').includes('UNIQUE');
    return json({ error: duplicate ? 'duplicate_slug' : 'operation_failed', message: duplicate ? 'הכתובת כבר קיימת. בחר כתובת אחרת.' : error.message }, duplicate ? 409 : 500);
  }
}
