import { requireAdmin } from './_auth.js';

const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
async function ensure(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS faq_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}
async function body(request){try{return await request.json()}catch{return {}}}
function clean(v,max=4000){return String(v??'').trim().slice(0,max)}

export async function onRequestGet({request,env}){
  const auth=await requireAdmin(request,env);if(auth.response)return auth.response;
  if(!env.DB)return json({error:'db_binding_missing'},503);
  await ensure(env);
  const rows=await env.DB.prepare(`SELECT * FROM faq_items ORDER BY sort_order ASC,id ASC`).all();
  return json({faq:(rows.results||[]).map(x=>({...x,visible:Boolean(x.visible)}))});
}
export async function onRequestPost({request,env}){
  const auth=await requireAdmin(request,env);if(auth.response)return auth.response;
  if(!env.DB)return json({error:'db_binding_missing'},503);await ensure(env);
  const p=await body(request),question=clean(p.question,300),answer=clean(p.answer,5000);
  if(question.length<3||answer.length<2)return json({message:'יש למלא שאלה ותשובה.'},400);
  const order=Number.isFinite(Number(p.sort_order))?Number(p.sort_order):9999;
  const result=await env.DB.prepare(`INSERT INTO faq_items(question,answer,sort_order,visible) VALUES(?,?,?,?)`).bind(question,answer,order,p.visible===false?0:1).run();
  return json({ok:true,id:result.meta?.last_row_id});
}
export async function onRequestPatch({request,env}){
  const auth=await requireAdmin(request,env);if(auth.response)return auth.response;
  if(!env.DB)return json({error:'db_binding_missing'},503);await ensure(env);
  const p=await body(request),id=Number(p.id);if(!id)return json({message:'חסר מזהה שאלה.'},400);
  const question=clean(p.question,300),answer=clean(p.answer,5000);if(question.length<3||answer.length<2)return json({message:'יש למלא שאלה ותשובה.'},400);
  const order=Number.isFinite(Number(p.sort_order))?Number(p.sort_order):0;
  await env.DB.prepare(`UPDATE faq_items SET question=?,answer=?,sort_order=?,visible=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(question,answer,order,p.visible===false?0:1,id).run();
  return json({ok:true});
}
export async function onRequestDelete({request,env}){
  const auth=await requireAdmin(request,env);if(auth.response)return auth.response;
  if(!env.DB)return json({error:'db_binding_missing'},503);await ensure(env);
  const p=await body(request),id=Number(p.id);if(!id)return json({message:'חסר מזהה שאלה.'},400);
  await env.DB.prepare(`DELETE FROM faq_items WHERE id=?`).bind(id).run();return json({ok:true});
}
