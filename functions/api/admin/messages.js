import { authorized, denied } from './_auth.js';
import { json, body, clean, integer, booleanInt, validStatus } from './_helpers.js';
export async function onRequest({request,env}){
  if(!authorized(request,env))return denied();
  try{
    if(request.method==='GET'){const r=await env.DB.prepare('SELECT * FROM messages ORDER BY id DESC').all();return json({messages:r.results||[]})}
    const b=await body(request);
    if(request.method==='POST'){
      if(!clean(b.title)||!clean(b.body))return json({error:'חסרים כותרת או תוכן'},400);
      await env.DB.prepare('INSERT INTO messages(title,body,is_active,tone,button_text,button_url,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)').bind(clean(b.title,200),clean(b.body,3000),booleanInt(b.is_active),validStatus(clean(b.tone,20),['info','success','warning'],'info'),clean(b.button_text,100),clean(b.button_url,1000)).run();return json({ok:true});
    }
    if(request.method==='PATCH'){
      const id=integer(b.id),m=await env.DB.prepare('SELECT * FROM messages WHERE id=?').bind(id).first();if(!m)return json({error:'ההודעה לא נמצאה'},404);
      await env.DB.prepare('UPDATE messages SET title=?,body=?,is_active=?,tone=?,button_text=?,button_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.title===undefined?m.title:clean(b.title,200),b.body===undefined?m.body:clean(b.body,3000),b.is_active===undefined?m.is_active:booleanInt(b.is_active),b.tone===undefined?m.tone:validStatus(clean(b.tone,20),['info','success','warning'],m.tone),b.button_text===undefined?m.button_text:clean(b.button_text,100),b.button_url===undefined?m.button_url:clean(b.button_url,1000),id).run();return json({ok:true});
    }
    if(request.method==='DELETE'){await env.DB.prepare('DELETE FROM messages WHERE id=?').bind(integer(b.id)).run();return json({ok:true})}
    return json({error:'Method not allowed'},405);
  }catch(error){return json({error:error.message},500)}
}
