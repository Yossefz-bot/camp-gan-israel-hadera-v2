export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim().slice(0,120);
    const phone = String(body.phone || '').trim().slice(0,40);
    const digits = phone.replace(/\D/g,'');
    if (name.length < 2) return Response.json({ error:'יש להזין שם מלא' }, { status:400 });
    if (digits.length < 9 || digits.length > 15) return Response.json({ error:'מספר הטלפון אינו תקין' }, { status:400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error:'אימייל לא תקין' }, { status:400 });
    if (body.consent !== true) return Response.json({ error:'יש לאשר קבלת עדכונים' }, { status:400 });
    await env.DB.prepare(`INSERT INTO subscribers(name,phone,email,status,source,consent,updated_at) VALUES(?,?,?,'active','אתר הקעמפ',1,CURRENT_TIMESTAMP)
      ON CONFLICT(email) DO UPDATE SET name=excluded.name,phone=excluded.phone,status='active',source='אתר הקעמפ',consent=1,updated_at=CURRENT_TIMESTAMP`)
      .bind(name,phone,email).run();
    return Response.json({ ok:true });
  } catch (error) { return Response.json({ error:error.message }, { status:500 }); }
}
