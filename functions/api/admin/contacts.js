import { audit, clean, integer, isEmail, json, parseJson, statusValue } from '../_shared.js';
import { emailReady, emailShell, sendEmail, textToEmailHtml } from '../_email.js';
import { requireAdmin } from './_auth.js';

export async function onRequest({request,env}){
  const mutating=request.method!=='GET';
  const auth=await requireAdmin(request,env,{csrf:mutating});
  if(auth.response)return auth.response;
  if(!env.DB)return json({error:'db_binding_missing'},503);
  try{
    if(request.method==='GET'){
      const url=new URL(request.url),status=clean(url.searchParams.get('status'),20),search=clean(url.searchParams.get('search'),120),limit=Math.min(300,Math.max(1,integer(url.searchParams.get('limit'),100))),offset=Math.max(0,integer(url.searchParams.get('offset'),0));
      const filters=['1=1'],bindings=[];
      if(['new','read','handled','archived'].includes(status)){filters.push('m.status=?');bindings.push(status)}
      if(search){filters.push('(m.name LIKE ? OR m.phone LIKE ? OR m.email LIKE ? OR m.subject LIKE ? OR m.message LIKE ?)');bindings.push(...Array(5).fill(`%${search}%`))}
      const where=filters.join(' AND ');
      const [rows,count]=await Promise.all([
        env.DB.prepare(`SELECT m.*,
          (SELECT COUNT(*) FROM contact_replies r WHERE r.contact_id=m.id AND r.status='sent') AS reply_count,
          (SELECT MAX(created_at) FROM contact_replies r WHERE r.contact_id=m.id AND r.status='sent') AS last_reply_at
          FROM contact_messages m WHERE ${where}
          ORDER BY CASE m.status WHEN 'new' THEN 0 WHEN 'read' THEN 1 WHEN 'handled' THEN 2 ELSE 3 END,m.id DESC LIMIT ? OFFSET ?`).bind(...bindings,limit,offset).all(),
        env.DB.prepare(`SELECT COUNT(*) AS n FROM contact_messages m WHERE ${where}`).bind(...bindings).first()
      ]);
      return json({messages:rows.results||[],total:Number(count?.n||0),offset,limit,email_configured:emailReady(env)});
    }
    const body=await parseJson(request);
    if(request.method==='POST'&&body.action==='reply'){
      if(!emailReady(env))return json({error:'email_not_configured',message:'יש להגדיר RESEND_API_KEY ו־EMAIL_FROM ב־Cloudflare.'},503);
      const id=integer(body.id),current=await env.DB.prepare('SELECT * FROM contact_messages WHERE id=?').bind(id).first();
      if(!current)return json({error:'not_found'},404);
      const to=clean(body.to||current.email,200).toLowerCase(),subject=clean(body.subject||`תגובה לפנייה: ${current.subject||'פנייה מהאתר'}`,300),message=clean(body.message,12000);
      if(!isEmail(to))return json({error:'invalid_email',message:'לא קיימת כתובת אימייל תקינה בפנייה.'},400);
      if(message.length<2)return json({error:'message_required',message:'יש לכתוב תשובה.'},400);
      const bodyHtml=`<p style="margin:0 0 18px">שלום ${clean(current.name,120)||'רב'},</p><div>${textToEmailHtml(message)}</div><hr style="border:0;border-top:1px solid #edf0f5;margin:28px 0"><div style="font-size:13px;color:#718096"><strong>הפנייה המקורית:</strong><br>${textToEmailHtml(current.message)}</div>`;
      const html=emailShell({title:subject,bodyHtml,footerHtml:'נשלח בתגובה לפנייה שהועברה דרך אתר קעמפ גן ישראל חדרה.'});
      let providerId='',sendStatus='sent',errorMessage='';
      try{
        const result=await sendEmail(env,{to,subject,html,text:message,replyTo:env.EMAIL_REPLY_TO},`contact-reply-${id}-${Date.now()}`);
        providerId=clean(result.id,200);
      }catch(error){sendStatus='failed';errorMessage=clean(error.message,700)}
      await env.DB.prepare(`INSERT INTO contact_replies(contact_id,to_email,subject,body,provider_id,status,error,created_at)
        VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(id,to,subject,message,providerId,sendStatus,errorMessage).run();
      if(sendStatus==='failed')return json({error:'email_send_failed',message:errorMessage||'שליחת המייל נכשלה.'},502);
      await env.DB.prepare("UPDATE contact_messages SET status='handled',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
      await audit(env,'reply_contact_email','contact',String(id),to);
      return json({ok:true,provider_id:providerId,message:'התשובה נשלחה במייל.'});
    }
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
