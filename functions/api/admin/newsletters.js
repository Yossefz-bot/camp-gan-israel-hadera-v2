import { audit, clean, integer, isEmail, json, parseJson } from '../_shared.js';
import { createUnsubscribeToken, emailReady, emailShell, escapeEmailHtml, publicBaseUrl, sendEmail, sendEmailBatch, textToEmailHtml } from '../_email.js';
import { requireAdmin } from './_auth.js';

function campaignBodyHtml(campaign, subscriber, unsubscribeUrl) {
  const greeting = subscriber.name ? `<p style="margin:0 0 18px">שלום ${escapeEmailHtml(subscriber.name)},</p>` : '';
  const cta = campaign.cta_text && campaign.cta_url
    ? `<p style="margin:28px 0 8px;text-align:center"><a href="${escapeEmailHtml(campaign.cta_url)}" style="display:inline-block;background:#ff6b16;color:#fff;text-decoration:none;padding:13px 24px;border-radius:13px;font-weight:700">${escapeEmailHtml(campaign.cta_text)}</a></p>` : '';
  const footer = `קיבלת את ההודעה משום שנרשמת לעדכוני הקעמפ. <a href="${escapeEmailHtml(unsubscribeUrl)}" style="color:#5f7187">הסרה מרשימת התפוצה</a>`;
  return emailShell({ title:campaign.subject, preheader:campaign.preheader, bodyHtml:`${greeting}<div>${textToEmailHtml(campaign.body)}</div>${cta}`, footerHtml:footer });
}

async function campaignProgress(env, id) {
  const campaign = await env.DB.prepare('SELECT * FROM newsletter_campaigns WHERE id=?').bind(id).first();
  if (!campaign) return null;
  const counts = await env.DB.prepare(`SELECT
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) AS sent,
    SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed
    FROM newsletter_deliveries WHERE campaign_id=?`).bind(id).first();
  return { ...campaign, pending:Number(counts?.pending||0), sent:Number(counts?.sent||0), failed:Number(counts?.failed||0) };
}

