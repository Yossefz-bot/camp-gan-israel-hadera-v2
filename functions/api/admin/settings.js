import { authorized, denied } from './_auth.js';
import { json, body, clean } from './_helpers.js';

const KEYS = [
  'site_title','camp_name','city','phone','whatsapp','email','address',
  'hero_kicker','hero_title','hero_text','hero_image_key',
  'registration_video_url','registration_video_aspect','registration_button_text','registration_button_url',
  'story_kicker','story_title','story_text','story_image_key',
  'gallery_title','gallery_text','songs_title','songs_text','testimonials_title','testimonials_text',
  'updates_title','updates_text','contact_title','contact_text',
  'logo_key','footer_logo_1_key','footer_logo_2_key','footer_logo_3_key','footer_text',
  'theme_primary','theme_secondary','theme_accent','theme_bg','theme_surface',
  'seo_title','seo_description','seo_keywords','gallery_sort'
];
async function getSettings(env){
  const rows=await env.DB.prepare('SELECT key,value FROM settings').all();
  return Object.fromEntries((rows.results||[]).map(r=>[r.key,r.value]));
}
export async function onRequest({request,env}){
  if(!authorized(request,env))return denied();
  try{
    if(request.method==='GET')return json({settings:await getSettings(env)});
    if(request.method==='PUT'){
      const b=await body(request), statements=[];
      for(const key of KEYS){
        if(Object.prototype.hasOwnProperty.call(b,key)){
          const long = key.includes('text') || key.includes('description');
          statements.push(env.DB.prepare(`INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).bind(key,clean(b[key],long?5000:1500)));
        }
      }
      if(statements.length)await env.DB.batch(statements);
      return json({ok:true,settings:await getSettings(env)});
    }
    return json({error:'Method not allowed'},405);
  }catch(error){return json({error:error.message},500)}
}
