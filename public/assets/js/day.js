// Gallery stable build v13.2.0
const state={slug:'',day:null,media:[],visible:[],nextOffset:0,kind:'all',favorites:new Set(JSON.parse(localStorage.getItem('camp-favorites')||'[]')),lightboxIndex:0,summaryVideoId:null,summaryVideoSrc:''};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const escapeHtml=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);
const formatNumber=v=>new Intl.NumberFormat('he-IL').format(Number(v||0));
async function fetchJson(url){const r=await fetch(url);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||d.error||'אירעה תקלה');return d}
function toast(message,type='success'){const n=document.createElement('div');n.className=`toast ${type}`;n.textContent=message;($('#toast-region')||document.body).append(n);setTimeout(()=>n.remove(),3500)}
function setText(s,v){const n=$(s);if(n)n.textContent=v??''}
function saveFavorites(){localStorage.setItem('camp-favorites',JSON.stringify([...state.favorites]));updateCounts()}
function updateCounts(){setText('#favorites-count',state.favorites.size)}
function formatDate(value){if(!value)return'';const d=new Date(`${value}T12:00:00`);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('he-IL',{day:'numeric',month:'long',year:'numeric'}).format(d)}
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function videoProvider(src){
  const text=String(src||'').trim();
  const youtube=text.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/i);
  const vimeo=text.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if(youtube)return {kind:'iframe',src:`https://www.youtube-nocookie.com/embed/${youtube[1]}?playsinline=1&rel=0`};
  if(vimeo)return {kind:'iframe',src:`https://player.vimeo.com/video/${vimeo[1]}`};
  return {kind:'native',src:text};
}
function videoFallback(src,message='לא הצלחנו להפעיל את הסרטון במכשיר הזה.'){
  const box=document.createElement('div');
  box.className='video-playback-fallback is-hidden';
  const text=document.createElement('p');text.textContent=message;
  const link=document.createElement('a');link.className='button button-light';link.href=src;link.target='_blank';link.rel='noopener';link.textContent='פתיחת הסרטון בנגן המכשיר';
  box.append(text,link);return box;
}
function mountNativeVideo(container,src,{poster='',muted=false,loop=false,autoplay=false,label='סרטון'}={}){
  if(!container||!src)return null;
  container.replaceChildren();
  const video=document.createElement('video');
  video.controls=true;
  video.preload='metadata';
  video.playsInline=true;
  video.setAttribute('playsinline','');
  video.setAttribute('webkit-playsinline','');
  video.setAttribute('x-webkit-airplay','allow');
  video.setAttribute('controlslist','nodownload');
  video.setAttribute('aria-label',label);
  video.muted=Boolean(muted);
  video.loop=Boolean(loop);
  if(poster)video.poster=poster;
  video.src=src;
  const fallback=videoFallback(src);
  const showError=()=>fallback.classList.remove('is-hidden');
  video.addEventListener('loadedmetadata',()=>fallback.classList.add('is-hidden'),{once:true});
  video.addEventListener('error',showError);
  container.append(video,fallback);
  video.load();
  if(autoplay&&!isIOS){video.play().catch(()=>{});}
  return video;
}
function showSummaryVideo(src,aspect='landscape'){
  if(!src)return;
  const section=$('#day-video-section'),wrap=$('#day-video-wrap');
  if(!section||!wrap)return;
  state.summaryVideoSrc=String(src);
  section.classList.remove('is-hidden');
  wrap.className=`day-video-wrap ${aspect==='portrait'?'portrait':aspect==='square'?'square':''}`;
  const provider=videoProvider(src);
  if(provider.kind==='iframe'){
    wrap.innerHTML=`<iframe src="${escapeHtml(provider.src)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="סרטון היום"></iframe>`;
    return;
  }
  mountNativeVideo(wrap,provider.src,{label:'סרטון הסיכום'});
}
function renderDay(day,total){
  state.day=day;
  document.title=`${day.title} | קעמפ גן ישראל חדרה`;
  setText('#day-title',day.title);
  setText('#day-label',day.label||'יום בקעמפ');
  setText('#day-date',day.hebrew_date||formatDate(day.date));
  setText('#day-count',`${formatNumber(total)} פריטים`);
  setText('#day-description',day.description||'כל הרגעים, החוויות והחיוכים של היום.');
  if(day.cover_url&&$('#day-cover'))$('#day-cover').style.backgroundImage=`url("${day.cover_url.replace(/"/g,'%22')}")`;
  if(day.video_src)showSummaryVideo(day.video_src,day.video_aspect||'landscape');
  if(day.story){
    const section=$('#day-story-section');
    if(section)section.classList.remove('is-hidden');
    setText('#day-story',day.story);
  }
}
function normalizeComparable(value){
  return decodeURIComponent(String(value||''))
    .replace(/^https?:\/\/[^/]+/i,'')
    .replace(/^\/api\/media\//,'')
    .replace(/[?#].*$/,'')
    .replace(/^\/+|\/+$/g,'')
    .toLowerCase();
}
function isSummaryVideo(item){
  if(!item||item.kind!=='video')return false;

  const title=String(item.title||item.original_name||'');
  const category=String(item.category||'');
  if(/סיכום|summary/i.test(`${title} ${category}`))return true;

  const configured=normalizeComparable(state.summaryVideoSrc||state.day?.video_src);
  if(!configured)return false;

  const candidates=[
    item.url,
    item.object_key,
    item.download_url,
    item.original_name
  ].map(normalizeComparable).filter(Boolean);

  return candidates.some(candidate=>
    candidate===configured||
    candidate.endsWith(configured)||
    configured.endsWith(candidate)
  );
}
function ensureSummaryVideo(){
  if(state.summaryVideoId)return;
  const videos=state.media.filter(item=>item.kind==='video');
  const summary=videos.find(isSummaryVideo)||(!state.summaryVideoSrc?videos[0]:null);
  if(!summary)return;
  state.summaryVideoId=Number(summary.id);
  if(!state.summaryVideoSrc)showSummaryVideo(summary.url,state.day?.video_aspect||'landscape');
}
function galleryItems(){
  return state.media.filter(item=>{
    if(item.kind!=='video')return true;
    if(Number(item.id)===Number(state.summaryVideoId))return false;
    return !isSummaryVideo(item);
  });
}

function tile(item,index){
  const fav=state.favorites.has(item.id);const title=item.title||item.original_name||'רגע מהקעמפ';
  const media=item.kind==='video'
    ? `<div class="video-thumbnail" aria-hidden="true"><span>🎬</span></div>`
    : `<img src="${item.url}" alt="${escapeHtml(item.alt_text||title)}" loading="lazy">`;
  return `<article class="media-tile ${item.kind==='video'?'video-tile':''} ${fav?'favorite':''}" data-id="${item.id}" data-index="${index}">${media}<div class="media-tile-overlay"></div><div class="media-tile-actions"><strong>${escapeHtml(title)}</strong><span class="media-tile-buttons"><button class="favorite-button" aria-label="מועדפים">♥</button></span></div></article>`;
}
function applyFilter(){
  const items=galleryItems();
  state.visible=state.kind==='all'?items:items.filter(i=>i.kind===state.kind);
  const grid=$('#media-grid'),empty=$('#media-empty');
  if(grid)grid.innerHTML=state.visible.map(tile).join('');
  if(empty)empty.classList.toggle('is-hidden',state.visible.length>0);
  bindTiles();
}
function bindTiles(){
  $$('.media-tile').forEach(node=>{
    const id=Number(node.dataset.id),index=Number(node.dataset.index);
    node.addEventListener('click',event=>{if(event.target.closest('.favorite-button')){event.stopPropagation();toggleFavorite(id);return}openLightbox(index)});
  });
}
function toggleFavorite(id){state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);saveFavorites();applyFilter()}
function stopStageVideo(){
  const video=$('#lightbox-stage video');
  if(!video)return;
  try{video.pause();video.removeAttribute('src');video.load()}catch{}
}
function openLightbox(index){
  state.lightboxIndex=index;
  const dialog=$('#lightbox');
  if(dialog&&typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();
  renderLightbox();
}
function renderLightbox(){
  const item=state.visible[state.lightboxIndex];if(!item)return;
  const stage=$('#lightbox-stage');if(!stage)return;
  stopStageVideo();stage.replaceChildren();
  if(item.kind==='video'){
    mountNativeVideo(stage,item.url,{label:item.title||item.original_name||'סרטון מהקעמפ'});
  }else{
    const image=document.createElement('img');image.src=item.url;image.alt=item.alt_text||item.title||'';stage.append(image);
  }
  setText('#lightbox-title',item.title||item.original_name);setText('#lightbox-caption',item.caption||'');
  const favorite=$('#lightbox-favorite');if(favorite)favorite.classList.toggle('active',state.favorites.has(item.id));
}
function moveLightbox(delta){if(!state.visible.length)return;state.lightboxIndex=(state.lightboxIndex+delta+state.visible.length)%state.visible.length;renderLightbox()}
function initLightbox(){
  const dialog=$('#lightbox'),close=$('#lightbox-close'),prev=$('#lightbox-prev'),next=$('#lightbox-next'),favorite=$('#lightbox-favorite'),stage=$('#lightbox-stage');
  if(!dialog||!stage)return;
  if(close)close.onclick=()=>dialog.close();
  if(prev)prev.onclick=()=>moveLightbox(-1);
  if(next)next.onclick=()=>moveLightbox(1);
  if(favorite)favorite.onclick=()=>{const item=state.visible[state.lightboxIndex];if(!item)return;toggleFavorite(item.id);renderLightbox()};
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
  dialog.addEventListener('close',()=>{stopStageVideo();stage.replaceChildren()});
  document.addEventListener('keydown',e=>{if(!dialog.open)return;if(e.key==='ArrowLeft')moveLightbox(1);if(e.key==='ArrowRight')moveLightbox(-1);if(e.key==='Escape')dialog.close()});
  let startX=0;stage.addEventListener('touchstart',e=>startX=e.touches[0]?.clientX||0,{passive:true});stage.addEventListener('touchend',e=>{const diff=(e.changedTouches[0]?.clientX||0)-startX;if(Math.abs(diff)>55)moveLightbox(diff>0?-1:1)},{passive:true});
}
async function loadMedia(reset=false){
  if(reset){state.media=[];state.nextOffset=0;const grid=$('#media-grid');if(grid)grid.innerHTML='<div class="masonry-skeleton"></div><div class="masonry-skeleton tall"></div><div class="masonry-skeleton"></div>'}
  const offset=state.nextOffset??0;const data=await fetchJson(`/api/day?slug=${encodeURIComponent(state.slug)}&offset=${offset}&limit=48`);if(reset)renderDay(data.day,data.total);state.media.push(...data.media);state.nextOffset=data.next_offset;ensureSummaryVideo();applyFilter();const loadMore=$('#load-more');if(loadMore)loadMore.classList.toggle('is-hidden',data.next_offset===null);
}
function initControls(){
  $$('.day-gallery-tools [data-kind]').forEach(btn=>btn.addEventListener('click',()=>{$$('.day-gallery-tools [data-kind]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');state.kind=btn.dataset.kind;applyFilter()}));
  const loadMore=$('#load-more'),favoritesToggle=$('#favorites-toggle'),shareDay=$('#share-day');
  if(loadMore)loadMore.onclick=()=>loadMedia(false).catch(e=>toast(e.message,'error'));
  if(favoritesToggle)favoritesToggle.onclick=()=>{state.kind='all';state.visible=galleryItems().filter(i=>state.favorites.has(i.id));const grid=$('#media-grid'),empty=$('#media-empty');if(grid)grid.innerHTML=state.visible.map(tile).join('');if(empty)empty.classList.toggle('is-hidden',state.visible.length>0);bindTiles();toast(state.visible.length?`מוצגות ${state.visible.length} תמונות מועדפות`:'עדיין לא סימנת מועדפים',state.visible.length?'success':'error')};
  if(shareDay)shareDay.onclick=async()=>{const data={title:state.day?.title||document.title,text:state.day?.description||'',url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);toast('הקישור הועתק')}}catch{}};
}
function initTheme(){const stored=localStorage.getItem('camp-theme');if(stored==='dark'||(!stored&&matchMedia('(prefers-color-scheme:dark)').matches))document.body.classList.add('dark');const toggle=$('#theme-toggle');if(toggle)toggle.onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('camp-theme',document.body.classList.contains('dark')?'dark':'light')}}

