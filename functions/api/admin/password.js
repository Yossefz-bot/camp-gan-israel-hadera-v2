import { audit, clean, json, parseJson } from '../_shared.js';
import { makePasswordHash, passwordMatches, requireAdmin } from './_auth.js';
export async function onRequestPost({request,env}){
 const auth=await requireAdmin(request,env,{csrf:true});if(auth.response)return auth.response;
 const body=await parseJson(request),current=clean(body.current_password,500),next=clean(body.new_password,500),confirm=clean(body.confirm_password,500);
 if(!(await passwordMatches(current,env)))return json({error:'wrong_password',message:'הסיסמה הנוכחית אינה נכונה.'},400);
 if(next.length<8)return json({error:'weak_password',message:'הסיסמה החדשה חייבת להכיל לפחות 8 תווים.'},400);
 if(next!==confirm)return json({error:'password_mismatch',message:'אימות הסיסמה אינו תואם.'},400);
 const salt=crypto.randomUUID()+crypto.randomUUID(),hash=await makePasswordHash(next,salt);
 await env.DB.batch([
  env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('admin_password_hash',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(hash),
  env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('admin_password_salt',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(salt)
 ]);
 await audit(env,'change_admin_password','admin','primary');return json({ok:true,message:'הסיסמה שונתה בהצלחה.'});
}
