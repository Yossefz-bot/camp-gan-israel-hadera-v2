import { authorized, denied } from './_auth.js';
import { json, clean, integer, safeKeyPart, validStatus } from './_helpers.js';
export async function onRequestPost({ request, env }) {
  if (!authorized(request, env)) return denied();
  try {
    const form=await request.formData();
    let files=form.getAll('files').filter(f=>f instanceof File && f.size>0); const single=form.get('file'); if(!files.length&&single instanceof File&&single.size>0)files=[single];
    if(!files.length)return json({error:'לא נבחרו קבצים'},400);
    const dayId=integer(form.get('day_id'))||null, kind=validStatus(clean(form.get('kind'),20),['image','video','audio'],'image'), category=clean(form.get('category'),40)||(kind==='audio'?'song':dayId?'gallery':'general'), commonTitle=clean(form.get('title'),240);
    const day=dayId?await env.DB.prepare('SELECT id,cover_key FROM days WHERE id=?').bind(dayId).first():null; if(dayId&&!day)return json({error:'היום שנבחר לא נמצא'},400);
    const items=[];
    for(const file of files.slice(0,200)){
      const safeName=safeKeyPart(file.name), prefix=dayId?`days/${dayId}`:`general/${category}`, key=`${prefix}/${kind}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      await env.MEDIA.put(key,file.stream(),{httpMetadata:{contentType:file.type||'application/octet-stream'},customMetadata:{originalName:file.name,category}});
      const result=await env.DB.prepare(`INSERT INTO media(day_id,kind,category,title,original_name,object_key,mime_type,size_bytes,is_published,sort_order,updated_at) VALUES(?,?,?,?,?,?,?,?,1,0,CURRENT_TIMESTAMP)`)
        .bind(dayId,kind,category,commonTitle||file.name.replace(/\.[^.]+$/,''),file.name,key,file.type||'',file.size).run();
      items.push({id:result.meta.last_row_id,key,name:file.name,url:`/api/media/${key}`});
      if(dayId&&kind==='image'&&!day.cover_key){await env.DB.prepare('UPDATE days SET cover_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND (cover_key IS NULL OR cover_key=\'\')').bind(key,dayId).run();day.cover_key=key}
    }
    return json({ok:true,items});
  }catch(error){return json({error:error.message},500)}
}
