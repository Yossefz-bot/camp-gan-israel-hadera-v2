export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ error: 'db_binding_missing' }, { status: 503 });
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS faq_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      visible INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();
    const rows = await env.DB.prepare(`SELECT id,question,answer,sort_order,visible FROM faq_items WHERE visible=1 ORDER BY sort_order ASC,id ASC`).all();
    return Response.json({ faq: (rows.results||[]).map(x=>({...x,visible:Boolean(x.visible)})) }, { headers:{'cache-control':'public, max-age=60'} });
  } catch (error) {
    return Response.json({ error:'faq_load_failed', message:error.message }, { status:500 });
  }
}
