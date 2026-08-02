import { audit, booleanInt, clean, integer, json, parseJson, statusValue } from '../_shared.js';
import { requireAdmin } from './_auth.js';

async function runBatches(env, statements, size=50){for(let i=0;i<statements.length;i+=size)await env.DB.batch(statements.slice(i,i+size));}

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
      const mediaId=integer(url.searchParams.get('id'));
      const rawDayId=url.searchParams.get('day_id');
      const dayId = integer(rawDayId);
      const kind = clean(url.searchParams.get('kind'), 20);
      const status = clean(url.searchParams.get('status'), 20);
      const search = clean(url.searchParams.get('search'), 120);
      const category=clean(url.searchParams.get('category'),60);
      if(mediaId){filters.push('m.id=?');bindings.push(mediaId);}
      if(rawDayId==='none') filters.push('m.day_id IS NULL'); else if (dayId) { filters.push('m.day_id=?'); bindings.push(dayId); }
      if (['image','video','audio','document'].includes(kind)) { filters.push('m.kind=?'); bindings.push(kind); }
      if (['draft','published','archived'].includes(status)) { filters.push('m.status=?'); bindings.push(status); }
      if(category){filters.push('m.category=?');bindings.push(category);}
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
        if (statements.length) await runBatches(env, statements);
        await audit(env, 'reorder_media', 'media', '', `${statements.length} items`);
        return json({ ok: true });
      }
      if (body.action === 'bulk_status' && Array.isArray(body.ids)) {
        const status = statusValue(body.status, ['draft','published','archived'], 'published');
        const ids=[...new Set(body.ids.slice(0,1000).map(integer).filter(Boolean))];
        const statements = ids.map(id => env.DB.prepare('UPDATE media SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, id));
        if (statements.length) await runBatches(env, statements);
        if(status!=='published'&&ids.length){
          for(let index=0;index<ids.length;index+=80){const chunk=ids.slice(index,index+80),placeholders=chunk.map(()=>'?').join(',');await env.DB.prepare(`UPDATE days SET video_key='',updated_at=CURRENT_TIMESTAMP WHERE video_key IN (SELECT object_key FROM media WHERE id IN (${placeholders}) AND kind='video')`).bind(...chunk).run();}
        }
        await audit(env, 'bulk_media_status', 'media', '', `${status}:${statements.length}`);
        return json({ ok: true });
      }
      if (body.action === 'bulk_day' && Array.isArray(body.ids)) {
        const dayId = integer(body.day_id) || null;
        const ids=[...new Set(body.ids.slice(0,1000).map(integer).filter(Boolean))];
        if(ids.length){
          for(let index=0;index<ids.length;index+=80){const chunk=ids.slice(index,index+80),placeholders=chunk.map(()=>'?').join(',');await env.DB.prepare(`UPDATE days SET video_key='',updated_at=CURRENT_TIMESTAMP WHERE video_key IN (SELECT object_key FROM media WHERE id IN (${placeholders}) AND kind='video') AND id<>?`).bind(...chunk,dayId||0).run();}
        }
        const statements = ids.map(id=>env.DB.prepare('UPDATE media SET day_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(dayId,id));
        if(statements.length)await runBatches(env,statements);
        await audit(env,'bulk_media_day','media','',`${dayId||'none'}:${statements.length}`);
        return json({ok:true,updated:statements.length});
      }
      if (body.action === 'bulk_category' && Array.isArray(body.ids)) {
        const category=clean(body.category,60);
        const statements=body.ids.slice(0,1000).map(id=>env.DB.prepare('UPDATE media SET category=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(category,integer(id)));
        if(statements.length)await runBatches(env,statements);
        await audit(env,'bulk_media_category','media','',`${category}:${statements.length}`);
        return json({ok:true,updated:statements.length});
      }
      if (body.action === 'set_cover') {
        const id = integer(body.id);
        const item = await env.DB.prepare("SELECT id,day_id,object_key FROM media WHERE id=? AND kind='image'").bind(id).first();
        if (!item?.day_id) return json({ error: 'invalid_cover', message: 'אפשר לבחור כתמונת שער רק תמונה המשויכת ליום.' }, 400);
        await env.DB.batch([
          env.DB.prepare("UPDATE media SET is_featured=CASE WHEN id=? THEN 1 ELSE 0 END,status=CASE WHEN id=? THEN 'published' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE day_id=? AND kind='image'").bind(id,id,item.day_id),
          env.DB.prepare('UPDATE days SET cover_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(item.object_key,item.day_id)
        ]);
        await audit(env, 'set_day_cover', 'media', String(id), `day=${item.day_id}`);
        return json({ ok: true });
      }
      if (body.action === 'set_day_video') {
        const id = integer(body.id);
        const item = await env.DB.prepare("SELECT id,day_id,object_key FROM media WHERE id=? AND kind='video'").bind(id).first();
        if (!item?.day_id) return json({ error: 'invalid_day_video', message: 'אפשר להגדיר סרטון סיכום רק לסרטון המשויך ליום.' }, 400);
        await env.DB.batch([
          env.DB.prepare("UPDATE media SET is_featured=CASE WHEN id=? THEN 1 ELSE is_featured END,status=CASE WHEN id=? THEN 'published' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE day_id=? AND kind='video'").bind(id,id,item.day_id),
          env.DB.prepare("UPDATE days SET video_key=?,video_url='',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(item.object_key,item.day_id)
        ]);
        await audit(env, 'set_day_video', 'media', String(id), `day=${item.day_id}`);
        return json({ ok: true });
      }
      const id = integer(body.id);
      const current = await env.DB.prepare('SELECT * FROM media WHERE id=?').bind(id).first();
      if (!current) return json({ error: 'not_found', message: 'הקובץ לא נמצא.' }, 404);
      const dayId = body.day_id === undefined ? current.day_id : (integer(body.day_id) || null);
      const artworkKey=body.artwork_key===undefined?(current.artwork_key||''):clean(body.artwork_key,1000);
      const nextKind=body.kind===undefined?current.kind:statusValue(body.kind,['image','video','audio','document'],current.kind);
      const nextStatus=body.status===undefined?current.status:statusValue(body.status,['draft','published','archived'],current.status);
      await env.DB.prepare(`UPDATE media SET day_id=?,kind=?,category=?,title=?,alt_text=?,caption=?,status=?,is_featured=?,sort_order=?,artwork_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(
          dayId,
          nextKind,
          body.category===undefined?current.category:clean(body.category,60),
          body.title===undefined?current.title:clean(body.title,240),
          body.alt_text===undefined?current.alt_text:clean(body.alt_text,500),
          body.caption===undefined?current.caption:clean(body.caption,1500),
          nextStatus,
          body.is_featured===undefined?current.is_featured:booleanInt(body.is_featured),
          body.sort_order===undefined?current.sort_order:integer(body.sort_order),
          artworkKey,
          id
        ).run();
      if (current.object_key && (nextKind !== 'video' || nextStatus !== 'published' || Number(dayId || 0) !== Number(current.day_id || 0))) {
        const keepDay = nextKind === 'video' && nextStatus === 'published' ? (dayId || 0) : 0;
        await env.DB.prepare("UPDATE days SET video_key='',updated_at=CURRENT_TIMESTAMP WHERE video_key=? AND id<>?").bind(current.object_key,keepDay).run();
      }
      await audit(env, 'update_media', 'media', String(id), current.original_name);
      return json({ ok: true });
    }

    if (request.method === 'DELETE') {
      const requestedIds = Array.isArray(body.ids) ? body.ids : [body.id];
      const ids = [...new Set(requestedIds.map(integer).filter(Boolean))].slice(0,1000);
      if (!ids.length) return json({ error: 'id_required', message: 'לא נבחרו קבצים למחיקה.' }, 400);

      const records = [];
      for (let index = 0; index < ids.length; index += 80) {
        const chunk = ids.slice(index,index+80), placeholders = chunk.map(() => '?').join(',');
        const rows = await env.DB.prepare(`SELECT id,object_key FROM media WHERE id IN (${placeholders})`).bind(...chunk).all();
        records.push(...(rows.results || []));
      }
      if (!records.length) return json({ ok: true, deleted: 0 });

      const existingIds = records.map(row => Number(row.id)).filter(Boolean);
      const keys = [...new Set(records.map(row => row.object_key).filter(Boolean))];
      const settingKeys = "'hero_image_key','hero_video_key','hero_video_poster_key','story_image_key','story_video_key','story_video_poster_key','record_center_image_key'";

      for (let index = 0; index < keys.length; index += 40) {
        const chunk = keys.slice(index,index+40), placeholders = chunk.map(() => '?').join(',');
        const cleanup=[
          env.DB.prepare(`UPDATE days SET cover_key='',updated_at=CURRENT_TIMESTAMP WHERE cover_key IN (${placeholders})`).bind(...chunk),
          env.DB.prepare(`UPDATE days SET video_key='',updated_at=CURRENT_TIMESTAMP WHERE video_key IN (${placeholders})`).bind(...chunk),
          env.DB.prepare(`DELETE FROM homepage_slides WHERE object_key IN (${placeholders})`).bind(...chunk),
          env.DB.prepare(`DELETE FROM homepage_slides WHERE poster_key IN (${placeholders})`).bind(...chunk),
          env.DB.prepare(`UPDATE settings SET value='',updated_at=CURRENT_TIMESTAMP WHERE key IN (${settingKeys}) AND value IN (${placeholders})`).bind(...chunk),
          env.DB.prepare(`UPDATE media SET artwork_key='',updated_at=CURRENT_TIMESTAMP WHERE artwork_key IN (${placeholders})`).bind(...chunk)
        ];
        await runBatches(env,cleanup,5);
      }
      for (let index = 0; index < existingIds.length; index += 80) {
        const chunk = existingIds.slice(index,index+80), placeholders = chunk.map(() => '?').join(',');
        await env.DB.prepare(`DELETE FROM media WHERE id IN (${placeholders})`).bind(...chunk).run();
      }

      let storageWarning = '';
      if (keys.length) {
        if (!env.MEDIA) storageWarning = 'המידע נמחק מהמסד, אך R2 אינו מחובר ולכן הקבצים נשארו באחסון.';
        else {
          try {
            for (let index = 0; index < keys.length; index += 1000) await env.MEDIA.delete(keys.slice(index,index+1000));
          } catch (error) {
            storageWarning = `המידע נמחק מהאתר, אך ניקוי חלק מהקבצים ב־R2 נכשל: ${error.message}`;
          }
        }
      }
      await audit(env, 'delete_media', 'media', '', `${existingIds.length} items`);
      return json({ ok: true, deleted: existingIds.length, warning: storageWarning });
    }

    return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, PATCH, DELETE' });
  } catch (error) {
    return json({ error: 'operation_failed', message: error.message }, 500);
  }
}
