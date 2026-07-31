import { authorized, denied } from './_auth.js';
import { json, body, clean, integer, validStatus } from './_helpers.js';
const statuses=['pending','approved','rejected'];
export async function onRequest({request,env}){
  if(!authorized(request,env))return denied();
  try{
    if(request.method==='GET'){const r=await env.DB.prepare('SELECT * FROM testimonials ORDER BY sort_order ASC,id DESC').all();return json({testimonials:r.results||[]})}
    const b=await body(request);
    if(request.method==='POST'){
      if(!clean(b.name)||!clean(b.message))return json({error:'חסרים שם או תגובה'},400);
      await env.DB.prepare('INSERT INTO testimonials(name,relation,phone,rating,message,status,sort_order,updated_at) VALUES(?,?,?,?,?,?,0,CURRENT_TIMESTAMP)').bind(clean(b.name,160),clean(b.relation,160),clean(b.phone,80),Math.min(5,Math.max(1,integer(b.rating,5))),clean(b.message,3000),validStatus(b.status,statuses,'approved')).run();return json({ok:true});
    }
    if(request.method==='PATCH'){
      const id=integer(b.id),t=await env.DB.prepare('SELECT * FROM testimonials WHERE id=?').bind(id).first();if(!t)return json({error:'התגובה לא נמצאה'},404);
      await env.DB.prepare('UPDATE testimonials SET name=?,relation=?,phone=?,rating=?,message=?,status=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.name===undefined?t.name:clean(b.name,160),b.relation===undefined?t.relation:clean(b.relation,160),b.phone===undefined?t.phone:clean(b.phone,80),b.rating===undefined?t.rating:Math.min(5,Math.max(1,integer(b.rating,5))),b.message===undefined?t.message:clean(b.message,3000),b.status===undefined?t.status:validStatus(b.status,statuses,t.status),b.sort_order===undefined?t.sort_order:integer(b.sort_order),id).run();return json({ok:true});
    }
    if(request.method==='DELETE'){await env.DB.prepare('DELETE FROM testimonials WHERE id=?').bind(integer(b.id)).run();return json({ok:true})}
    return json({error:'Method not allowed'},405);
  }catch(error){return json({error:error.message},500)}
}
