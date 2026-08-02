import { audit, clean, json, parseJson } from '../_shared.js';
import { requireAdmin } from './_auth.js';
export async function onRequest({request,env}){
 const auth=await requireAdmin(request,env,{csrf:request.method!=='GET'});if(auth.response)return auth.response;
 if(!env.DB)return json({error:'db_binding_missing'},503);
 if(request.method==='GET'){const rows=await env.DB.prepare('SELECT selector,value,updated_at FROM text_overrides ORDER BY selector').all();return json({overrides:rows.results||[]});}
 if(request.method==='PUT'){
  const body=await parseJson(request),rows=Array.isArray(body.overrides)?body.overrides:[];
  const cleanRows=rows.slice(0,300).map(row=>({selector:clean(row.selector,180),value:clean(row.value,12000)})).filter(row=>row.selector);
  await env.DB.batch([env.DB.prepare('DELETE FROM text_overrides'),...cleanRows.map(row=>env.DB.prepare('INSERT INTO text_overrides(selector,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)').bind(row.selector,row.value))]);
  await audit(env,'update_text_overrides','settings','',`${cleanRows.length} selectors`);return json({ok:true,count:cleanRows.length});
 }
 return json({error:'method_not_allowed'},405,{Allow:'GET, PUT'});
}
