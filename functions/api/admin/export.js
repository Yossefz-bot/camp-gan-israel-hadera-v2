import { csvResponse, json } from '../_shared.js';
import { requireAdmin } from './_auth.js';

export async function onRequestGet({request,env}){
  const auth=await requireAdmin(request,env);if(auth.response)return auth.response;if(!env.DB)return json({error:'db_binding_missing'},503);
  const type=new URL(request.url).searchParams.get('type');
  if(type==='subscribers'){
    const rows=await env.DB.prepare('SELECT name,phone,email,status,source,created_at FROM subscribers ORDER BY id DESC').all();
    return csvResponse([['שם','טלפון','אימייל','סטטוס','מקור','תאריך'],...(rows.results||[]).map(r=>[r.name,r.phone,r.email,r.status,r.source,r.created_at])],'camp-subscribers.csv');
  }
  if(type==='contacts'){
    const rows=await env.DB.prepare('SELECT name,phone,email,subject,message,status,created_at FROM contact_messages ORDER BY id DESC').all();
    return csvResponse([['שם','טלפון','אימייל','נושא','הודעה','סטטוס','תאריך'],...(rows.results||[]).map(r=>[r.name,r.phone,r.email,r.subject,r.message,r.status,r.created_at])],'camp-contact-messages.csv');
  }
  if(type==='testimonials'){
    const rows=await env.DB.prepare('SELECT name,relation,phone,rating,message,status,created_at FROM testimonials ORDER BY id DESC').all();
    return csvResponse([['שם','קשר','טלפון','דירוג','תגובה','סטטוס','תאריך'],...(rows.results||[]).map(r=>[r.name,r.relation,r.phone,r.rating,r.message,r.status,r.created_at])],'camp-testimonials.csv');
  }
  return json({error:'invalid_export_type'},400);
}