function protectPublicMedia(){
  document.addEventListener('contextmenu',event=>{
    if(event.target.closest('.media-tile img,.lightbox-stage img,.day-hero-bg')) event.preventDefault();
  });
  document.addEventListener('dragstart',event=>{
    if(event.target.matches('img')) event.preventDefault();
  });
  document.addEventListener('selectstart',event=>{
    if(event.target.closest('.media-tile,.lightbox-stage')) event.preventDefault();
  });
}

async function track(){try{await fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({page:`day/${state.slug}`,event:'view'}),keepalive:true})}catch{}}

async function applyRemoteTextOverrides(){try{const data=await fetchJson('/api/texts');for(const row of data.overrides||[]){try{document.querySelectorAll(row.selector).forEach(node=>{if(node instanceof HTMLInputElement||node instanceof HTMLTextAreaElement)node.placeholder=row.value;else node.textContent=row.value})}catch{}}}catch{}}


function stabilizeMobileViewport(){
  const apply=()=>{
    const width=document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--app-width',`${width}px`);
    document.documentElement.style.maxWidth='100%';
    document.body.style.maxWidth='100%';
    document.body.style.overflowX='hidden';
  };
  apply();
  window.addEventListener('resize',apply,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(apply,120),{passive:true});
}

async function boot(){stabilizeMobileViewport();setText('#current-year',new Date().getFullYear());state.slug=new URLSearchParams(location.search).get('slug')||'';if(!state.slug){location.href='/#galleries';return}initTheme();initLightbox();initControls();protectPublicMedia();updateCounts();try{await loadMedia(true);await applyRemoteTextOverrides();track()}catch(error){toast(error.message,'error');const grid=$('#media-grid'),empty=$('#media-empty');if(grid)grid.innerHTML='';if(empty)empty.classList.remove('is-hidden')}}
document.addEventListener('DOMContentLoaded',boot);
