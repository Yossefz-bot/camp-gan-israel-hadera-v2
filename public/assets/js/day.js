const state={slug:'',day:null,media:[],visible:[],nextOffset:0,kind:'all',favorites:new Set(JSON.parse(localStorage.getItem('camp-favorites')||'[]')),selection:new Set(),selectionMode:false,lightboxIndex:0};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const escapeHtml=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);
const formatNumber=v=>new Intl.NumberFormat('he-IL').format(Number(v||0));
async function fetchJson(url){const r=await fetch(url);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||d.error||'אירעה תקלה');return d}
function toast(message,type='success'){const n=document.createElement('div');n.className=`toast ${type}`;n.textContent=message;$('#toast-region').append(n);setTimeout(()=>n.remove(),3500)}
function setText(s,v){const n=$(s);if(n)n.textContent=v??''}
function saveFavorites(){localStorage.setItem('camp-favorites',JSON.stringify([...state.favorites]));updateCounts()}
function updateCounts(){setText('#favorites-count',state.favorites.size);setText('#selected-count',state.selection.size)}
function formatDate(value){if(!value)return'';const d=new Date(`${value}T12:00:00`);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('he-IL',{day:'numeric',month:'long',year:'numeric'}).format(d)}
function videoEmbed(src,aspect='landscape'){
  const wrapClass=aspect==='portrait'?'portrait':aspect==='square'?'square':'';
  const youtube=src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);const vimeo=src.match(/vimeo\.com\/(\d+)/);
  if(youtube)return `<div class="day-video-wrap ${wrapClass}"><iframe src="https://www.youtube-nocookie.com/embed/${youtube[1]}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="סרטון היום"></iframe></div>`;
  if(vimeo)return `<div class="day-video-wrap ${wrapClass}"><iframe src="https://player.vimeo.com/video/${vimeo[1]}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="סרטון היום"></iframe></div>`;
  return `<div class="day-video-wrap ${wrapClass}"><video src="${escapeHtml(src)}" controls playsinline preload="metadata"></video></div>`;
}
function renderDay(day,total){
  state.day=day;document.title=`${day.title} | קעמפ גן ישראל חדרה`;setText('#day-title',day.title);setText('#day-label',day.label||'יום בקעמפ');setText('#day-date',day.hebrew_date||formatDate(day.date));setText('#day-count',`${formatNumber(total)} פריטים`);setText('#day-description',day.description||'כל הרגעים, החוויות והחיוכים של היום.');
  if(day.cover_url)$('#day-cover').style.backgroundImage=`url("${day.cover_url.replace(/"/g,'%22')}")`;
  if(day.video_src){$('#day-video-section').classList.remove('is-hidden');$('#day-video-wrap').outerHTML=videoEmbed(day.video_src,day.video_aspect)}
  if(day.story){$('#day-story-section').classList.remove('is-hidden');setText('#day-story',day.story)}
}
function tile(item,index){
  const fav=state.favorites.has(item.id),selected=state.selection.has(item.id);const title=item.title||item.original_name||'רגע מהקעמפ';
  const media=item.kind==='video'?`<video src="${item.url}" muted preload="metadata" playsinline></video>`:`<img src="${item.url}" alt="${escapeHtml(item.alt_text||title)}" loading="lazy">`;
  return `<article class="media-tile ${item.kind==='video'?'video-tile':''} ${fav?'favorite':''} ${selected?'selected':''} ${state.selectionMode?'selection-mode':''}" data-id="${item.id}" data-index="${index}">${media}<div class="media-tile-overlay"></div><div class="media-tile-actions"><strong>${escapeHtml(title)}</strong><span class="media-tile-buttons"><button class="favorite-button" aria-label="מועדפים">♥</button><a href="${item.download_url}" download aria-label="הורדה">↓</a></span></div></article>`;
}
function applyFilter(){state.visible=state.kind==='all'?state.media:state.media.filter(i=>i.kind===state.kind);$('#media-grid').innerHTML=state.visible.map(tile).join('');$('#media-empty').classList.toggle('is-hidden',state.visible.length>0);bindTiles();}
function bindTiles(){
  $$('.media-tile').forEach(node=>{
    const id=Number(node.dataset.id),index=Number(node.dataset.index);
    node.addEventListener('click',event=>{if(event.target.closest('a'))return;if(event.target.closest('.favorite-button')){event.stopPropagation();toggleFavorite(id);return}if(state.selectionMode){toggleSelection(id);return}openLightbox(index)});
  });
}
function toggleFavorite(id){state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);saveFavorites();applyFilter()}
function toggleSelection(id){state.selection.has(id)?state.selection.delete(id):state.selection.add(id);updateCounts();applyFilter();$('#selection-bar').classList.toggle('is-hidden',!state.selectionMode)}
function openLightbox(index){state.lightboxIndex=index;renderLightbox();$('#lightbox').showModal()}
function renderLightbox(){const item=state.visible[state.lightboxIndex];if(!item)return;const stage=$('#lightbox-stage');stage.innerHTML=item.kind==='video'?`<video src="${item.url}" controls autoplay playsinline></video>`:`<img src="${item.url}" alt="${escapeHtml(item.alt_text||item.title||'')}">`;setText('#lightbox-title',item.title||item.original_name);setText('#lightbox-caption',item.caption||'');$('#lightbox-download').href=item.download_url;$('#lightbox-favorite').classList.toggle('active',state.favorites.has(item.id));}
function moveLightbox(delta){if(!state.visible.length)return;state.lightboxIndex=(state.lightboxIndex+delta+state.visible.length)%state.visible.length;renderLightbox()}
function initLightbox(){
  $('#lightbox-close').onclick=()=>$('#lightbox').close();$('#lightbox-prev').onclick=()=>moveLightbox(-1);$('#lightbox-next').onclick=()=>moveLightbox(1);$('#lightbox-favorite').onclick=()=>{const item=state.visible[state.lightboxIndex];toggleFavorite(item.id);renderLightbox()};
  $('#lightbox').addEventListener('click',e=>{if(e.target===$('#lightbox'))$('#lightbox').close()});document.addEventListener('keydown',e=>{if(!$('#lightbox').open)return;if(e.key==='ArrowLeft')moveLightbox(1);if(e.key==='ArrowRight')moveLightbox(-1)});
  let startX=0;$('#lightbox-stage').addEventListener('touchstart',e=>startX=e.touches[0].clientX,{passive:true});$('#lightbox-stage').addEventListener('touchend',e=>{const diff=e.changedTouches[0].clientX-startX;if(Math.abs(diff)>55)moveLightbox(diff>0?-1:1)},{passive:true});
}
async function loadMedia(reset=false){
  if(reset){state.media=[];state.nextOffset=0;$('#media-grid').innerHTML='<div class="masonry-skeleton"></div><div class="masonry-skeleton tall"></div><div class="masonry-skeleton"></div>'}
  const offset=state.nextOffset??0;const data=await fetchJson(`/api/day?slug=${encodeURIComponent(state.slug)}&offset=${offset}&limit=48`);if(reset)renderDay(data.day,data.total);state.media.push(...data.media);state.nextOffset=data.next_offset;applyFilter();$('#load-more').classList.toggle('is-hidden',data.next_offset===null);
}
function initControls(){
  $$('.day-gallery-tools [data-kind]').forEach(btn=>btn.addEventListener('click',()=>{$$('.day-gallery-tools [data-kind]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');state.kind=btn.dataset.kind;applyFilter()}));
  $('#load-more').onclick=()=>loadMedia(false).catch(e=>toast(e.message,'error'));
  $('#selection-mode').onclick=()=>{state.selectionMode=!state.selectionMode;$('#selection-mode').classList.toggle('active',state.selectionMode);$('#selection-bar').classList.toggle('is-hidden',!state.selectionMode);if(!state.selectionMode)state.selection.clear();updateCounts();applyFilter()};
  $('#clear-selection').onclick=()=>{$('#selection-mode').click()};
  $('#select-all').onclick=()=>{state.visible.forEach(i=>state.selection.add(i.id));updateCounts();applyFilter()};
  $('#download-selected').onclick=()=>{const selected=state.media.filter(i=>state.selection.has(i.id));if(!selected.length)return toast('לא נבחרו תמונות','error');selected.slice(0,20).forEach((item,index)=>setTimeout(()=>{const a=document.createElement('a');a.href=item.download_url;a.download='';document.body.append(a);a.click();a.remove()},index*350));if(selected.length>20)toast('הדפדפן מאפשר עד 20 הורדות בכל פעם','error');else toast('ההורדות התחילו')};
  $('#favorites-toggle').onclick=()=>{state.kind='all';state.visible=state.media.filter(i=>state.favorites.has(i.id));$('#media-grid').innerHTML=state.visible.map(tile).join('');$('#media-empty').classList.toggle('is-hidden',state.visible.length>0);bindTiles();toast(state.visible.length?`מוצגות ${state.visible.length} תמונות מועדפות`:'עדיין לא סימנת מועדפים',state.visible.length?'success':'error')};
  $('#share-whatsapp').onclick=()=>{const text=encodeURIComponent(`${state.day?.title||'יום בקעמפ'} — ${location.href}`);window.open(`https://wa.me/?text=${text}`,'_blank','noopener')};
  $('#share-day').onclick=async()=>{const data={title:state.day?.title||document.title,text:state.day?.description||'',url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);toast('הקישור הועתק')}}catch{}}
}
function initTheme(){const stored=localStorage.getItem('camp-theme');if(stored==='dark'||(!stored&&matchMedia('(prefers-color-scheme:dark)').matches))document.body.classList.add('dark');$('#theme-toggle').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('camp-theme',document.body.classList.contains('dark')?'dark':'light')}}
async function track(){try{await fetch('/api/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({page:`day/${state.slug}`,event:'view'}),keepalive:true})}catch{}}
async function boot(){setText('#current-year',new Date().getFullYear());state.slug=new URLSearchParams(location.search).get('slug')||'';if(!state.slug){location.href='/#galleries';return}initTheme();initLightbox();initControls();updateCounts();try{await loadMedia(true);track()}catch(error){toast(error.message,'error');$('#media-grid').innerHTML='';$('#media-empty').classList.remove('is-hidden')}}
document.addEventListener('DOMContentLoaded',boot);