export async function onRequest({ request, env }) {
  const mutating = request.method !== 'GET';
  const auth = await requireAdmin(request, env, { csrf: mutating });
  if (auth.response) return auth.response;
  if (!env.DB) return json({ error:'db_binding_missing' },503);
  try {
    if (request.method === 'GET') {
      const campaigns = await env.DB.prepare('SELECT * FROM newsletter_campaigns ORDER BY id DESC LIMIT 50').all();
      const stats = await env.DB.prepare(`SELECT
        (SELECT COUNT(*) FROM subscribers WHERE status='active' AND consent=1) AS active_subscribers,
        (SELECT COUNT(*) FROM newsletter_campaigns) AS campaigns,
        (SELECT COALESCE(SUM(sent_count),0) FROM newsletter_campaigns) AS sent_emails`).first();
      return json({ campaigns:campaigns.results||[], stats, email_configured:emailReady(env) });
    }
    if (request.method !== 'POST') return json({ error:'method_not_allowed' },405);
    if (!emailReady(env)) return json({ error:'email_not_configured', message:'יש להגדיר RESEND_API_KEY ו־EMAIL_FROM ב־Cloudflare.' },503);
    const body = await parseJson(request), action = clean(body.action,40);

    if (action === 'test') {
      const to = clean(body.to,200).toLowerCase();
      if (!isEmail(to)) return json({ error:'invalid_email', message:'כתובת המייל לבדיקה אינה תקינה.' },400);
      const subject = clean(body.subject,300), message = clean(body.body,20000);
      if (!subject || !message) return json({ error:'missing_fields', message:'יש להזין נושא ותוכן.' },400);
      const fake = { id:0, email:to, name:'בדיקה' };
      const base = publicBaseUrl(request,env), unsubscribeUrl = `${base}/`;
      const html = campaignBodyHtml({ subject,preheader:clean(body.preheader,300),body:message,cta_text:clean(body.cta_text,120),cta_url:clean(body.cta_url,1200) },fake,unsubscribeUrl);
      const result = await sendEmail(env,{ to,subject:`[בדיקה] ${subject}`,html,text:message,replyTo:env.EMAIL_REPLY_TO },`newsletter-test-${Date.now()}`);
      await audit(env,'send_newsletter_test','newsletter','test',to);
      return json({ ok:true, provider_id:result.id, message:'מייל הבדיקה נשלח.' });
    }

    if (action === 'create') {
      const subject = clean(body.subject,300), message = clean(body.body,20000), ctaUrl = clean(body.cta_url,1200);
      if (!subject || !message) return json({ error:'missing_fields', message:'יש להזין נושא ותוכן לניוזלטר.' },400);
      if (ctaUrl && !/^https?:\/\//i.test(ctaUrl)) return json({ error:'invalid_url', message:'קישור הכפתור חייב להתחיל ב־https://.' },400);
      const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE status='active' AND consent=1 AND email<>''").first();
      if (!Number(count?.n||0)) return json({ error:'no_recipients', message:'אין נרשמים פעילים ברשימת התפוצה.' },400);
      const result = await env.DB.prepare(`INSERT INTO newsletter_campaigns(subject,preheader,body,cta_text,cta_url,status,total_recipients,started_at,updated_at)
        VALUES(?,?,?,?,?,'sending',?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
        .bind(subject,clean(body.preheader,300),message,clean(body.cta_text,120),ctaUrl,Number(count.n)).run();
      const campaignId = Number(result.meta.last_row_id);
      await env.DB.prepare(`INSERT INTO newsletter_deliveries(campaign_id,subscriber_id,email,status,created_at)
        SELECT ?,id,email,'pending',CURRENT_TIMESTAMP FROM subscribers WHERE status='active' AND consent=1 AND email<>''`).bind(campaignId).run();
      await audit(env,'create_newsletter','newsletter',String(campaignId),`${count.n} recipients`);
      return json({ ok:true, campaign:await campaignProgress(env,campaignId) },201);
    }

    if (action === 'send_batch') {
      const campaignId = integer(body.campaign_id), campaign = await env.DB.prepare('SELECT * FROM newsletter_campaigns WHERE id=?').bind(campaignId).first();
      if (!campaign) return json({ error:'not_found' },404);
      const deliveries = await env.DB.prepare(`SELECT d.id AS delivery_id,d.subscriber_id,d.email,s.name
        FROM newsletter_deliveries d JOIN subscribers s ON s.id=d.subscriber_id
        WHERE d.campaign_id=? AND d.status='pending' ORDER BY d.id LIMIT 80`).bind(campaignId).all();
      const rows = deliveries.results||[];
      if (!rows.length) {
        const progress = await campaignProgress(env,campaignId);
        const status = progress.failed ? (progress.sent ? 'partial' : 'failed') : 'sent';
        await env.DB.prepare('UPDATE newsletter_campaigns SET status=?,sent_count=?,failed_count=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?')
          .bind(status,progress.sent,progress.failed,campaignId).run();
        return json({ ok:true, done:true, campaign:await campaignProgress(env,campaignId) });
      }
      const base = publicBaseUrl(request,env), messages=[];
      for (const row of rows) {
        const token = await createUnsubscribeToken(env,row);
        const unsubscribeUrl = `${base}/api/unsubscribe?id=${row.subscriber_id}&token=${token}`;
        messages.push({
          to:row.email, subject:campaign.subject,
          html:campaignBodyHtml(campaign,row,unsubscribeUrl), text:campaign.body,
          replyTo:env.EMAIL_REPLY_TO,
          headers:{ 'List-Unsubscribe':`<${unsubscribeUrl}>`, 'List-Unsubscribe-Post':'List-Unsubscribe=One-Click' },
          tags:[{name:'campaign_id',value:String(campaignId)},{name:'subscriber_id',value:String(row.subscriber_id)}]
        });
      }
      try {
        const result = await sendEmailBatch(env,messages,`newsletter-${campaignId}-${rows[0].delivery_id}`);
        const ids = Array.isArray(result?.data) ? result.data : [];
        const statements = rows.map((row,index)=>env.DB.prepare("UPDATE newsletter_deliveries SET status='sent',provider_id=?,attempts=attempts+1,sent_at=CURRENT_TIMESTAMP,error='' WHERE id=?")
          .bind(clean(ids[index]?.id,200),row.delivery_id));
        await env.DB.batch(statements);
      } catch (error) {
        const statements = rows.map(row=>env.DB.prepare("UPDATE newsletter_deliveries SET status='failed',attempts=attempts+1,error=? WHERE id=?").bind(clean(error.message,700),row.delivery_id));
        await env.DB.batch(statements);
      }
      const progress = await campaignProgress(env,campaignId), done = progress.pending===0;
      const status = done ? (progress.failed ? (progress.sent ? 'partial':'failed') : 'sent') : 'sending';
      await env.DB.prepare('UPDATE newsletter_campaigns SET status=?,sent_count=?,failed_count=?,completed_at=CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE completed_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .bind(status,progress.sent,progress.failed,done?1:0,campaignId).run();
      return json({ ok:true, done, campaign:await campaignProgress(env,campaignId) });
    }

    if (action === 'retry_failed') {
      const campaignId = integer(body.campaign_id);
      await env.DB.prepare("UPDATE newsletter_deliveries SET status='pending',error='' WHERE campaign_id=? AND status='failed'").bind(campaignId).run();
      await env.DB.prepare("UPDATE newsletter_campaigns SET status='sending',completed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(campaignId).run();
      return json({ ok:true, campaign:await campaignProgress(env,campaignId) });
    }

    return json({ error:'invalid_action' },400);
  } catch (error) {
    return json({ error:'operation_failed', message:error.message },500);
  }
}
