const state = { settings: {}, days: [], songs: [], testimonials: [], currentTrack: -1, filter: 'all', query: '' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[char]);
const mediaUrl = key => key ? `/api/media/${String(key).split('/').map(encodeURIComponent).join('/')}` : '';
const truthy = value => value === '1' || value === 1 || value === true || value === 'true';
const formatNumber = value => new Intl.NumberFormat('he-IL').format(Number(value || 0));
const formatDate = value => {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('he-IL', { day:'numeric', month:'long', year:'numeric' }).format(date);
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { headers: { 'content-type':'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'אירעה תקלה זמנית');
  return data;
}

function toast(message, type = 'success') {
  const region = $('#toast-region');
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  region.append(node);
  setTimeout(() => node.remove(), 4200);
}

function setText(selector, value) {
  const node = $(selector);
  if (node && value !== undefined && value !== null) node.textContent = value;
}

function setLink(node, url, text) {
  if (!node) return;
  if (url) {
    node.href = url;
    node.classList.remove('is-hidden');
    if (text) node.textContent = text;
    if (/^https?:/.test(url)) { node.target = '_blank'; node.rel = 'noopener'; }
  } else node.classList.add('is-hidden');
}

function homepageVideoEmbedUrl(url, autoplay = false, loop = false, controls = true) {
  const text = String(url || '').trim();
  if (!text) return '';
  try {
    const parsed = new URL(text, location.origin);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be' || host.endsWith('youtube.com')) {
      const id = host === 'youtu.be' ? parsed.pathname.slice(1) : parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
      if (!id) return text;
      const params = new URLSearchParams({ rel:'0', playsinline:'1', controls:controls ? '1' : '0' });
      if (autoplay) { params.set('autoplay','1'); params.set('mute','1'); }
      if (loop) { params.set('loop','1'); params.set('playlist', id); }
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params}`;
    }
    if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop();
      if (!id) return text;
      const params = new URLSearchParams({ autoplay:autoplay ? '1' : '0', muted:autoplay ? '1' : '0', loop:loop ? '1' : '0', controls:controls ? '1' : '0' });
      return `https://player.vimeo.com/video/${encodeURIComponent(id)}?${params}`;
    }
  } catch {}
  return text;
}

function homepageMediaType(slot, settings) {
  const configured = settings[`${slot}_media_type`];
  if (['image','video'].includes(configured)) return configured;
  if (settings[`${slot}_video_key`] || settings[`${slot}_video_url`]) return 'video';
  if (settings[`${slot}_image_key`]) return 'image';
  return 'default';
}

function renderHomepageMedia(slot, node, settings) {
  if (!node) return;
  const type = homepageMediaType(slot, settings);
  const title = slot === 'hero' ? (settings.hero_title || settings.camp_name) : (settings.story_title || settings.camp_name);
  node.classList.remove('has-image','has-video');
  if (type === 'image' && settings[`${slot}_image_key`]) {
    node.classList.add('has-image');
    node.innerHTML = `<img src="${mediaUrl(settings[`${slot}_image_key`])}" alt="${escapeHtml(title)}" ${slot === 'hero' ? 'fetchpriority="high"' : 'loading="lazy"'}>`;
    return;
  }
  const videoSource = settings[`${slot}_video_key`] ? mediaUrl(settings[`${slot}_video_key`]) : settings[`${slot}_video_url`] || '';
  if (type === 'video' && videoSource) {
    const autoplay = truthy(settings[`${slot}_video_autoplay`]);
    const loop = truthy(settings[`${slot}_video_loop`]);
    const controls = truthy(settings[`${slot}_video_controls`]) || !autoplay;
    const poster = settings[`${slot}_video_poster_key`] ? mediaUrl(settings[`${slot}_video_poster_key`]) : '';
    const embed = homepageVideoEmbedUrl(videoSource, autoplay, loop, controls);
    const isEmbed = /youtube(?:-nocookie)?\.com\/embed|player\.vimeo\.com\/video/.test(embed);
    node.classList.add('has-video');
    node.innerHTML = isEmbed
      ? `<iframe src="${escapeHtml(embed)}" title="${escapeHtml(title)}" allow="autoplay; fullscreen; picture-in-picture" loading="${slot === 'hero' ? 'eager' : 'lazy'}" allowfullscreen></iframe>`
      : `<video src="${escapeHtml(videoSource)}" ${poster ? `poster="${escapeHtml(poster)}"` : ''} ${autoplay ? 'autoplay muted' : ''} ${loop ? 'loop' : ''} ${controls ? 'controls' : ''} playsinline preload="metadata" aria-label="${escapeHtml(title)}"></video>`;
    return;
  }
  node.classList.remove('has-image','has-video');
  node.innerHTML = slot === 'hero'
    ? `<div class="hero-placeholder"><span>🏕️</span><strong>${escapeHtml(settings.camp_name || 'קעמפ גן ישראל')}</strong><small>${escapeHtml(settings.city || '')}</small></div>`
    : `<span class="story-placeholder">☀️</span>`;
}

