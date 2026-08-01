import { audit, clean, isHttpUrl, json, loadSettings, parseJson } from '../_shared.js';
import { requireAdmin } from './_auth.js';

const ALLOWED_KEYS = new Set([
  'site_title','camp_name','city','season_label','phone','whatsapp','email','address','map_url','instagram_url','youtube_url','facebook_url',
  'hero_kicker','hero_title','hero_text','hero_media_type','hero_image_key','hero_video_key','hero_video_url','hero_video_poster_key','hero_video_autoplay','hero_video_loop','hero_video_controls','hero_primary_button_text','hero_primary_button_url','hero_secondary_button_text','hero_secondary_button_url',
  'registration_button_text','registration_button_url','countdown_target','story_kicker','story_title','story_text','story_media_type','story_image_key','story_video_key','story_video_url','story_video_poster_key','story_video_autoplay','story_video_loop','story_video_controls','record_center_image_key','logo_key','footer_logo_1_key','footer_logo_2_key','footer_logo_3_key','footer_text',
  'gallery_title','gallery_text','songs_title','songs_text','testimonials_title','testimonials_text','updates_title','updates_text','contact_title','contact_text',
  'theme_primary','theme_secondary','theme_accent','theme_green','theme_purple','theme_bg','theme_surface','seo_title','seo_description','seo_keywords','gallery_sort',
  'show_testimonials','show_songs','show_countdown','allow_testimonial_submission','allow_newsletter_signup','allow_contact_form'
]);

function validColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export async function onRequest({ request, env }) {
  const mutating = request.method !== 'GET';
  const auth = await requireAdmin(request, env, { csrf: mutating });
  if (auth.response) return auth.response;
  if (!env.DB) return json({ error: 'db_binding_missing' }, 503);

  if (request.method === 'GET') {
    try { return json({ settings: await loadSettings(env) }); }
    catch (error) { return json({ error: 'database_not_ready', message: error.message }, 503); }
  }
  if (request.method !== 'PATCH') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, PATCH' });

  const body = await parseJson(request);
  const input = body.settings && typeof body.settings === 'object' ? body.settings : body;
  const entries = [];
  for (const [key, raw] of Object.entries(input)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    let value = clean(raw, key.includes('text') || key.includes('description') ? 12000 : 1600);
    if (key.startsWith('theme_') && !validColor(value)) return json({ error: 'invalid_color', message: `הצבע ${key} אינו תקין.` }, 400);
    if ((key.endsWith('_url') || key === 'map_url') && !isHttpUrl(value, true)) return json({ error: 'invalid_url', message: `הקישור ${key} אינו תקין.` }, 400);
    if (['show_testimonials','show_songs','show_countdown','allow_testimonial_submission','allow_newsletter_signup','allow_contact_form','hero_video_autoplay','hero_video_loop','hero_video_controls','story_video_autoplay','story_video_loop','story_video_controls'].includes(key)) value = value === '1' || value === 'true' ? '1' : '0';
    if (['hero_media_type','story_media_type'].includes(key)) value = ['default','image','video','slideshow'].includes(value) ? value : 'default';
    if (key === 'gallery_sort') value = value === 'newest' ? 'newest' : 'oldest';
    entries.push([key, value]);
  }
  if (!entries.length) return json({ error: 'nothing_to_update' }, 400);
  const statements = entries.map(([key, value]) => env.DB.prepare(`INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).bind(key,value));
  await env.DB.batch(statements);
  await audit(env, 'update_settings', 'settings', '', `${entries.length} keys`);
  return json({ ok: true, settings: await loadSettings(env) });
}
