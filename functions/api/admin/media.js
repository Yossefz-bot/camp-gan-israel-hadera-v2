import { authorized, denied } from './_auth.js';
import { json, body, clean, integer, booleanInt } from './_helpers.js';
export async function onRequest({ request, env }) {
  if (!authorized(request, env)) return denied();
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url), limit = Math.min(2000, Math.max(1, integer(url.searchParams.get('limit'),300)));
      const rows = await env.DB.prepare(`SELECT m.*,d.title AS day_title FROM media m LEFT JOIN days d ON d.id=m.day_id ORDER BY m.sort_order ASC,m.id DESC LIMIT ?`).bind(limit).all();
      return json({ media:rows.results||[] });
    }
    if (request.method === 'PATCH') {
      const b = await body(request);
      if (b.action === 'reorder' && Array.isArray(b.ids)) {
        const statements = b.ids.slice(0,2000).map((id,index)=>env.DB.prepare('UPDATE media SET sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(index,integer(id)));
        if (statements.length) await env.DB.batch(statements); return json({ok:true});
      }
      const id=integer(b.id); if(!id)return json({error:'חסר מזהה קובץ'},400);
      const current=await env.DB.prepare('SELECT * FROM media WHERE id=?').bind(id).first(); if(!current)return json({error:'הקובץ לא נמצא'},404);
      await env.DB.prepare(`UPDATE media SET title=?,alt_text=?,category=?,day_id=?,is_published=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(b.title===undefined?current.title:clean(b.title,240),b.alt_text===undefined?current.alt_text:clean(b.alt_text,500),b.category===undefined?current.category:clean(b.category,40),b.day_id===undefined?current.day_id:(integer(b.day_id)||null),b.is_published===undefined?current.is_published:booleanInt(b.is_published),b.sort_order===undefined?current.sort_order:integer(b.sort_order),id).run();
      return json({ok:true});
    }
    if (request.method === 'DELETE') {
      const b=await body(request), id=integer(b.id); const row=await env.DB.prepare('SELECT object_key FROM media WHERE id=?').bind(id).first();
      if(!row)return json({error:'הקובץ לא נמצא'},404); await env.MEDIA.delete(row.object_key); await env.DB.prepare('DELETE FROM media WHERE id=?').bind(id).run(); return json({ok:true});
    }
    return json({error:'Method not allowed'},405);
  } catch(error){return json({error:error.message},500)}
}
