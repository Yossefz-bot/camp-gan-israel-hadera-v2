import { audit, clean, integer, json, parseJson, statusValue } from '../_shared.js';
import { requireAdmin } from './_auth.js';

export async function onRequest({request,env}){
  const mutating=request.method!=='GET';const auth=await requireAdmin(request,env,{csrf:mutating});if(auth.response)return auth.response;
  if(!env.DB)return json({error:'db_binding_missing'},503);
  try{
    if(request.method==='GET'){
      const url=new URL(request.url),search=clean(url.searchParams.get('search'),120),status=clean(url.searchParams.get('status'),20),limit=Math.min(500,Math.max(1,integer(url.searchParams.get('limit'),200))),offset=Math.max(0,integer(url.searchParams.get('offset'),0));
      const filters=['1=1'],bindings=[];
      if(['active','unsubscribed'].includes(status)){filters.push('status=?');bindings.push(status)}
      if(search){filters.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');bindings.push(`%${search}%`,`%${search}%`,`%${search}%`)}
      const where=filters.join(' AND ');
      const [rows,count]=await Promise.all([
        env.DB.prepare(`SELECT * FROM subscribers WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).bind(...bindings,limit,offset).all(),
        env.DB.prepare(`SELECT COUNT(*) AS n FROM subscribers WHERE ${where}`).bind(...bindings).first()
      ]);
      return json({subscribers:rows.results||[],total:Number(count?.n||0),offset,limit});
    }
    const body=await parseJson(request);
    if(request.method==='PATCH'){
      const id=integer(body.id),current=await env.DB.prepare('SELECT * FROM subscribers WHERE id=?').bind(id).first();if(!current)return json({error:'not_found'},404);
      await env.DB.prepare('UPDATE subscribers SET name=?,phone=?,email=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .bind(body.name===undefined?current.name:clean(body.name,120),body.phone===undefined?current.phone:clean(body.phone,40),body.email===undefined?current.email:clean(body.email,200).toLowerCase(),body.status===undefined?current.status:statusValue(body.status,['active','unsubscribed'],current.status),id).run();
      await audit(env,'update_subscriber','subscriber',String(id),current.email);return json({ok:true});
    }
    if(request.method==='DELETE'){const id=integer(body.id);await env.DB.prepare('DELETE FROM subscribers WHERE id=?').bind(id).run();await audit(env,'delete_subscriber','subscriber',String(id));return json({ok:true});}
    return json({error:'method_not_allowed'},405);
  }catch(error){return json({error:'operation_failed',message:error.message},500)}
}
