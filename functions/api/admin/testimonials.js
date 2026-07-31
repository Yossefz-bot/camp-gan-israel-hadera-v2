import { audit, clean, integer, json, parseJson, statusValue } from '../_shared.js';
import { requireAdmin } from './_auth.js';

export async function onRequest({request,env}){
  const mutating=request.method!=='GET';const auth=await requireAdmin(request,env,{csrf:mutating});if(auth.response)return auth.response;
  if(!env.DB)return json({error:'db_binding_missing'},503);
  try{
    if(request.method==='GET'){
      const url=new URL(request.url),status=clean(url.searchParams.get('status'),20);let sql='SELECT * FROM testimonials',bindings=[];
      if(['pending','approved','rejected'].includes(status)){sql+=' WHERE status=?';bindings.push(status)}
      sql+=' ORDER BY CASE status WHEN \'pending\' THEN 0 WHEN \'approved\' THEN 1 ELSE 2 END,sort_order,id DESC';
      const rows=await env.DB.prepare(sql).bind(...bindings).all();return json({testimonials:rows.results||[]});
    }
    const body=await parseJson(request);
    if(request.method==='POST'){
      const name=clean(body.name,160),message=clean(body.message,3000);if(!name||!message)return json({error:'required_fields'},400);
      const result=await env.DB.prepare(`INSERT INTO testimonials(name,relation,phone,rating,message,status,sort_order,updated_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`)
        .bind(name,clean(body.relation,160),clean(body.phone,80),Math.min(5,Math.max(1,integer(body.rating,5))),message,statusValue(body.status,['pending','approved','rejected'],'approved'),integer(body.sort_order)).run();
      await audit(env,'create_testimonial','testimonial',String(result.meta.last_row_id),name);return json({ok:true,id:result.meta.last_row_id});
    }
    if(request.method==='PATCH'){
      const id=integer(body.id),current=await env.DB.prepare('SELECT * FROM testimonials WHERE id=?').bind(id).first();if(!current)return json({error:'not_found'},404);
      await env.DB.prepare(`UPDATE testimonials SET name=?,relation=?,phone=?,rating=?,message=?,status=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(body.name===undefined?current.name:clean(body.name,160),body.relation===undefined?current.relation:clean(body.relation,160),body.phone===undefined?current.phone:clean(body.phone,80),body.rating===undefined?current.rating:Math.min(5,Math.max(1,integer(body.rating,5))),body.message===undefined?current.message:clean(body.message,3000),body.status===undefined?current.status:statusValue(body.status,['pending','approved','rejected'],current.status),body.sort_order===undefined?current.sort_order:integer(body.sort_order),id).run();
      await audit(env,'update_testimonial','testimonial',String(id),current.name);return json({ok:true});
    }
    if(request.method==='DELETE'){const id=integer(body.id);await env.DB.prepare('DELETE FROM testimonials WHERE id=?').bind(id).run();await audit(env,'delete_testimonial','testimonial',String(id));return json({ok:true});}
    return json({error:'method_not_allowed'},405);
  }catch(error){return json({error:'operation_failed',message:error.message},500)}
}
