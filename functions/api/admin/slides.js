import { audit, clean, integer, json, parseJson, statusValue } from '../_shared.js';
import { requireAdmin } from './_auth.js';

function decorate(item) {
  return { ...item, duration_seconds: Number(item.duration_seconds || 6), autoplay: Number(item.autoplay || 0), loop: Number(item.loop || 0), controls: Number(item.controls || 0) };
}

export async function onRequest({ request, env }) {
  const mutating = request.method !== 'GET';
  const auth = await requireAdmin(request, env, { csrf: mutating });
  if (auth.response) return auth.response;
  if (!env.DB) return json({ error: 'db_binding_missing' }, 503);
  try {
    if (request.method === 'GET') {
      const result = await env.DB.prepare('SELECT * FROM homepage_slides ORDER BY sort_order,id').all();
      return json({ slides: (result.results || []).map(decorate) });
    }
    const body = await parseJson(request);
    if (request.method === 'POST') {
      const kind = statusValue(body.kind, ['image','video'], 'image');
      const objectKey = clean(body.object_key, 900);
      const videoUrl = clean(body.video_url, 1200);
      if (!objectKey && !(kind === 'video' && videoUrl)) return json({ error: 'media_required', message: 'יש לבחור תמונה או סרטון.' }, 400);
      const max = await env.DB.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM homepage_slides').first();
      const result = await env.DB.prepare(`INSERT INTO homepage_slides(kind,object_key,video_url,poster_key,title,alt_text,duration_seconds,status,sort_order,autoplay,loop,controls,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`)
        .bind(kind, objectKey, videoUrl, clean(body.poster_key,900), clean(body.title,240), clean(body.alt_text,500), Math.min(60,Math.max(2,integer(body.duration_seconds,6))), statusValue(body.status,['draft','published','archived'],'published'), Number(max?.n||0), body.autoplay===false?0:1, body.loop===true?1:0, body.controls===true?1:0).run();
      const item = await env.DB.prepare('SELECT * FROM homepage_slides WHERE id=?').bind(result.meta.last_row_id).first();
      await audit(env,'create_homepage_slide','homepage_slide',String(item.id),kind);
      return json({ ok:true, slide:decorate(item) },201);
    }
    if (request.method === 'PATCH') {
      const id = integer(body.id), current = await env.DB.prepare('SELECT * FROM homepage_slides WHERE id=?').bind(id).first();
      if (!current) return json({ error:'not_found' },404);
      const next = {
        kind: body.kind===undefined?current.kind:statusValue(body.kind,['image','video'],current.kind),
        object_key: body.object_key===undefined?current.object_key:clean(body.object_key,900),
        video_url: body.video_url===undefined?current.video_url:clean(body.video_url,1200),
        poster_key: body.poster_key===undefined?current.poster_key:clean(body.poster_key,900),
        title: body.title===undefined?current.title:clean(body.title,240),
        alt_text: body.alt_text===undefined?current.alt_text:clean(body.alt_text,500),
        duration_seconds: body.duration_seconds===undefined?current.duration_seconds:Math.min(60,Math.max(2,integer(body.duration_seconds,6))),
        status: body.status===undefined?current.status:statusValue(body.status,['draft','published','archived'],current.status),
        sort_order: body.sort_order===undefined?current.sort_order:integer(body.sort_order,current.sort_order),
        autoplay: body.autoplay===undefined?current.autoplay:(body.autoplay?1:0),
        loop: body.loop===undefined?current.loop:(body.loop?1:0),
        controls: body.controls===undefined?current.controls:(body.controls?1:0)
      };
      await env.DB.prepare(`UPDATE homepage_slides SET kind=?,object_key=?,video_url=?,poster_key=?,title=?,alt_text=?,duration_seconds=?,status=?,sort_order=?,autoplay=?,loop=?,controls=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(next.kind,next.object_key,next.video_url,next.poster_key,next.title,next.alt_text,next.duration_seconds,next.status,next.sort_order,next.autoplay,next.loop,next.controls,id).run();
      await audit(env,'update_homepage_slide','homepage_slide',String(id),next.status);
      return json({ ok:true, slide:decorate({...current,...next,id}) });
    }
    if (request.method === 'DELETE') {
      const id = integer(body.id);
      await env.DB.prepare('DELETE FROM homepage_slides WHERE id=?').bind(id).run();
      await audit(env,'delete_homepage_slide','homepage_slide',String(id));
      return json({ ok:true });
    }
    return json({ error:'method_not_allowed' },405);
  } catch (error) {
    return json({ error:'operation_failed', message:error.message },500);
  }
}
