import { audit, clean, integer, isEmail, json, parseJson, statusValue } from '../_shared.js';
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
    if(request.method==='POST'&&body.action==='import'){
      const incoming=Array.isArray(body.rows)?body.rows:[];
      if(!incoming.length)return json({error:'no_rows',message:'לא נמצאו שורות תקינות לייבוא.'},400);
      if(incoming.length>500)return json({error:'too_many_rows',message:'אפשר לייבא עד 500 כתובות בכל פעולה.'},400);
      const source=clean(body.source||'ייבוא אקסל',120)||'ייבוא אקסל';
      const reactivate=body.reactivate!==false;
      const unique=new Map();let invalid=0,duplicates=0;
      for(const row of incoming){
        const email=clean(row?.email,200).toLowerCase();
        if(!isEmail(email)){invalid++;continue}
        if(unique.has(email)){duplicates++;continue}
        unique.set(email,{email,name:clean(row?.name,120),phone:clean(row?.phone,40)});
      }
      const rows=[...unique.values()];
      if(!rows.length)return json({error:'no_valid_emails',message:'לא נמצאו כתובות אימייל תקינות בקובץ.'},400);
      const existing=new Set();
      for(let i=0;i<rows.length;i+=80){
        const chunk=rows.slice(i,i+80),placeholders=chunk.map(()=>'?').join(',');
        const found=await env.DB.prepare(`SELECT LOWER(email) AS email FROM subscribers WHERE LOWER(email) IN (${placeholders})`).bind(...chunk.map(row=>row.email)).all();
        for(const item of found.results||[])existing.add(String(item.email).toLowerCase());
      }
      const sql=reactivate
        ?`INSERT INTO subscribers(name,phone,email,status,source,consent,created_at,updated_at) VALUES(?,?,?,'active',?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(email) DO UPDATE SET name=CASE WHEN excluded.name<>'' THEN excluded.name ELSE subscribers.name END,phone=CASE WHEN excluded.phone<>'' THEN excluded.phone ELSE subscribers.phone END,status='active',consent=1,updated_at=CURRENT_TIMESTAMP`
        :`INSERT INTO subscribers(name,phone,email,status,source,consent,created_at,updated_at) VALUES(?,?,?,'active',?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(email) DO UPDATE SET name=CASE WHEN excluded.name<>'' THEN excluded.name ELSE subscribers.name END,phone=CASE WHEN excluded.phone<>'' THEN excluded.phone ELSE subscribers.phone END,updated_at=CURRENT_TIMESTAMP`;
      for(let i=0;i<rows.length;i+=100){
        const statements=rows.slice(i,i+100).map(row=>env.DB.prepare(sql).bind(row.name,row.phone,row.email,source));
        await env.DB.batch(statements);
      }
      const inserted=rows.filter(row=>!existing.has(row.email)).length,updated=rows.length-inserted;
      await audit(env,'import_subscribers','subscriber','batch',`${rows.length} rows from ${source}`);
      return json({ok:true,inserted,updated,invalid,duplicates,total:rows.length});
    }
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
