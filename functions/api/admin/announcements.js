import { audit, clean, integer, isHttpUrl, json, parseJson, statusValue } from '../_shared.js';
import { requireAdmin } from './_auth.js';

export async function onRequest({ request, env }) {
  const mutating = request.method !== 'GET';
  const auth = await requireAdmin(request, env, { csrf: mutating });
  if (auth.response) return auth.response;
  if (!env.DB) return json({ error: 'db_binding_missing' }, 503);
  try {
    if (request.method === 'GET') {
      const result = await env.DB.prepare('SELECT * FROM announcements ORDER BY id DESC').all();
      return json({ announcements: result.results || [] });
    }
    const body = await parseJson(request);
    if (request.method === 'POST') {
      const title = clean(body.title, 180), text = clean(body.body, 3000);
      if (!title || !text) return json({ error: 'required_fields', message: 'יש להזין כותרת ותוכן.' }, 400);
      const buttonUrl = clean(body.button_url,1200);
      if (!isHttpUrl(buttonUrl,true)) return json({ error: 'invalid_url' },400);
      const status = statusValue(body.status,['draft','published','archived'],'draft');
      if (status === 'published') await env.DB.prepare("UPDATE announcements SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE status='published'").run();
      const result = await env.DB.prepare(`INSERT INTO announcements(title,body,tone,button_text,button_url,status,starts_at,ends_at,updated_at) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`)
        .bind(title,text,statusValue(body.tone,['info','success','warning','urgent'],'info'),clean(body.button_text,120),buttonUrl,status,clean(body.starts_at,40),clean(body.ends_at,40)).run();
      await audit(env,'create_announcement','announcement',String(result.meta.last_row_id),title);
      return json({ok:true,id:result.meta.last_row_id});
    }
    if (request.method === 'PATCH') {
      const id=integer(body.id), current=await env.DB.prepare('SELECT * FROM announcements WHERE id=?').bind(id).first();
      if(!current)return json({error:'not_found'},404);
      const status=body.status===undefined?current.status:statusValue(body.status,['draft','published','archived'],current.status);
      if(status==='published')await env.DB.prepare("UPDATE announcements SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE status='published' AND id<>?").bind(id).run();
      const buttonUrl=body.button_url===undefined?current.button_url:clean(body.button_url,1200);
      if(!isHttpUrl(buttonUrl,true))return json({error:'invalid_url'},400);
      await env.DB.prepare(`UPDATE announcements SET title=?,body=?,tone=?,button_text=?,button_url=?,status=?,starts_at=?,ends_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(body.title===undefined?current.title:clean(body.title,180),body.body===undefined?current.body:clean(body.body,3000),body.tone===undefined?current.tone:statusValue(body.tone,['info','success','warning','urgent'],current.tone),body.button_text===undefined?current.button_text:clean(body.button_text,120),buttonUrl,status,body.starts_at===undefined?current.starts_at:clean(body.starts_at,40),body.ends_at===undefined?current.ends_at:clean(body.ends_at,40),id).run();
      await audit(env,'update_announcement','announcement',String(id),current.title);
      return json({ok:true});
    }
    if(request.method==='DELETE'){
      const id=integer(body.id);await env.DB.prepare('DELETE FROM announcements WHERE id=?').bind(id).run();await audit(env,'delete_announcement','announcement',String(id));return json({ok:true});
    }
    return json({error:'method_not_allowed'},405,{Allow:'GET, POST, PATCH, DELETE'});
  }catch(error){return json({error:'operation_failed',message:error.message},500);}
}
