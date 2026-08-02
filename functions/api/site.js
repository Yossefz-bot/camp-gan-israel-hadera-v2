import { DEFAULT_SETTINGS, json, loadSettings, mediaUrl, setupState } from './_shared.js';

function decorateDay(day) {
  const coverKey = day.cover_key || day.fallback_cover_key || '';
  const videoKey = day.configured_video_key || (!day.video_url ? day.fallback_video_key : '') || '';
  return {
    ...day,
    cover_key: coverKey,
    cover_url: mediaUrl(coverKey),
    video_key: videoKey,
    video_src: videoKey ? mediaUrl(videoKey) : day.video_url || ''
  };
}

function decorateMedia(item) {
  return { ...item, url: mediaUrl(item.object_key), download_url: mediaUrl(item.object_key, true) };
}

export async function onRequestGet({ env }) {
  const fallback = {
    settings: { ...DEFAULT_SETTINGS }, days: [], latest_day: null, announcement: null,
    songs: [], testimonials: [], hero_slides: [], totals: { days: 0, photos: 0, videos: 0, songs: 0 },
    setup: { required: true, db_binding: Boolean(env.DB), r2_binding: Boolean(env.MEDIA), database_ready: false }
  };
  if (!env.DB) return json(fallback, 200, { 'cache-control': 'public,max-age=15' });

  try {
    const [settings, daysResult, announcement, songsResult, testimonialsResult, slidesResult, textOverridesResult, totals] = await Promise.all([
      loadSettings(env),
      env.DB.prepare(`
        SELECT d.*,
          (SELECT COUNT(*) FROM media m WHERE m.day_id=d.id AND m.status='published') AS media_count,
          (SELECT COUNT(*) FROM media m WHERE m.day_id=d.id AND m.kind='image' AND m.status='published') AS photo_count,
          (SELECT COUNT(*) FROM media m WHERE m.day_id=d.id AND m.kind='video' AND m.status='published') AS video_count,
          (SELECT object_key FROM media m WHERE m.day_id=d.id AND m.kind='image' AND m.status='published' ORDER BY m.is_featured DESC,m.sort_order,m.id LIMIT 1) AS fallback_cover_key,
          (SELECT object_key FROM media m WHERE m.day_id=d.id AND m.kind='video' AND m.status='published' AND m.object_key=d.video_key LIMIT 1) AS configured_video_key,
          (SELECT object_key FROM media m WHERE m.day_id=d.id AND m.kind='video' AND m.status='published' ORDER BY m.is_featured DESC,m.sort_order,m.id LIMIT 1) AS fallback_video_key
        FROM days d
        WHERE d.status='published'
        ORDER BY d.sort_order ASC, CASE WHEN d.date='' THEN 1 ELSE 0 END, d.date DESC, d.id DESC
      `).all(),
      env.DB.prepare(`
        SELECT * FROM announcements
        WHERE status='published'
          AND (starts_at='' OR starts_at<=datetime('now'))
          AND (ends_at='' OR ends_at>=datetime('now'))
        ORDER BY id DESC LIMIT 1
      `).first(),
      env.DB.prepare("SELECT * FROM media WHERE kind='audio' AND status='published' ORDER BY sort_order,id").all(),
      env.DB.prepare("SELECT id,name,relation,rating,message FROM testimonials WHERE status='approved' ORDER BY sort_order,id DESC LIMIT 24").all(),
      env.DB.prepare("SELECT * FROM homepage_slides WHERE status='published' ORDER BY sort_order,id").all().catch(() => ({ results: [] })),
      env.DB.prepare("SELECT selector,value FROM text_overrides ORDER BY selector").all().catch(()=>({results:[]})),
      env.DB.prepare(`SELECT
        (SELECT COUNT(*) FROM days WHERE status='published') AS days,
        (SELECT COUNT(*) FROM media WHERE kind='image' AND status='published') AS photos,
        (SELECT COUNT(*) FROM media WHERE kind='video' AND status='published') AS videos,
        (SELECT COUNT(*) FROM media WHERE kind='audio' AND status='published') AS songs
      `).first()
    ]);
    const days = (daysResult.results || []).map(decorateDay);
    return json({
      settings,
      days,
      latest_day: days[0] || null,
      announcement,
      songs: (songsResult.results || []).map(decorateMedia),
      testimonials: testimonialsResult.results || [],
      text_overrides: textOverridesResult.results||[],
      hero_slides: (slidesResult.results || []).map(item => ({ ...item, url: mediaUrl(item.object_key), poster_url: mediaUrl(item.poster_key) })),
      totals: totals || { days: 0, photos: 0, videos: 0, songs: 0 },
      setup: { required: !env.MEDIA, db_binding: true, r2_binding: Boolean(env.MEDIA), database_ready: true }
    }, 200, { 'cache-control': 'public,max-age=60,stale-while-revalidate=300' });
  } catch (error) {
    console.error('site api', error);
    return json({ ...fallback, setup: setupState(error, env) }, 200, { 'cache-control': 'public,max-age=10' });
  }
}
