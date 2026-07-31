import { audit, clean, integer, json, parseJson, statusValue } from '../_shared.js';
import { requireAdmin } from './_auth.js';

export async function onRequest({request,env}){
  const mutating=request.method!=='GET';const auth=await requireAdmin(request,env,{csrf:mutating});if(auth.response)return auth.response;
  if(!env.DB)return json({error:'db_binding_missing'},503);
  try{
    if(request.method==='GET'){
      const url=new URL(request.url),status=clean(url.searchParams.get('status'),20),search=clean(url.searchParams.get('search'),120),limit=Math.min(300,Math.max(1,integer(url.searchParams.get('limit'),100))),offset=Math.max(0,integer(url.searchParams.get('offset'),0));
      const filters=['1=1'],bindings=[];
      if(['new','read','handled','archived'].includes(status)){filters.push('status=?');bindings.push(status)}
      if(search){filters.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR subject LIKE ? OR message LIKE ?)');bindings.push(...Array(5).fill(`%${search}%`))}
      const where=filters.join(' AND ');
      const [rows,count]=await Promise.all([
        env.DB.prepare(`SELECT * FROM contact_messages WHERE ${where} ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'read' THEN 1 WHEN 'handled' THEN 2 ELSE 3 END,id DESC LIMIT ? OFFSET ?`).bind(...bindings,limit,offset).all(),
        env.DB.prepare(`SELECT COUNT(*) AS n FROM contact_messages WHERE ${where}`).bind(...bindings).first()
      ]);
      return json({messages:rows.results||[],total:Number(count?.n||0),offset,limit});
    }
    const body=await parseJson(request);
    if(request.method==='PATCH'){
      const id=integer(body.id),current=await env.DB.prepare('SELECT * FROM contact_messages WHERE id=?').bind(id).first();if(!current)return json({error:'not_found'},404);
      const status=body.status===undefined?current.status:statusValue(body.status,['new','read','handled','archived'],current.status);
      await env.DB.prepare('UPDATE contact_messages SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,id).run();
      await audit(env,'update_contact','contact',String(id),status);return json({ok:true});
    }
    if(request.method==='DELETE'){const id=integer(body.id);await env.DB.prepare('DELETE FROM contact_messages WHERE id=?').bind(id).run();await audit(env,'delete_contact','contact',String(id));return json({ok:true});}
    return json({error:'method_not_allowed'},405);
  }catch(error){return json({error:'operation_failed',message:error.message},500)}
}