function applySettings(settings) {
  state.settings = settings;
  const root = document.documentElement;
  const colorMap = { theme_primary:'--primary', theme_secondary:'--secondary', theme_accent:'--accent', theme_green:'--green', theme_purple:'--purple', theme_bg:'--bg', theme_surface:'--surface' };
  Object.entries(colorMap).forEach(([key, variable]) => { if (/^#[0-9a-f]{6}$/i.test(settings[key] || '')) root.style.setProperty(variable, settings[key]); });
  setText('#brand-name', settings.camp_name); setText('#brand-season', settings.season_label); setText('#footer-name', settings.camp_name); setText('#footer-text', settings.footer_text);
  setText('#hero-kicker', settings.hero_kicker); setText('#hero-text', settings.hero_text); setText('#story-kicker', settings.story_kicker); setText('#story-text', settings.story_text);
  setText('#gallery-title', settings.gallery_title); setText('#gallery-text', settings.gallery_text); setText('#songs-title', settings.songs_title); setText('#songs-text', settings.songs_text);
  setText('#testimonials-title', settings.testimonials_title); setText('#testimonials-text', settings.testimonials_text); setText('#updates-title', settings.updates_title); setText('#updates-text', settings.updates_text);
  setText('#contact-title', settings.contact_title); setText('#contact-text', settings.contact_text);
  $('#hero-title').innerHTML = highlightLast(settings.hero_title || 'הקיץ מתחיל כאן');
  $('#story-title').innerHTML = highlightLast(settings.story_title || 'קיץ של רגעים שלא שוכחים');
  document.title = settings.seo_title || settings.site_title || settings.camp_name;
  $('meta[name="description"]')?.setAttribute('content', settings.seo_description || '');
  $('meta[name="keywords"]')?.setAttribute('content', settings.seo_keywords || '');
  $('meta[property="og:title"]')?.setAttribute('content', settings.seo_title || settings.camp_name || '');
  $('meta[property="og:description"]')?.setAttribute('content', settings.seo_description || '');

  renderHomepageMedia('hero', $('#hero-media'), settings);
  renderHomepageMedia('story', $('#story-photo'), settings);
  if (settings.logo_key) {
    $$('.brand-mark').forEach(mark => { mark.innerHTML = `<img src="${mediaUrl(settings.logo_key)}" alt="" style="width:100%;height:100%;object-fit:contain;padding:5px">`; });
  }
  setLink($('#hero-primary'), settings.hero_primary_button_url || '#galleries', settings.hero_primary_button_text || 'לגלריות');
  setLink($('#hero-secondary'), settings.hero_secondary_button_url || '#latest', settings.hero_secondary_button_text || 'צפו בסרטון');
  $$('.registration-link').forEach(link => setLink(link, settings.registration_button_url, settings.registration_button_text));
  configureContact(settings);
  configureFooter(settings);
  $('#songs')?.classList.toggle('is-hidden', !truthy(settings.show_songs));
  $('#testimonials')?.classList.toggle('is-hidden', !truthy(settings.show_testimonials));
  $('#updates')?.classList.toggle('is-hidden', !truthy(settings.allow_newsletter_signup));
  $('#contact-form')?.classList.toggle('is-hidden', !truthy(settings.allow_contact_form));
  $('#testimonial-open')?.classList.toggle('is-hidden', !truthy(settings.allow_testimonial_submission));
  if (truthy(settings.show_countdown) && settings.countdown_target) startCountdown(settings.countdown_target); else $('#countdown')?.classList.add('is-hidden');
}

function highlightLast(text) {
  const words = String(text).trim().split(/\s+/);
  if (words.length < 2) return escapeHtml(text);
  const last = words.pop();
  return `${escapeHtml(words.join(' '))} <em>${escapeHtml(last)}</em>`;
}

function configureContact(settings) {
  const phone = $('#contact-phone');
  if (settings.phone) { phone.href = `tel:${settings.phone.replace(/[^+\d]/g,'')}`; $('strong', phone).textContent = settings.phone; phone.classList.remove('is-hidden'); }
  const whatsapp = $('#contact-whatsapp');
  if (settings.whatsapp) { const digits = settings.whatsapp.replace(/\D/g,'').replace(/^0/,'972'); whatsapp.href = `https://wa.me/${digits}`; whatsapp.target='_blank'; whatsapp.rel='noopener'; whatsapp.classList.remove('is-hidden'); }
  const email = $('#contact-email');
  if (settings.email) { email.href = `mailto:${settings.email}`; $('strong', email).textContent = settings.email; email.classList.remove('is-hidden'); }
  const address = $('#contact-address');
  if (settings.address) { $('strong', address).textContent = settings.address; address.classList.remove('is-hidden'); if (settings.map_url) { address.style.cursor='pointer'; address.addEventListener('click',()=>window.open(settings.map_url,'_blank','noopener')); } }
}

function configureFooter(settings) {
  const social = $('#social-links');
  const items = [ ['instagram_url','IG'], ['youtube_url','▶'], ['facebook_url','f'] ].filter(([key]) => settings[key]);
  social.innerHTML = items.map(([key,label]) => `<a href="${escapeHtml(settings[key])}" target="_blank" rel="noopener" aria-label="${label}">${label}</a>`).join('');
  const logoKeys = ['footer_logo_1_key','footer_logo_2_key','footer_logo_3_key'].filter(key => settings[key]);
  $('#footer-logos').innerHTML = logoKeys.map(key => `<img src="${mediaUrl(settings[key])}" alt="לוגו שותף" loading="lazy">`).join('');
}

function renderAnnouncement(announcement) {
  if (!announcement || sessionStorage.getItem(`announcement-${announcement.id}`) === 'closed') return;
  const box = $('#announcement');
  box.dataset.tone = announcement.tone;
  setText('#announcement-title', announcement.title); setText('#announcement-body', announcement.body);
  setLink($('#announcement-link'), announcement.button_url, announcement.button_text);
  box.classList.remove('is-hidden');
  $('#announcement-close').onclick = () => { box.classList.add('is-hidden'); sessionStorage.setItem(`announcement-${announcement.id}`, 'closed'); };
}

function renderStats(totals) {
  setText('#stat-days', formatNumber(totals.days)); setText('#stat-photos', formatNumber(totals.photos)); setText('#stat-videos', formatNumber(totals.videos)); setText('#stat-songs', formatNumber(totals.songs));
}

function renderLatest(day) {
  const card = $('#latest-card');
  if (!day) return;
  const src = day.cover_url || '';
  card.innerHTML = `<div class="latest-media">${src ? `<img src="${src}" alt="${escapeHtml(day.title)}" loading="lazy">` : `<div class="hero-placeholder"><span>📸</span><strong>${escapeHtml(day.title)}</strong></div>`}${day.video_src ? '<span class="day-card-play">▶</span>' : ''}</div><div class="latest-content"><span class="pill">${escapeHtml(day.label || 'היום האחרון')}</span><h3>${escapeHtml(day.title)}</h3><p>${escapeHtml(day.description || 'כל הרגעים, החיוכים והחוויות של היום מחכים לכם בגלריה.')}</p><div class="latest-meta"><span>📅 ${escapeHtml(day.hebrew_date || formatDate(day.date) || '')}</span><span>📸 ${formatNumber(day.photo_count)} תמונות</span></div><a class="button button-primary" href="/day.html?slug=${encodeURIComponent(day.slug)}">פתיחת הגלריה</a></div>`;
}

function dayCard(day) {
  const image = day.cover_url ? `<img src="${day.cover_url}" alt="${escapeHtml(day.title)}" loading="lazy">` : `<div class="hero-placeholder"><span>🏕️</span><strong>${escapeHtml(day.title)}</strong></div>`;
  return `<a class="day-card" href="/day.html?slug=${encodeURIComponent(day.slug)}" data-title="${escapeHtml(`${day.title} ${day.label} ${day.date} ${day.hebrew_date}`.toLowerCase())}" data-photos="${Number(day.photo_count)>0}" data-video="${Boolean(day.video_src || Number(day.video_count)>0)}"><div class="day-card-image">${image}<span class="day-card-badge">${escapeHtml(day.label || day.hebrew_date || formatDate(day.date) || 'יום בקעמפ')}</span>${day.video_src ? '<span class="day-card-play">▶</span>' : ''}</div><div class="day-card-body"><h3>${escapeHtml(day.title)}</h3><p>${escapeHtml(day.description || 'גלריית התמונות והסרטונים של היום')}</p><div class="day-card-footer"><span>📸 ${formatNumber(day.photo_count)} תמונות</span><span>לגלריה ←</span></div></div></a>`;
}

function renderDays(days) {
  state.days = days;
  const grid = $('#days-grid');
  grid.innerHTML = days.map(dayCard).join('');
  filterDays();
}

function filterDays() {
  const cards = $$('.day-card', $('#days-grid'));
  let visible = 0;
  cards.forEach(card => {
    const matchSearch = !state.query || card.dataset.title.includes(state.query.toLowerCase());
    const matchFilter = state.filter === 'all' || (state.filter === 'photos' && card.dataset.photos === 'true') || (state.filter === 'video' && card.dataset.video === 'true');
    card.classList.toggle('is-hidden', !(matchSearch && matchFilter));
    if (matchSearch && matchFilter) visible += 1;
  });
  $('#days-empty').classList.toggle('is-hidden', visible > 0);
}

function renderTestimonials(items) {
  state.testimonials = items;
  if (!items.length) return;
  $('#testimonials-track').innerHTML = items.map(item => `<article class="testimonial-card"><div class="stars">${'★'.repeat(Number(item.rating)||5)}${'☆'.repeat(5-(Number(item.rating)||5))}</div><p>“${escapeHtml(item.message)}”</p><footer><span class="testimonial-avatar">${escapeHtml((item.name||'ה').slice(0,1))}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.relation || 'משפחת הקעמפ')}</small></div></footer></article>`).join('');
}

function renderSongs(songs) {
  state.songs = songs;
  const list = $('#playlist');
  if (!songs.length) return;
  list.innerHTML = songs.map((song,index) => `<button class="playlist-item" data-track="${index}"><span class="playlist-number">${index+1}</span><span class="playlist-copy"><strong>${escapeHtml(song.title || song.original_name || `המנון ${index+1}`)}</strong><small>${escapeHtml(song.caption || 'קעמפ גן ישראל חדרה')}</small></span><span>▶</span></button>`).join('');
  $$('.playlist-item', list).forEach(button => button.addEventListener('click', () => loadTrack(Number(button.dataset.track), true)));
  loadTrack(0, false);
}

function loadTrack(index, autoplay) {
  if (!state.songs.length) return;
  state.currentTrack = (index + state.songs.length) % state.songs.length;
  const song = state.songs[state.currentTrack], audio = $('#audio-player');
  audio.src = song.url || mediaUrl(song.object_key); setText('#track-title', song.title || song.original_name || `המנון ${state.currentTrack+1}`); setText('#track-subtitle', song.caption || state.settings.camp_name);
  $$('.playlist-item').forEach((item,i)=>item.classList.toggle('active',i===state.currentTrack));
  if (autoplay) audio.play().catch(()=>{});
}

function initPlayer() {
  const audio = $('#audio-player'), player = $('#music-player'), play = $('#play-track'), progress = $('#audio-progress');
  play.addEventListener('click',()=>{ if(!audio.src)return; audio.paused?audio.play():audio.pause(); });
  audio.addEventListener('play',()=>{player.classList.add('playing');play.textContent='❚❚';});
  audio.addEventListener('pause',()=>{player.classList.remove('playing');play.textContent='▶';});
  audio.addEventListener('timeupdate',()=>{ const percent=audio.duration?audio.currentTime/audio.duration*100:0;progress.value=percent;setText('#current-time',formatTime(audio.currentTime));setText('#duration-time',formatTime(audio.duration)); });
  audio.addEventListener('ended',()=>{ if(audio.loop)audio.play();else loadTrack(state.currentTrack+1,true); });
  progress.addEventListener('input',()=>{if(audio.duration)audio.currentTime=Number(progress.value)/100*audio.duration;});
  $('#prev-track').addEventListener('click',()=>loadTrack(state.currentTrack-1,true)); $('#next-track').addEventListener('click',()=>loadTrack(state.currentTrack+1,true));
  $('#loop-track').addEventListener('click',event=>{audio.loop=!audio.loop;event.currentTarget.classList.toggle('active',audio.loop);});
  $('#audio-volume').addEventListener('input',event=>{audio.volume=Number(event.target.value);}); audio.volume=.8;
}

function formatTime(seconds) { if(!Number.isFinite(seconds))return '0:00'; return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`; }

function initForms() {
  const bind = (formSelector, endpoint, transform, successAction) => {
    const form = $(formSelector); if(!form)return;
    form.addEventListener('submit',async event=>{
      event.preventDefault(); const button=$('button[type="submit"]',form),status=$('.form-status',form); button.disabled=true; status.textContent='שולח...'; status.className='form-status';
      try{ const values=Object.fromEntries(new FormData(form)); const payload=transform(values,form); const data=await fetchJson(endpoint,{method:'POST',body:JSON.stringify(payload)}); status.textContent=data.message||'נשלח בהצלחה';status.classList.add('success');form.reset();successAction?.();toast(data.message||'נשלח בהצלחה'); }
      catch(error){status.textContent=error.message;status.classList.add('error');toast(error.message,'error');}
      finally{button.disabled=false;}
    });
  };
  bind('#subscribe-form','/api/subscribe',(v,f)=>({...v,consent:$('[name="consent"]',f).checked}));
  bind('#contact-form','/api/contact',v=>v);
  bind('#testimonial-form','/api/testimonials',(v)=>({...v,rating:Number(v.rating)||5}),()=>setTimeout(()=>$('#testimonial-modal').close(),900));
}

function initInteractions() {
  const header=$('#site-header'); window.addEventListener('scroll',()=>{header.classList.toggle('scrolled',scrollY>10);$('#back-to-top').classList.toggle('visible',scrollY>650);},{passive:true});
  $('#back-to-top').addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
  const menu=$('#menu-button'),nav=$('#mobile-nav'); menu.addEventListener('click',()=>{const open=menu.classList.toggle('active');nav.classList.toggle('open',open);menu.setAttribute('aria-expanded',String(open));}); $$('#mobile-nav a').forEach(a=>a.addEventListener('click',()=>{menu.classList.remove('active');nav.classList.remove('open');menu.setAttribute('aria-expanded','false');}));
  $('#gallery-search').addEventListener('input',event=>{state.query=event.target.value.trim();filterDays();});
  $$('.filter-chips .chip').forEach(button=>button.addEventListener('click',()=>{$$('.filter-chips .chip').forEach(x=>x.classList.remove('active'));button.classList.add('active');state.filter=button.dataset.filter;filterDays();}));
  $('#testimonial-open').addEventListener('click',()=>$('#testimonial-modal').showModal());
  $$('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog')?.close()));
  $('#search-open').addEventListener('click',()=>{renderSearch('');$('#search-modal').showModal();setTimeout(()=>$('#global-search-input').focus(),50);});
  $('#search-close').addEventListener('click',()=>$('#search-modal').close());
  $('#global-search-input').addEventListener('input',event=>renderSearch(event.target.value));
  $('#search-modal').addEventListener('click',event=>{if(event.target===$('#search-modal'))$('#search-modal').close();});
  initTheme(); initReveals();
}

function renderSearch(query) {
  const q=query.trim().toLowerCase(); const results=q?state.days.filter(day=>`${day.title} ${day.label} ${day.date} ${day.hebrew_date} ${day.description}`.toLowerCase().includes(q)):state.days.slice(0,6);
  $('#global-search-results').innerHTML=results.length?results.map(day=>`<a class="search-result" href="/day.html?slug=${encodeURIComponent(day.slug)}">${day.cover_url?`<img src="${day.cover_url}" alt="">`:'<span class="stat-icon">📷</span>'}<div><strong>${escapeHtml(day.title)}</strong><small>${escapeHtml(day.hebrew_date||formatDate(day.date)||`${day.photo_count||0} תמונות`)}</small></div></a>`).join(''):'<div class="empty-state"><span>🔎</span><h3>לא נמצאו תוצאות</h3></div>';
}

function initTheme() {
  const stored=localStorage.getItem('camp-theme'); if(stored==='dark'||(!stored&&matchMedia('(prefers-color-scheme:dark)').matches))document.body.classList.add('dark');
  $('#theme-toggle').addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('camp-theme',document.body.classList.contains('dark')?'dark':'light');});
}

function initReveals() {
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.style.transitionDelay=`${entry.target.dataset.delay||0}ms`;entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.12});
  $$('.reveal').forEach(node=>observer.observe(node));
}

function startCountdown(target) {
  const date=new Date(target);if(Number.isNaN(date.getTime()))return;const box=$('#countdown');box.classList.remove('is-hidden');
  const update=()=>{const diff=Math.max(0,date-Date.now());const days=Math.floor(diff/86400000),hours=Math.floor(diff/3600000)%24,minutes=Math.floor(diff/60000)%60,seconds=Math.floor(diff/1000)%60;setText('#count-days',String(days).padStart(2,'0'));setText('#count-hours',String(hours).padStart(2,'0'));setText('#count-minutes',String(minutes).padStart(2,'0'));setText('#count-seconds',String(seconds).padStart(2,'0'));if(diff<=0)clearInterval(timer);};update();const timer=setInterval(update,1000);
}

async function track(page='/',event='view') { try{await fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({page,event}),keepalive:true});}catch{} }

async function boot() {
  setText('#current-year',new Date().getFullYear()); initPlayer(); initForms(); initInteractions();
  try {
    const data=await fetchJson('/api/site');
    applySettings(data.settings||{});renderAnnouncement(data.announcement);renderStats(data.totals||{});renderLatest(data.latest_day);renderDays(data.days||[]);renderSongs(data.songs||[]);renderTestimonials(data.testimonials||[]);
    if(data.setup?.required) console.info('Camp setup required',data.setup);
  } catch(error) { toast('האתר נטען במצב בסיסי. נסו לרענן בעוד רגע.','error'); renderDays([]); }
  finally { $('#site-loader').classList.add('loaded'); track(location.pathname); }
  if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

document.addEventListener('DOMContentLoaded',boot);
