// Public day gallery V16
const state={slug:'',day:null,media:[],visible:[],nextOffset:0,kind:'all',favorites:new Set(JSON.parse(localStorage.getItem('camp-favorites')||'[]')),lightboxIndex:0};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const escapeHtml=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);
const formatNumber=v=>new Intl.NumberFormat('he-IL').format(Number(v||0));
async function fetchJson(url){const r=await fetch(url);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||d.error||'אירעה תקלה');return d}
function toast(message,type='success'){const n=document.createElement('div');n.className=`toast ${type}`;n.textContent=message;($('#toast-region')||document.body).append(n);setTimeout(()=>n.remove(),3500)}
function setText(s,v){const n=$(s);if(n)n.textContent=v??''}
function saveFavorites(){localStorage.setItem('camp-favorites',JSON.stringify([...state.favorites]));updateCounts()}
function updateCounts(){setText('#favorites-count',state.favorites.size)}
function formatDate(value){if(!value)return'';const d=new Date(`${value}T12:00:00`);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('he-IL',{day:'numeric',month:'long',year:'numeric'}).format(d)}
function videoEmbed(src){
  const text=String(src||'');
  const youtube=text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);const vimeo=text.match(/vimeo\.com\/(\d+)/);
  if(youtube)return `<iframe src="https://www.youtube-nocookie.com/embed/${youtube[1]}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="סרטון סיכום היום"></iframe>`;
  if(vimeo)return `<iframe src="https://player.vimeo.com/video/${vimeo[1]}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="סרטון סיכום היום"></iframe>`;
  return `<video src="${escapeHtml(text)}" controls playsinline preload="metadata"></video>`;
}
function showSummaryVideo(src,aspect='landscape'){
  const section=$('#day-video-section'),wrap=$('#day-video-wrap');if(!section||!wrap||!src)return;
  section.classList.remove('is-hidden');wrap.className=`day-video-wrap ${aspect==='portrait'?'portrait':aspect==='square'?'square':''}`;wrap.innerHTML=videoEmbed(src);
}
function renderDay(day,total){
  state.day=day;document.title=`${day.title} | קעמפ גן ישראל חדרה`;setText('#day-title',day.title);setText('#day-label',day.label||'יום בקעמפ');setText('#day-date',day.hebrew_date||formatDate(day.date));setText('#day-count',`${formatNumber(total)} פריטים`);setText('#day-description',day.description||'כל הרגעים, החוויות והחיוכים של היום.');
  if(day.cover_url&&$('#day-cover'))$('#day-cover').style.backgroundImage=`url("${day.cover_url.replace(/"/g,'%22')}")`;
  if(day.video_src)showSummaryVideo(day.video_src,day.video_aspect||'landscape');
  if(day.story){const section=$('#day-story-section');if(section)section.classList.remove('is-hidden');setText('#day-story',day.story)}
}
function galleryItems(){return state.media}
function tile(item,index){
  const fav=state.favorites.has(item.id);const title=item.title||item.original_name||'רגע מהקעמפ';
  const media=item.kind==='video'?`<video src="${item.url}" muted preload="metadata" playsinline></video>`:`<img src="${item.url}" alt="${escapeHtml(item.alt_text||title)}" loading="lazy">`;
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
function openLightbox(index){state.lightboxIndex=index;renderLightbox();const dialog=$('#lightbox');if(dialog&&typeof dialog.showModal==='function')dialog.showModal()}
function renderLightbox(){const item=state.visible[state.lightboxIndex];if(!item)return;const stage=$('#lightbox-stage');if(!stage)return;stage.innerHTML=item.kind==='video'?`<video src="${item.url}" controls autoplay playsinline></video>`:`<img src="${item.url}" alt="${escapeHtml(item.alt_text||item.title||'')}">`;setText('#lightbox-title',item.title||item.original_name);setText('#lightbox-caption',item.caption||'');const favorite=$('#lightbox-favorite');if(favorite)favorite.classList.toggle('active',state.favorites.has(item.id));}
function moveLightbox(delta){if(!state.visible.length)return;state.lightboxIndex=(state.lightboxIndex+delta+state.visible.length)%state.visible.length;renderLightbox()}
function initLightbox(){
  const dialog=$('#lightbox'),close=$('#lightbox-close'),prev=$('#lightbox-prev'),next=$('#lightbox-next'),favorite=$('#lightbox-favorite'),stage=$('#lightbox-stage');
  if(!dialog||!stage)return;
  if(close)close.onclick=()=>dialog.close();if(prev)prev.onclick=()=>moveLightbox(-1);if(next)next.onclick=()=>moveLightbox(1);if(favorite)favorite.onclick=()=>{const item=state.visible[state.lightboxIndex];if(!item)return;toggleFavorite(item.id);renderLightbox()};
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});document.addEventListener('keydown',e=>{if(!dialog.open)return;if(e.key==='ArrowLeft')moveLightbox(1);if(e.key==='ArrowRight')moveLightbox(-1);if(e.key==='Escape')dialog.close()});
  let startX=0;stage.addEventListener('touchstart',e=>startX=e.touches[0]?.clientX||0,{passive:true});stage.addEventListener('touchend',e=>{const diff=(e.changedTouches[0]?.clientX||0)-startX;if(Math.abs(diff)>55)moveLightbox(diff>0?-1:1)},{passive:true});
}
async function loadMedia(reset=false){
  if(reset){state.media=[];state.nextOffset=0;const grid=$('#media-grid');if(grid)grid.innerHTML='<div class="masonry-skeleton"></div><div class="masonry-skeleton tall"></div><div class="masonry-skeleton"></div>'}
  const offset=state.nextOffset??0;const data=await fetchJson(`/api/day?slug=${encodeURIComponent(state.slug)}&offset=${offset}&limit=48`);if(reset)renderDay(data.day,data.total);state.media.push(...data.media);state.nextOffset=data.next_offset;applyFilter();const loadMore=$('#load-more');if(loadMore)loadMore.classList.toggle('is-hidden',data.next_offset===null);
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
