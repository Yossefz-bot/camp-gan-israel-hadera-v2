import { audit, clean, integer, json, safeKeyPart, statusValue } from '../_shared.js';
import { requireAdmin } from './_auth.js';

const ALLOWED_MIME = new Map([
  ['image/jpeg','image'],['image/png','image'],['image/webp','image'],['image/gif','image'],['image/avif','image'],
  ['video/mp4','video'],['video/x-m4v','video'],['application/mp4','video'],['video/webm','video'],['video/quicktime','video'],
  ['audio/mpeg','audio'],['audio/mp4','audio'],['audio/wav','audio'],['audio/x-wav','audio'],['audio/ogg','audio'],
  ['application/pdf','document']
]);

export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env, { csrf: true });
  if (auth.response) return auth.response;
  if (!env.DB) return json({ error: 'db_binding_missing' }, 503);
  if (!env.MEDIA) return json({ error: 'r2_binding_missing' }, 503);

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size <= 0) return json({ error: 'file_required', message: 'לא נבחר קובץ.' }, 400);
    const maxMb = Math.min(500, Math.max(5, Number(env.MAX_UPLOAD_MB) || 95));
    if (file.size > maxMb * 1024 * 1024) return json({ error: 'file_too_large', message: `הקובץ גדול מהמגבלה של ${maxMb}MB.` }, 413);
    const detectedKind = ALLOWED_MIME.get(file.type);
    const requestedKind = clean(form.get('kind'), 20);
    const kind = requestedKind === 'auto' || !requestedKind ? detectedKind : statusValue(requestedKind,['image','video','audio','document'],detectedKind);
    if (!detectedKind || !kind) return json({ error: 'unsupported_file', message: 'סוג הקובץ אינו נתמך.' }, 415);

    const dayId = integer(form.get('day_id')) || null;
    const day = dayId ? await env.DB.prepare('SELECT id,cover_key FROM days WHERE id=?').bind(dayId).first() : null;
    if (dayId && !day) return json({ error: 'day_not_found', message: 'היום שנבחר לא נמצא.' }, 400);
    const category = clean(form.get('category'), 60) || (kind === 'audio' ? 'song' : dayId ? 'gallery' : 'general');
    const title = clean(form.get('title'), 240) || file.name.replace(/\.[^.]+$/, '');
    const status = statusValue(form.get('status'), ['draft','published','archived'], 'published');
    const safeName = safeKeyPart(file.name);
    const prefix = dayId ? `days/${dayId}` : `general/${category}`;
    const key = `${prefix}/${kind}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${safeName}`;

    await env.MEDIA.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream', cacheControl: 'public,max-age=31536000,immutable' },
      customMetadata: { originalName: file.name, category, kind, dayId: dayId ? String(dayId) : '' }
    });

    try {
      const result = await env.DB.prepare(`INSERT INTO media(day_id,kind,category,title,original_name,alt_text,caption,object_key,mime_type,size_bytes,status,is_featured,sort_order,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,0,0,CURRENT_TIMESTAMP)`)
        .bind(dayId,kind,category,title,file.name,clean(form.get('alt_text'),500),clean(form.get('caption'),1500),key,file.type||'',file.size,status).run();
      if (dayId && kind === 'image' && !day.cover_key) {
        await env.DB.batch([
          env.DB.prepare('UPDATE days SET cover_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND cover_key=\'\'').bind(key,dayId),
          env.DB.prepare('UPDATE media SET is_featured=1 WHERE id=?').bind(result.meta.last_row_id)
        ]);
      }
      await audit(env, 'upload_media', 'media', String(result.meta.last_row_id), file.name);
      const warning = kind === 'video' && !['video/mp4','video/x-m4v','application/mp4','video/quicktime'].includes(file.type)
        ? 'לתאימות מלאה באייפון מומלץ להעלות סרטון MP4 בקידוד H.264 עם שמע AAC.'
        : '';
      return json({ ok: true, warning, item: { id: result.meta.last_row_id, object_key: key, url: `/api/media/${key.split('/').map(encodeURIComponent).join('/')}`, kind, title, original_name: file.name, size_bytes: file.size } });
    } catch (error) {
      await env.MEDIA.delete(key).catch(() => null);
      throw error;
    }
  } catch (error) {
    return json({ error: 'upload_failed', message: error.message }, 500);
  }
}
