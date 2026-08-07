// Admin V14 Pro
const state={analyticsData:null,analyticsMetric:'page_views',analyticsTab:'overview',csrf:'',view:'dashboard',textOverrides:[],days:[],media:[],mediaOffset:0,mediaTotal:0,mediaSelected:new Set(),settings:{},announcements:[],testimonials:[],subscribers:[],contacts:[],slides:[],newsletters:[],faq:[],teamRoles:[],whatsappRecipients:[],whatsappIndex:0,whatsappOpened:new Set(),health:null};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const escapeHtml=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);
const formatNumber=v=>new Intl.NumberFormat('he-IL').format(Number(v||0));
const formatDate=v=>{if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat('he-IL',{dateStyle:'medium',timeStyle:v.includes('T')||v.includes(' ')?'short':undefined}).format(d)};
const mediaUrl=key=>key?`/api/media/${String(key).split('/').map(encodeURIComponent).join('/')}`:'';
const normalizeWhatsAppPhone=value=>{let number=String(value??'').replace(/\D/g,'');if(number.startsWith('00'))number=number.slice(2);if(number.startsWith('0'))number=`972${number.slice(1)}`;else if(number.length===9&&!number.startsWith('972'))number=`972${number}`;return number.length>=10&&number.length<=15?number:''};
const whatsappUrl=(phone,message='')=>{const number=normalizeWhatsAppPhone(phone);return number?`https://wa.me/${number}${message?`?text=${encodeURIComponent(message)}`:''}`:''};
async function copyText(value){const text=String(value??'');if(!text)throw new Error('אין תוכן להעתקה.');if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return}const node=document.createElement('textarea');node.value=text;node.style.position='fixed';node.style.opacity='0';document.body.append(node);node.select();if(!document.execCommand('copy'))throw new Error('ההעתקה נכשלה.');node.remove()}
function downloadText(filename,text,type='text/plain;charset=utf-8'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),500)}
const statusLabel={draft:'טיוטה',published:'מפורסם',archived:'ארכיון',pending:'ממתינה',approved:'מאושרת',rejected:'נדחתה',active:'פעיל',unsubscribed:'הוסר',new:'חדש',read:'נקרא',handled:'טופל',sending:'בשליחה',sent:'נשלח',partial:'חלקי',failed:'נכשל'};

async function api(url,options={}){
  const method=options.method||'GET',headers={...(options.headers||{})};
  if(options.body&&!(options.body instanceof FormData)&&!headers['content-type'])headers['content-type']='application/json';
  if(method!=='GET'&&method!=='HEAD')headers['x-csrf-token']=state.csrf;
  const response=await fetch(url,{credentials:'same-origin',...options,headers});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){showLogin();throw new Error('החיבור הסתיים. יש להתחבר מחדש.');}
  if(!response.ok)throw new Error(data.message||data.error||'אירעה תקלה');return data;
}
function toast(message,type='success'){const n=document.createElement('div');n.className=`toast ${type}`;n.textContent=message;$('#toast-region').append(n);setTimeout(()=>n.remove(),4200)}
function formStatus(form,message,type=''){const node=$('.form-status',form);if(!node)return;node.textContent=message;node.className=`form-status ${type}`}
function showLogin(){state.csrf='';$('#admin-app').classList.add('is-hidden');$('#login-screen').classList.remove('is-hidden');setTimeout(()=>$('#admin-password').focus(),50)}
async function showApp(session){state.csrf=session.csrf;try{localStorage.setItem('camp-analytics-exclude','1')}catch{}$('#login-screen').classList.add('is-hidden');$('#admin-app').classList.remove('is-hidden');await Promise.allSettled([loadHealth(),loadDays(true)]);goView('dashboard')}

function initAuth(){
  $('#login-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,button=$('button[type="submit"]',form);button.disabled=true;formStatus(form,'בודק...');try{const data=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({password:$('#admin-password').value})}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||d.error);return d});form.reset();await showApp(data)}catch(error){formStatus(form,error.message,'error')}finally{button.disabled=false}});
  $('#toggle-password').onclick=()=>{const input=$('#admin-password');input.type=input.type==='password'?'text':'password'};
  $('#logout-button').onclick=async()=>{try{await api('/api/admin/logout',{method:'POST',body:'{}'})}catch{}showLogin()};
}

const viewMeta={dashboard:['לוח בקרה','תמונת מצב של הקעמפ'],days:['ימי הקעמפ','יצירה, עריכה ופרסום'],media:['מדיה והעלאות','תמונות, סרטונים והמנונים'],settings:['תוכן ועיצוב','הגדרות האתר והשפה החזותית'],announcements:['הודעות להורים','הודעות חשובות באתר'],faq:['שאלות ותשובות','ניהול עמוד השו״ת'],team:['נעים להכיר','ניהול תפקידי הצוות'],testimonials:['תגובות הורים','אישור וניהול תגובות'],subscribers:['נרשמים לעדכונים','רשימת תפוצה'],newsletter:['תפוצת WhatsApp','הכנת הודעות ועדכונים לנרשמים'],contacts:['פניות מהאתר','הודעות שהתקבלו'],analytics:['סטטיסטיקות','צפיות ופעילות'],system:['מצב המערכת','D1, R2 ואבטחה']};
async function goView(view){state.view=view;$$('.admin-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$$('.admin-view').forEach(p=>p.classList.toggle('active',p.dataset.panel===view));setText('#view-title',viewMeta[view]?.[0]||'ניהול');setText('#view-subtitle',viewMeta[view]?.[1]||'');closeSidebar();try{if(view==='dashboard')await loadDashboard();if(view==='days')await loadDays();if(view==='media')await loadMedia(true);if(view==='settings')await loadSettings();if(view==='announcements')await loadAnnouncements();if(view==='faq')await loadFaqAdmin();if(view==='team')await loadTeamAdmin();if(view==='testimonials')await loadTestimonials();if(view==='subscribers')await loadSubscribers();if(view==='newsletter')await loadWhatsAppBroadcast();if(view==='contacts')await loadContacts();if(view==='analytics')await loadAnalytics();if(view==='system')await loadHealth()}catch(error){toast(error.message,'error')}}
function setText(s,v){const n=$(s);if(n)n.textContent=v??''}
function initNavigation(){$$('.admin-nav button').forEach(b=>b.onclick=()=>goView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>goView(b.dataset.go));$('[data-action="quick-upload"]').onclick=()=>{goView('media').then(()=>$('#upload-zone').classList.remove('is-hidden'))};$('#admin-menu').onclick=()=>{$('#admin-sidebar').classList.add('open');$('#sidebar-backdrop').classList.add('open')};$('#sidebar-close').onclick=closeSidebar;$('#sidebar-backdrop').onclick=closeSidebar}
function closeSidebar(){$('#admin-sidebar').classList.remove('open');$('#sidebar-backdrop').classList.remove('open')}

async function loadDashboard(){const data=await api('/api/admin/dashboard');const s=data.stats;$('#admin-stats').innerHTML=[['📅',s.days,'ימי קעמפ'],['📸',s.photos,'תמונות'],['🎬',s.videos,'סרטונים'],['👥',s.subscribers,'נרשמים']].map(([i,n,l])=>`<article class="admin-stat"><span>${i}</span><div><strong>${formatNumber(n)}</strong><small>${l}</small></div></article>`).join('');setText('#nav-pending-count',s.pending_testimonials||'');setText('#nav-messages-count',s.new_messages||'');$('#recent-media').innerHTML=data.recent_media.length?data.recent_media.map(item=>`<div class="recent-item"><span class="recent-thumb">${item.kind==='image'?`<img src="${mediaUrl(item.object_key)}" alt="">`:item.kind==='video'?'🎬':item.kind==='audio'?'🎵':'📄'}</span><div><strong>${escapeHtml(item.title||'ללא כותרת')}</strong><small>${escapeHtml(item.day_title||'ללא שיוך')} · ${formatDate(item.created_at)}</small></div><button class="text-button" data-edit-media="${item.id}">עריכה</button></div>`).join(''):'<div class="admin-empty">עוד לא הועלו קבצים</div>';$('#recent-messages').innerHTML=data.recent_messages.length?data.recent_messages.map(m=>`<div class="recent-item"><span class="recent-thumb">✉️</span><div><strong>${escapeHtml(m.name)}</strong><small>${escapeHtml(m.subject||'פנייה מהאתר')} · ${formatDate(m.created_at)}</small></div><span class="status-badge ${m.status}">${statusLabel[m.status]||m.status}</span></div>`).join(''):'<div class="admin-empty">אין פניות חדשות</div>';$$('[data-edit-media]').forEach(b=>b.onclick=()=>openMediaById(Number(b.dataset.editMedia)))}

async function loadDays(silent=false){const data=await api('/api/admin/days');state.days=data.days;populateDaySelects();if(!silent)renderDays()}
function populateDaySelects(){const options=state.days.map(d=>`<option value="${d.id}">${escapeHtml(d.title)}</option>`).join('');['#upload-day','#media-day-filter','#media-form [name="day_id"]','#media-bulk-day'].forEach(selector=>{const select=$(selector);if(!select)return;const current=select.value;if(selector==='#media-bulk-day')select.innerHTML=`<option value="">בחר יעד...</option><option value="__none__">ללא גלריה (יישאר רק בניהול)</option>${options}`;else if(selector==='#media-day-filter')select.innerHTML=`<option value="">כל הימים</option><option value="none">ללא גלריה</option>${options}`;else select.innerHTML=`<option value="">ללא שיוך</option>${options}`;select.value=current});}
function renderDays(){const list=$('#days-list');list.innerHTML=state.days.length?state.days.map(day=>`<article class="day-admin-card" draggable="true" data-id="${day.id}"><div class="day-admin-cover">${day.cover_key||day.fallback_cover_key?`<img src="${mediaUrl(day.cover_key||day.fallback_cover_key)}" alt="">`:'🏕️'}</div><div class="day-admin-copy"><h3>${escapeHtml(day.title)}</h3><p>${escapeHtml(day.hebrew_date||day.date||'ללא תאריך')} · ${formatNumber(day.photo_count)} תמונות · ${formatNumber(day.media_count)} קבצים</p><div class="day-admin-meta"><span class="status-badge ${day.status}">${statusLabel[day.status]||day.status}</span><span class="status-badge">/${escapeHtml(day.slug)}</span></div></div><div class="day-admin-actions"><button class="action-button" data-day-open="${day.id}">צפייה</button><button class="action-button" data-day-edit="${day.id}">עריכה</button><button class="action-button" data-day-duplicate="${day.id}">שכפול</button><button class="action-button" data-day-toggle="${day.id}">${day.status==='published'?'העבר לטיוטה':'פרסם'}</button><button class="action-button danger" data-day-delete="${day.id}">מחיקה</button></div></article>`).join(''):'<div class="admin-empty">עוד לא נוצרו ימים. לחצו על “יצירת יום חדש”.</div>';bindDayActions();initDayDrag()}
function bindDayActions(){$$('[data-day-open]').forEach(b=>b.onclick=()=>window.open(`/day.html?slug=${encodeURIComponent(state.days.find(d=>d.id===Number(b.dataset.dayOpen)).slug)}`,'_blank'));$$('[data-day-edit]').forEach(b=>b.onclick=()=>openDayModal(state.days.find(d=>d.id===Number(b.dataset.dayEdit))));$$('[data-day-duplicate]').forEach(b=>b.onclick=async()=>{const d=state.days.find(x=>x.id===Number(b.dataset.dayDuplicate));if(!confirm(`לשכפל את ${d.title}?`))return;await api('/api/admin/days',{method:'POST',body:JSON.stringify({action:'duplicate',id:d.id})});toast('היום שוכפל');await loadDays();});$$('[data-day-toggle]').forEach(b=>b.onclick=async()=>{const d=state.days.find(x=>x.id===Number(b.dataset.dayToggle));await api('/api/admin/days',{method:'PATCH',body:JSON.stringify({id:d.id,status:d.status==='published'?'draft':'published'})});toast(d.status==='published'?'היום הועבר לטיוטה':'היום פורסם');await loadDays();});$$('[data-day-delete]').forEach(b=>b.onclick=async()=>{const d=state.days.find(x=>x.id===Number(b.dataset.dayDelete));const removeMedia=confirm(`למחוק את ${d.title}?\nאישור = מחיקה יחד עם כל קובצי היום.\nביטול = עצירת הפעולה.`);if(!removeMedia)return;await api('/api/admin/days',{method:'DELETE',body:JSON.stringify({id:d.id,delete_media:true})});toast('היום נמחק');await loadDays();})}
function initDayDrag(){let dragged=null;$$('.day-admin-card').forEach(card=>{card.addEventListener('dragstart',()=>{dragged=card;card.style.opacity='.45'});card.addEventListener('dragend',async()=>{card.style.opacity='';dragged=null;const ids=$$('.day-admin-card').map(c=>Number(c.dataset.id));await api('/api/admin/days',{method:'PATCH',body:JSON.stringify({action:'reorder',ids})}).catch(e=>toast(e.message,'error'))});card.addEventListener('dragover',e=>{e.preventDefault();if(!dragged||dragged===card)return;const rect=card.getBoundingClientRect();card.parentNode.insertBefore(dragged,e.clientY<rect.top+rect.height/2?card:card.nextSibling)})})}
function openDayModal(day=null){const form=$('#day-form');form.reset();for(const input of form.elements){if(!input.name)continue;input.value=day?.[input.name]??(input.name==='status'?'draft':input.name==='video_aspect'?'landscape':'')}setText('#day-modal-title',day?'עריכת יום':'יצירת יום חדש');formStatus(form,'');$('#day-modal').showModal()}

function initDayForm(){$('#create-day').onclick=()=>openDayModal();$('#day-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form)),id=Number(data.id||0);formStatus(form,'שומר...');try{await api('/api/admin/days',{method:id?'PATCH':'POST',body:JSON.stringify({...data,id})});toast(id?'היום עודכן':'היום נוצר');$('#day-modal').close();await loadDays()}catch(error){formStatus(form,error.message,'error')}})}

async function loadMedia(reset=false){if(reset){state.mediaOffset=0;state.media=[];state.mediaSelected.clear()}const p=new URLSearchParams({offset:String(state.mediaOffset),limit:'60'});if($('#media-day-filter').value)p.set('day_id',$('#media-day-filter').value);if($('#media-kind-filter').value)p.set('kind',$('#media-kind-filter').value);if($('#media-status-filter').value)p.set('status',$('#media-status-filter').value);if($('#media-category-filter')?.value)p.set('category',$('#media-category-filter').value);if($('#media-search').value.trim())p.set('search',$('#media-search').value.trim());const data=await api(`/api/admin/media?${p}`);state.media.push(...data.media);state.mediaOffset=state.media.length;state.mediaTotal=data.total;renderMediaFolders();renderMedia();$('#media-more').classList.toggle('is-hidden',state.media.length>=data.total)}

function renderMediaFolders(){const wrap=$('#media-folders');if(!wrap)return;const activeDay=$('#media-day-filter').value,activeKind=$('#media-kind-filter').value,activeCategory=$('#media-category-filter')?.value||'';const folders=[{day:'',kind:'',category:'',icon:'🗂️',title:'הכול'},{day:'none',kind:'',category:'',icon:'📥',title:'ללא גלריה'},{day:'',kind:'image',category:'logo',icon:'🏷️',title:'לוגואים'},{day:'',kind:'audio',category:'',icon:'🎵',title:'המנונים'},{day:'',kind:'',category:'homepage',icon:'🏠',title:'דף הבית'},...state.days.map(d=>({day:String(d.id),kind:'',category:'',icon:'📅',title:d.title}))];wrap.innerHTML=folders.map(f=>{const active=activeDay===f.day&&activeKind===f.kind&&activeCategory===f.category;return `<button type="button" class="media-folder ${active?'active':''}" data-folder-day="${escapeHtml(f.day)}" data-folder-kind="${escapeHtml(f.kind)}" data-folder-category="${escapeHtml(f.category)}"><span>${f.icon}</span><strong>${escapeHtml(f.title)}</strong></button>`}).join('');$$('[data-folder-day]',wrap).forEach(b=>b.onclick=()=>{$('#media-day-filter').value=b.dataset.folderDay;$('#media-kind-filter').value=b.dataset.folderKind;$('#media-category-filter').value=b.dataset.folderCategory;loadMedia(true)})}
function mediaPreview(item){if(item.kind==='image')return `<img src="${mediaUrl(item.object_key)}" alt="${escapeHtml(item.alt_text||item.title||'')}">`;if(item.kind==='video')return `<video src="${mediaUrl(item.object_key)}" muted preload="metadata"></video>`;return item.kind==='audio'?'🎵':'📄'}
function updateMediaSelectionBar(){const count=state.mediaSelected.size,allVisible=state.media.length>0&&state.media.every(item=>state.mediaSelected.has(Number(item.id)));setText('#media-selected-count',formatNumber(count));$('#media-selection-actions').classList.toggle('is-hidden',count===0);$('#media-select-all').checked=allVisible;$('#media-select-all').indeterminate=count>0&&!allVisible;$$('[data-media-select]').forEach(input=>{const selected=state.mediaSelected.has(Number(input.dataset.mediaSelect));input.checked=selected;input.closest('.admin-media-card')?.classList.toggle('selected',selected)})}
function renderMedia(){$('#admin-media-grid').innerHTML=state.media.length?state.media.map(item=>{const selected=state.mediaSelected.has(Number(item.id));const nextStatus=item.status==='published'?'draft':'published';return `<article class="admin-media-card${selected?' selected':''}" data-media-card="${item.id}"><label class="media-card-select" title="בחירת הקובץ"><input type="checkbox" data-media-select="${item.id}" ${selected?'checked':''}><span>✓</span></label><div class="admin-media-preview">${mediaPreview(item)}<span class="admin-media-type">${escapeHtml(item.kind)}</span></div><div class="admin-media-body"><strong>${escapeHtml(item.title||item.original_name)}</strong><small>${escapeHtml(item.day_title||'ללא שיוך')} · ${formatNumber(item.size_bytes/1024)} KB</small><div class="admin-media-actions"><span class="status-badge ${item.status}">${statusLabel[item.status]||item.status}</span><div><button class="media-quick-status" data-media-quick-status="${item.id}" data-status="${nextStatus}">${nextStatus==='published'?'פרסום':'לטיוטה'}</button><button data-media-edit="${item.id}">עריכה</button></div></div></div></article>`}).join(''):'<div class="admin-empty">לא נמצאו קבצים</div>';$$('[data-media-edit]').forEach(b=>b.onclick=()=>openMediaModal(state.media.find(m=>m.id===Number(b.dataset.mediaEdit))));$$('[data-media-select]').forEach(input=>input.onchange=()=>{const id=Number(input.dataset.mediaSelect);input.checked?state.mediaSelected.add(id):state.mediaSelected.delete(id);updateMediaSelectionBar()});$$('[data-media-quick-status]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await api('/api/admin/media',{method:'PATCH',body:JSON.stringify({id:Number(button.dataset.mediaQuickStatus),status:button.dataset.status})});toast(button.dataset.status==='published'?'הקובץ פורסם':'הקובץ הועבר לטיוטה');await loadMedia(true)}catch(error){toast(error.message,'error')}finally{button.disabled=false}});updateMediaSelectionBar()}
async function bulkMediaStatus(status){const ids=[...state.mediaSelected];if(!ids.length)return;const label=status==='published'?'לפרסם':status==='draft'?'להעביר לטיוטה':'להעביר לארכיון';if(!confirm(`${label} ${ids.length} קבצים שנבחרו?`))return;$$('[data-media-bulk-status]').forEach(button=>button.disabled=true);try{await api('/api/admin/media',{method:'PATCH',body:JSON.stringify({action:'bulk_status',ids,status})});toast(status==='published'?`${ids.length} קבצים פורסמו`:`${ids.length} קבצים עודכנו`);await loadMedia(true)}catch(error){toast(error.message,'error')}finally{$$('[data-media-bulk-status]').forEach(button=>button.disabled=false)}}
async function bulkMediaDay(){const ids=[...state.mediaSelected];if(!ids.length)return;const rawDay=$('#media-bulk-day')?.value||'';const dayId=rawDay==='__none__'?'':rawDay;const label=dayId?(state.days.find(d=>String(d.id)===String(dayId))?.title||'היום שנבחר'):'ללא שיוך';if(!confirm(`להעביר ${ids.length} קבצים אל ${label}?`))return;await api('/api/admin/media',{method:'PATCH',body:JSON.stringify({action:'bulk_day',ids,day_id:dayId?Number(dayId):null})});toast(`${ids.length} קבצים הועברו`);await Promise.all([loadMedia(true),loadDays(true)])}
async function bulkMediaCategory(){const ids=[...state.mediaSelected];if(!ids.length)return;const category=$('#media-bulk-category')?.value.trim()||'';if(!confirm(`לעדכן קטגוריה עבור ${ids.length} קבצים${category?` ל־${category}`:' ולנקות את הקטגוריה'}?`))return;await api('/api/admin/media',{method:'PATCH',body:JSON.stringify({action:'bulk_category',ids,category})});toast(`${ids.length} קבצים עודכנו`);await loadMedia(true)}
async function bulkDeleteMedia(){const ids=[...state.mediaSelected];if(!ids.length)return;const warning=`למחוק לצמיתות ${ids.length} קבצים שנבחרו?\n\nהקבצים יימחקו גם מאחסון R2 ולא יהיה אפשר לשחזר אותם דרך האתר.`;if(!confirm(warning))return;const buttons=$$('#media-selection-actions button');buttons.forEach(button=>button.disabled=true);try{const result=await api('/api/admin/media',{method:'DELETE',body:JSON.stringify({ids})});state.mediaSelected.clear();toast(`${formatNumber(result.deleted||ids.length)} קבצים נמחקו לצמיתות`);if(result.warning)toast(result.warning,'error');await Promise.all([loadMedia(true),loadDashboard(),loadDays(true)])}catch(error){toast(error.message,'error')}finally{buttons.forEach(button=>button.disabled=false)}}
async function openMediaById(id){let item=state.media.find(m=>m.id===id);if(!item){const data=await api('/api/admin/media?limit=200');item=data.media.find(m=>m.id===id)}if(item)openMediaModal(item)}
function openMediaModal(item){const form=$('#media-form');form.reset();for(const input of form.elements){if(!input.name)continue;if(input.type==='checkbox')input.checked=Boolean(item[input.name]);else input.value=item[input.name]??''}const preview=$('#media-preview');preview.innerHTML=item.kind==='image'?`<img src="${mediaUrl(item.object_key)}" alt="">`:item.kind==='video'?`<video src="${mediaUrl(item.object_key)}" controls></video>`:item.kind==='audio'?`<audio src="${mediaUrl(item.object_key)}" controls></audio>`:'📄';form.dataset.objectKey=item.object_key;const art=$('#audio-artwork-preview');if(art)art.innerHTML=item.artwork_key?`<img src="${mediaUrl(item.artwork_key)}" alt="">`:'GI';$('#audio-artwork-field')?.classList.toggle('is-hidden',item.kind!=='audio');formStatus(form,'');$('#set-cover').classList.toggle('is-hidden',item.kind!=='image'||!item.day_id);$('#media-modal').showModal()}
function initMedia(){
  $('#pick-audio-artwork').onclick=()=>openHomeMediaPicker('song','image','song-artwork');$('#clear-audio-artwork').onclick=()=>{const f=$('#media-form');f.elements.artwork_key.value='';$('#audio-artwork-preview').textContent='GI'};
  $('#upload-button').onclick=()=>$('#upload-zone').classList.toggle('is-hidden');const zone=$('#upload-zone'),input=$('#file-input');zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragging')});zone.addEventListener('dragleave',()=>zone.classList.remove('dragging'));zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragging');uploadFiles([...e.dataTransfer.files])});input.addEventListener('change',()=>{uploadFiles([...input.files]);input.value=''})
  $('#media-refresh').onclick=()=>loadMedia(true).catch(e=>toast(e.message,'error'));['#media-day-filter','#media-kind-filter','#media-status-filter','#media-category-filter'].forEach(s=>$(s).onchange=()=>loadMedia(true));let timer;$('#media-search').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>loadMedia(true),350)};$('#media-more').onclick=()=>loadMedia(false);
  $('#media-select-all').onchange=e=>{if(e.target.checked)state.media.forEach(item=>state.mediaSelected.add(Number(item.id)));else state.mediaSelected.clear();updateMediaSelectionBar()};$('#media-selection-clear').onclick=()=>{state.mediaSelected.clear();updateMediaSelectionBar()};$('#media-bulk-delete').onclick=bulkDeleteMedia;$('#media-bulk-day-apply').onclick=()=>bulkMediaDay().catch(e=>toast(e.message,'error'));$('#media-bulk-category-apply').onclick=()=>bulkMediaCategory().catch(e=>toast(e.message,'error'));$$('[data-media-bulk-status]').forEach(button=>button.onclick=()=>bulkMediaStatus(button.dataset.mediaBulkStatus));
  $('#media-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form));data.id=Number(data.id);data.day_id=data.day_id?Number(data.day_id):null;data.is_featured=$('[name="is_featured"]',form).checked;try{await api('/api/admin/media',{method:'PATCH',body:JSON.stringify(data)});toast('הקובץ עודכן');$('#media-modal').close();await loadMedia(true)}catch(error){formStatus(form,error.message,'error')}});
  $('#delete-media').onclick=async()=>{const id=Number($('#media-form [name="id"]').value);if(!confirm('למחוק את הקובץ לצמיתות?'))return;await api('/api/admin/media',{method:'DELETE',body:JSON.stringify({id})});$('#media-modal').close();toast('הקובץ נמחק');await loadMedia(true)};
  $('#set-cover').onclick=async()=>{const id=Number($('#media-form [name="id"]').value);await api('/api/admin/media',{method:'PATCH',body:JSON.stringify({action:'set_cover',id})});toast('תמונת השער עודכנה');$('#media-modal').close();await Promise.all([loadMedia(true),loadDays(true)])};
}
function uploadFiles(files){if(!files.length)return;$('#upload-zone').classList.remove('is-hidden');const queue=$('#upload-queue');files.forEach(file=>{const id=crypto.randomUUID(),node=document.createElement('div');node.className='upload-item';node.id=`upload-${id}`;node.innerHTML=`<span class="upload-item-icon">${file.type.startsWith('image/')?'📷':file.type.startsWith('video/')?'🎬':file.type.startsWith('audio/')?'🎵':'📄'}</span><div class="upload-item-copy"><strong>${escapeHtml(file.name)}</strong><small>${(file.size/1024/1024).toFixed(1)} MB</small><div class="upload-progress"><span></span></div></div><span class="upload-item-status">ממתין</span>`;queue.append(node);uploadOne(file,node)});}
function uploadOne(file,node){const form=new FormData();form.append('file',file);form.append('day_id',$('#upload-day').value);form.append('kind',$('#upload-kind').value);form.append('status',$('#upload-status').value);const xhr=new XMLHttpRequest();xhr.open('POST','/api/admin/upload');xhr.withCredentials=true;xhr.setRequestHeader('x-csrf-token',state.csrf);xhr.upload.onprogress=e=>{if(e.lengthComputable){$('.upload-progress span',node).style.width=`${e.loaded/e.total*100}%`;$('.upload-item-status',node).textContent=`${Math.round(e.loaded/e.total*100)}%`}};xhr.onload=async()=>{let data={};try{data=JSON.parse(xhr.responseText)}catch{}if(xhr.status>=200&&xhr.status<300){$('.upload-item-status',node).textContent='✓ הושלם';node.classList.add('done');setTimeout(()=>node.remove(),2500);await loadMedia(true).catch(()=>{})}else{$('.upload-item-status',node).textContent=data.message||'נכשל';node.classList.add('failed')}};xhr.onerror=()=>{$('.upload-item-status',node).textContent='שגיאת רשת'};xhr.send(form)}

async function loadSettings(){
  const [data,textData]=await Promise.all([api('/api/admin/settings'),api('/api/admin/texts').catch(()=>({overrides:[]})),loadHeroSlides()]);state.textOverrides=textData.overrides||[];renderTextOverrides();
  state.settings=data.settings;
  const form=$('#settings-form');
  for(const [key,value] of Object.entries(data.settings)){
    const input=form.elements[key];if(!input)continue;
    if(input.type==='checkbox')input.checked=value==='1'||value===true;
    else if(input.type==='datetime-local')input.value=value?String(value).slice(0,16):'';
    else input.value=value??'';
  }
  for(const slot of ['hero','story']){
    const type=form.elements[`${slot}_media_type`];
    if(type?.value==='default'){
      if(form.elements[`${slot}_video_key`]?.value||form.elements[`${slot}_video_url`]?.value)type.value='video';
      else if(form.elements[`${slot}_image_key`]?.value)type.value='image';
    }
  }
  updateThemePreview();refreshHomeMediaEditors();renderHeroSlides();
}
function settingsPayload(){const form=$('#settings-form'),payload={};for(const input of form.elements){if(!input.name)continue;payload[input.name]=input.type==='checkbox'?(input.checked?'1':'0'):input.value}return payload}
function initSettings(){
  if($('#add-text-override'))$('#add-text-override').onclick=()=>{state.textOverrides.push({selector:'',value:''});renderTextOverrides();setTimeout(()=>$$('[data-text-selector]').at(-1)?.focus(),0)};
  $$('.settings-tabs button').forEach(b=>b.onclick=()=>{$$('.settings-tabs button').forEach(x=>x.classList.remove('active'));$$('.settings-panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(`[data-settings-panel="${b.dataset.settingsTab}"]`).classList.add('active')});
  $('#save-settings').onclick=async()=>{try{await Promise.all([api('/api/admin/settings',{method:'PATCH',body:JSON.stringify({settings:settingsPayload()})}),saveTextOverrides()]);state.settings=settingsPayload();toast('ההגדרות נשמרו');refreshHomeMediaEditors()}catch(e){toast(e.message,'error')}};
  $$('#settings-form input[type="color"]').forEach(i=>i.oninput=updateThemePreview);
  $$('[name="hero_media_type"],[name="story_media_type"],[name="hero_video_url"],[name="story_video_url"],[name="hero_video_autoplay"],[name="story_video_autoplay"],[name="hero_video_loop"],[name="story_video_loop"],[name="hero_video_controls"],[name="story_video_controls"]').forEach(input=>input.addEventListener('change',refreshHomeMediaEditors));
  $$('[data-home-media-pick]').forEach(button=>button.onclick=()=>openHomeMediaPicker(button.dataset.homeMediaPick,button.dataset.kind,button.dataset.role||'main'));
  $$('[data-home-media-clear]').forEach(button=>button.onclick=()=>clearHomeMedia(button.dataset.homeMediaClear));
  $$('[data-add-hero-slide]').forEach(button=>button.onclick=()=>openHomeMediaPicker('hero',button.dataset.addHeroSlide,'slide'));
  $('#record-center-clear').onclick=()=>{const form=$('#settings-form');form.elements.record_center_image_key.value='';renderRecordCenterPreview();toast('התמונה נוקתה. לחצו שמירת שינויים.')};
  $('#home-media-picker-search').oninput=()=>renderHomeMediaPicker();
  $('#home-media-picker-upload').onclick=()=>$('#home-media-picker-file').click();
  $('#home-media-picker-file').onchange=e=>uploadHomeMedia(e.target.files?.[0]);
}

function renderTextOverrides(){const list=$('#text-overrides-list');if(!list)return;list.innerHTML=(state.textOverrides||[]).map((row,i)=>`<div class="text-override-row"><input data-text-selector="${i}" placeholder="#gallery-title" value="${escapeHtml(row.selector||'')}"><textarea data-text-value="${i}" rows="2" placeholder="הטקסט החדש">${escapeHtml(row.value||'')}</textarea><button type="button" data-text-remove="${i}">×</button></div>`).join('')||'<div class="admin-empty">אין החלפות טקסט. לחצו “＋ שורה”.</div>';$$('[data-text-remove]',list).forEach(b=>b.onclick=()=>{state.textOverrides.splice(Number(b.dataset.textRemove),1);renderTextOverrides()})}
function collectTextOverrides(){return $$('[data-text-selector]').map((input,i)=>({selector:input.value.trim(),value:$(`[data-text-value="${i}"]`)?.value||''})).filter(x=>x.selector)}
async function saveTextOverrides(){const overrides=collectTextOverrides();await api('/api/admin/texts',{method:'PUT',body:JSON.stringify({overrides})});state.textOverrides=overrides}

function updateThemePreview(){const form=$('#settings-form'),preview=$('#theme-preview');preview.style.background=`linear-gradient(135deg,${form.elements.theme_primary?.value||'#ff6b16'},${form.elements.theme_purple?.value||'#7b4ce2'})`;const btn=$('button',preview);btn.style.background=form.elements.theme_accent?.value||'#ffd234';btn.style.color=form.elements.theme_secondary?.value||'#173b67'}


const homeMediaPickerState={slot:'hero',kind:'image',role:'main',items:[]};
function homeMediaEmbedUrl(url,autoplay=false,loop=false,controls=true){
  const text=String(url||'').trim();if(!text)return'';
  try{const parsed=new URL(text,location.origin),host=parsed.hostname.replace(/^www\./,'');
    if(host==='youtu.be'||host.endsWith('youtube.com')){const id=host==='youtu.be'?parsed.pathname.slice(1):parsed.searchParams.get('v')||parsed.pathname.split('/').filter(Boolean).pop();if(!id)return text;const params=new URLSearchParams({rel:'0',playsinline:'1',controls:controls?'1':'0'});if(autoplay){params.set('autoplay','1');params.set('mute','1')}if(loop){params.set('loop','1');params.set('playlist',id)}return`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params}`}
    if(host==='vimeo.com'||host.endsWith('.vimeo.com')){const id=parsed.pathname.split('/').filter(Boolean).pop();if(!id)return text;const params=new URLSearchParams({autoplay:autoplay?'1':'0',muted:autoplay?'1':'0',loop:loop?'1':'0',controls:controls?'1':'0'});return`https://player.vimeo.com/video/${encodeURIComponent(id)}?${params}`}
  }catch{}return text
}
function homeMediaConfig(slot){const form=$('#settings-form'),value=name=>form.elements[`${slot}_${name}`]?.value||'',checked=name=>Boolean(form.elements[`${slot}_${name}`]?.checked);return{type:value('media_type')||'default',imageKey:value('image_key'),videoKey:value('video_key'),videoUrl:value('video_url'),posterKey:value('video_poster_key'),autoplay:checked('video_autoplay'),loop:checked('video_loop'),controls:checked('video_controls')}}
function renderHomeMediaPreview(slot){
  const preview=$(`#${slot}-media-setting-preview`);if(!preview)return;
  const config=homeMediaConfig(slot),title=slot==='hero'?'המסגרת הראשית':'סרטון סיכום הקעמפ';
  preview.dataset.type=config.type;preview.classList.remove('has-image','has-video');
  if(slot==='hero'&&config.type==='slideshow'){
    const slide=state.slides.find(item=>item.status==='published')||state.slides[0];
    if(slide){preview.classList.add(slide.kind==='video'?'has-video':'has-image');preview.innerHTML=slide.kind==='image'?`<img src="${mediaUrl(slide.object_key)}" alt=""><span class="homepage-media-status">🎞 מצגת · ${state.slides.length} פריטים</span>`:`<video src="${mediaUrl(slide.object_key)}" muted playsinline preload="metadata"></video><span class="homepage-media-status">🎞 מצגת · ${state.slides.length} פריטים</span>`;return}
    preview.innerHTML='<span>🎞</span><strong>המצגת עדיין ריקה</strong><small>הוסיפו תמונה או סרטון ברשימה למטה</small>';return;
  }
  if(config.type==='image'&&config.imageKey){preview.classList.add('has-image');preview.innerHTML=`<img src="${mediaUrl(config.imageKey)}" alt="תצוגה מקדימה"><span class="homepage-media-status">📷 תמונה · ${escapeHtml(title)}</span>`;return}
  if(config.type==='video'&&(config.videoKey||config.videoUrl)){
    preview.classList.add('has-video');const source=config.videoKey?mediaUrl(config.videoKey):config.videoUrl,poster=config.posterKey?mediaUrl(config.posterKey):'',embed=homeMediaEmbedUrl(source,config.autoplay,config.loop,config.controls),isEmbed=/youtube(?:-nocookie)?\.com\/embed|player\.vimeo\.com\/video/.test(embed);
    preview.innerHTML=isEmbed?`<iframe src="${escapeHtml(embed)}" title="תצוגת סרטון" allow="autoplay; fullscreen; picture-in-picture" loading="lazy"></iframe><span class="homepage-media-status">🎬 סרטון · ${escapeHtml(title)}</span>`:`<video src="${escapeHtml(source)}" ${poster?`poster="${escapeHtml(poster)}"`:''} muted playsinline ${config.autoplay?'autoplay':''} ${config.loop?'loop':''} ${config.controls?'controls':''}></video><span class="homepage-media-status">🎬 סרטון · ${escapeHtml(title)}</span>`;return
  }
  preview.innerHTML=`<span>${slot==='hero'?'🏕️':'☀️'}</span><strong>${config.type==='default'?'העיצוב המאויר הרגיל':config.type==='image'?'עוד לא נבחרה תמונה':'עוד לא נבחר סרטון'}</strong><small>${config.type==='default'?'אפשר להחליף לתמונה, סרטון או מצגת':'לחצו על כפתור הבחירה'}</small>`;
}
function refreshHomeMediaEditors(){renderHomeMediaPreview('hero');renderHomeMediaPreview('story');renderRecordCenterPreview()}
function clearHomeMedia(slot){const form=$('#settings-form');for(const name of ['image_key','video_key','video_url','video_poster_key'])if(form.elements[`${slot}_${name}`])form.elements[`${slot}_${name}`].value='';form.elements[`${slot}_media_type`].value='default';refreshHomeMediaEditors();toast('המדיה נוקתה. לחצו “שמירת שינויים” כדי לפרסם את העדכון.')}
async function openHomeMediaPicker(slot,kind,role='main'){
  homeMediaPickerState.slot=slot;homeMediaPickerState.kind=kind;homeMediaPickerState.role=role;homeMediaPickerState.items=[];
  const title=role==='poster'?'בחירת תמונת פתיחה לסרטון':role==='slide'?(kind==='image'?'הוספת תמונה למצגת':'הוספת סרטון למצגת'):role==='record'?'בחירת תמונה למרכז התקליט':kind==='image'?'בחירת תמונה למסגרת':'בחירת סרטון למסגרת';
  setText('#home-media-picker-title',title);
  const file=$('#home-media-picker-file');file.value='';file.accept=kind==='image'?'image/*':'video/mp4,video/webm,video/quicktime';
  $('#home-media-picker-search').value='';$('#home-media-picker-grid').innerHTML='<div class="admin-empty">טוען מדיה...</div>';$('#home-media-picker-modal').showModal();
  try{const data=await api(`/api/admin/media?limit=200&kind=${encodeURIComponent(kind)}`);homeMediaPickerState.items=data.media||[];renderHomeMediaPicker()}catch(error){$('#home-media-picker-grid').innerHTML=`<div class="admin-empty">${escapeHtml(error.message)}</div>`}
}
function renderHomeMediaPicker(){const query=$('#home-media-picker-search').value.trim().toLowerCase(),items=homeMediaPickerState.items.filter(item=>!query||`${item.title||''} ${item.original_name||''} ${item.day_title||''}`.toLowerCase().includes(query)),grid=$('#home-media-picker-grid');grid.innerHTML=items.length?items.map(item=>`<button class="home-media-picker-item" type="button" data-home-media-choice="${item.id}"><span class="home-media-picker-thumb">${item.kind==='image'?`<img src="${mediaUrl(item.object_key)}" alt="">`:`<video src="${mediaUrl(item.object_key)}" muted preload="metadata"></video><i>▶</i>`}</span><span class="home-media-picker-copy"><strong>${escapeHtml(item.title||item.original_name||'ללא כותרת')}</strong><small>${escapeHtml(item.day_title||'ללא שיוך')} · <b class="status-badge ${item.status}">${statusLabel[item.status]||item.status}</b></small></span></button>`).join(''):'<div class="admin-empty">לא נמצאו קבצים מתאימים. אפשר להעלות קובץ חדש.</div>';$$('[data-home-media-choice]',grid).forEach(button=>button.onclick=()=>chooseHomeMedia(homeMediaPickerState.items.find(item=>item.id===Number(button.dataset.homeMediaChoice))))}
async function chooseHomeMedia(item){
  if(!item)return;const {slot,kind,role}=homeMediaPickerState,form=$('#settings-form');
  if(role==='slide'){
    try{await api('/api/admin/slides',{method:'POST',body:JSON.stringify({kind,object_key:item.object_key,title:item.title||item.original_name||'',alt_text:item.alt_text||'',status:'published',duration_seconds:kind==='video'?10:6,autoplay:true})});await api('/api/admin/settings',{method:'PATCH',body:JSON.stringify({settings:{hero_media_type:'slideshow'}})});form.elements.hero_media_type.value='slideshow';await loadHeroSlides();renderHeroSlides();refreshHomeMediaEditors();$('#home-media-picker-modal').close();toast('הפריט נוסף והמצגת הופעלה באתר.')}catch(error){toast(error.message,'error')}return;
  }
  if(role==='song-artwork'){const mediaForm=$('#media-form');mediaForm.elements.artwork_key.value=item.object_key;$('#audio-artwork-preview').innerHTML=`<img src="${mediaUrl(item.object_key)}" alt="">`;$('#home-media-picker-modal').close();toast('תמונת השיר נבחרה. לחצו שמירה.');return;}
  if(role==='record'){
    form.elements.record_center_image_key.value=item.object_key;renderRecordCenterPreview();$('#home-media-picker-modal').close();toast('התמונה נבחרה. לחצו שמירת שינויים.');return;
  }
  if(role==='poster')form.elements[`${slot}_video_poster_key`].value=item.object_key;
  else{form.elements[`${slot}_media_type`].value=kind;if(kind==='image')form.elements[`${slot}_image_key`].value=item.object_key;else{form.elements[`${slot}_video_key`].value=item.object_key;form.elements[`${slot}_video_url`].value=''}}
  refreshHomeMediaEditors();$('#home-media-picker-modal').close();toast('המדיה נבחרה. לחצו “שמירת שינויים” כדי להציג אותה באתר.');
}
async function uploadHomeMedia(file){
  if(!file)return;const expected=homeMediaPickerState.kind;
  if(expected==='image'&&!file.type.startsWith('image/')){toast('יש לבחור קובץ תמונה.','error');return}
  if(expected==='video'&&!file.type.startsWith('video/')){toast('יש לבחור קובץ סרטון.','error');return}
  const button=$('#home-media-picker-upload');button.disabled=true;button.textContent='מעלה...';
  try{const body=new FormData();body.append('file',file);body.append('kind',expected);body.append('category',homeMediaPickerState.role==='slide'?'homepage-slideshow':'homepage');body.append('status','published');const data=await api('/api/admin/upload',{method:'POST',body});await chooseHomeMedia({...data.item,status:'published',day_title:''});toast('הקובץ הועלה ונבחר בהצלחה')}catch(error){toast(error.message,'error')}finally{button.disabled=false;button.textContent='＋ העלאת קובץ חדש';$('#home-media-picker-file').value=''}
}

async function loadAnnouncements(){const data=await api('/api/admin/announcements');state.announcements=data.announcements;$('#announcements-table').innerHTML=state.announcements.length?state.announcements.map(a=>`<tr><td><strong>${escapeHtml(a.title)}</strong><br><small>${escapeHtml(a.body.slice(0,70))}</small></td><td>${escapeHtml(a.tone)}</td><td><span class="status-badge ${a.status}">${statusLabel[a.status]||a.status}</span></td><td>${escapeHtml(a.starts_at||'מיד')} — ${escapeHtml(a.ends_at||'ללא סיום')}</td><td><div class="table-actions"><button data-ann-edit="${a.id}">עריכה</button></div></td></tr>`).join(''):'<tr><td colspan="5">אין הודעות</td></tr>';$$('[data-ann-edit]').forEach(b=>b.onclick=()=>openAnnouncement(state.announcements.find(a=>a.id===Number(b.dataset.annEdit))))}
function openAnnouncement(item=null){const form=$('#announcement-form');form.reset();for(const input of form.elements){if(!input.name)continue;let value=item?.[input.name]??(input.name==='status'?'draft':input.name==='tone'?'info':'');if(input.type==='datetime-local'&&value)value=String(value).replace(' ','T').slice(0,16);input.value=value}$('#delete-announcement').classList.toggle('is-hidden',!item);formStatus(form,'');$('#announcement-modal').showModal()}
function initAnnouncements(){$('#create-announcement').onclick=()=>openAnnouncement();$('#announcement-form').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget)),id=Number(data.id||0);try{await api('/api/admin/announcements',{method:id?'PATCH':'POST',body:JSON.stringify({...data,id})});toast('ההודעה נשמרה');$('#announcement-modal').close();await loadAnnouncements()}catch(err){formStatus(e.currentTarget,err.message,'error')}});$('#delete-announcement').onclick=async()=>{const id=Number($('#announcement-form [name="id"]').value);if(!confirm('למחוק את ההודעה?'))return;await api('/api/admin/announcements',{method:'DELETE',body:JSON.stringify({id})});$('#announcement-modal').close();toast('ההודעה נמחקה');await loadAnnouncements()}}

async function loadTestimonials(status=''){const data=await api(`/api/admin/testimonials${status?`?status=${status}`:''}`);state.testimonials=data.testimonials;renderTestimonials()}
function renderTestimonials(){$('#testimonials-admin-grid').innerHTML=state.testimonials.length?state.testimonials.map(t=>`<article class="review-card"><div class="stars">${'★'.repeat(Number(t.rating)||5)}</div><p>“${escapeHtml(t.message)}”</p><footer><div><strong>${escapeHtml(t.name)}</strong><small>${escapeHtml(t.relation||'')} · ${formatDate(t.created_at)}</small></div><div class="review-actions">${t.status!=='approved'?`<button title="אישור" data-testimonial-approve="${t.id}">✓</button>`:''}${t.status!=='rejected'?`<button title="דחייה" data-testimonial-reject="${t.id}">×</button>`:''}<button title="עריכה" data-testimonial-edit="${t.id}">✎</button></div></footer><span class="status-badge ${t.status}">${statusLabel[t.status]}</span></article>`).join(''):'<div class="admin-empty">אין תגובות בקטגוריה הזו</div>';$$('[data-testimonial-approve]').forEach(b=>b.onclick=()=>updateTestimonialStatus(Number(b.dataset.testimonialApprove),'approved'));$$('[data-testimonial-reject]').forEach(b=>b.onclick=()=>updateTestimonialStatus(Number(b.dataset.testimonialReject),'rejected'));$$('[data-testimonial-edit]').forEach(b=>b.onclick=()=>openTestimonial(state.testimonials.find(t=>t.id===Number(b.dataset.testimonialEdit))))}
async function updateTestimonialStatus(id,status){await api('/api/admin/testimonials',{method:'PATCH',body:JSON.stringify({id,status})});toast(status==='approved'?'התגובה אושרה':'התגובה נדחתה');await loadTestimonials($('.status-tabs [data-testimonial-status].active')?.dataset.testimonialStatus||'')}
function openTestimonial(item=null){const form=$('#testimonial-admin-form');form.reset();for(const input of form.elements){if(!input.name)continue;input.value=item?.[input.name]??(input.name==='status'?'approved':input.name==='rating'?5:input.name==='sort_order'?0:'')}$('#delete-testimonial').classList.toggle('is-hidden',!item);formStatus(form,'');$('#testimonial-admin-modal').showModal()}
function initTestimonials(){$$('.status-tabs [data-testimonial-status]').forEach(b=>b.onclick=()=>{$$('.status-tabs [data-testimonial-status]').forEach(x=>x.classList.remove('active'));b.classList.add('active');loadTestimonials(b.dataset.testimonialStatus)});$('#create-testimonial').onclick=()=>openTestimonial();$('#testimonial-admin-form').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget)),id=Number(data.id||0);data.rating=Number(data.rating);data.sort_order=Number(data.sort_order);try{await api('/api/admin/testimonials',{method:id?'PATCH':'POST',body:JSON.stringify({...data,id})});toast('התגובה נשמרה');$('#testimonial-admin-modal').close();await loadTestimonials()}catch(err){formStatus(e.currentTarget,err.message,'error')}});$('#delete-testimonial').onclick=async()=>{const id=Number($('#testimonial-admin-form [name="id"]').value);if(!confirm('למחוק את התגובה?'))return;await api('/api/admin/testimonials',{method:'DELETE',body:JSON.stringify({id})});$('#testimonial-admin-modal').close();toast('התגובה נמחקה');await loadTestimonials()}}

async function loadSubscribers(){const p=new URLSearchParams({limit:'300'});if($('#subscriber-search').value)p.set('search',$('#subscriber-search').value);if($('#subscriber-status').value)p.set('status',$('#subscriber-status').value);const data=await api(`/api/admin/subscribers?${p}`);state.subscribers=data.subscribers;$('#subscribers-table').innerHTML=state.subscribers.length?state.subscribers.map(s=>{const wa=normalizeWhatsAppPhone(s.phone);return `<tr><td>${escapeHtml(s.name)}</td><td><a href="tel:${escapeHtml(s.phone)}">${escapeHtml(s.phone)}</a></td><td>${escapeHtml(s.email)}</td><td><span class="status-badge ${s.status}">${statusLabel[s.status]}</span></td><td>${formatDate(s.created_at)}</td><td><div class="table-actions">${wa?`<button class="whatsapp-action" data-subscriber-whatsapp="${s.id}">WhatsApp</button>`:''}<button data-subscriber-toggle="${s.id}">${s.status==='active'?'הסרה':'הפעלה'}</button><button data-subscriber-delete="${s.id}">מחיקה</button></div></td></tr>`}).join(''):'<tr><td colspan="6">אין נרשמים</td></tr>';$$('[data-subscriber-whatsapp]').forEach(button=>button.onclick=()=>{const subscriber=state.subscribers.find(item=>item.id===Number(button.dataset.subscriberWhatsapp)),message=$('#whatsapp-broadcast-message')?.value.trim()||`שלום ${subscriber?.name||''},`;window.open(whatsappUrl(subscriber.phone,message),'_blank','noopener')});$$('[data-subscriber-toggle]').forEach(b=>b.onclick=async()=>{const s=state.subscribers.find(x=>x.id===Number(b.dataset.subscriberToggle));await api('/api/admin/subscribers',{method:'PATCH',body:JSON.stringify({id:s.id,status:s.status==='active'?'unsubscribed':'active'})});await loadSubscribers()});$$('[data-subscriber-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('למחוק את הנרשם?'))return;await api('/api/admin/subscribers',{method:'DELETE',body:JSON.stringify({id:Number(b.dataset.subscriberDelete)})});await loadSubscribers()})}

let subscriberImportRows=[],spreadsheetLibraryPromise=null;
const normalizeSpreadsheetHeader=value=>String(value??'').trim().toLowerCase().replace(/[\s_\-–—./\\:()]+/g,'');
const spreadsheetHeaderAliases={email:['email','e-mail','mail','emailaddress','אימייל','מייל','דואלאלקטרוני','כתובתמייל','כתובתאימייל'],name:['name','fullname','contactname','שם','שםמלא','שםומשפחה'],phone:['phone','mobile','telephone','tel','cellphone','טלפון','נייד','מספרטלפון']};
const headerMatches=(value,key)=>spreadsheetHeaderAliases[key].map(normalizeSpreadsheetHeader).includes(normalizeSpreadsheetHeader(value));
const emailMatches=value=>String(value??'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[];
async function loadSpreadsheetLibrary(){if(!spreadsheetLibraryPromise)spreadsheetLibraryPromise=import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');return spreadsheetLibraryPromise}
function extractSubscriberRows(matrix){const rows=matrix.filter(row=>Array.isArray(row)&&row.some(cell=>String(cell??'').trim()));if(!rows.length)return{rows:[],invalid:0,duplicates:0,headerRow:-1};let headerRow=-1,indexes={email:-1,name:-1,phone:-1};for(let r=0;r<Math.min(rows.length,10);r++){const candidate=rows[r];const emailIndex=candidate.findIndex(value=>headerMatches(value,'email'));if(emailIndex<0)continue;headerRow=r;indexes={email:emailIndex,name:candidate.findIndex(value=>headerMatches(value,'name')),phone:candidate.findIndex(value=>headerMatches(value,'phone'))};break}const output=[],seen=new Set();let invalid=0,duplicates=0;const dataRows=headerRow>=0?rows.slice(headerRow+1):rows;for(const row of dataRows){let emails=[];if(indexes.email>=0)emails=emailMatches(row[indexes.email]);else for(const cell of row)emails.push(...emailMatches(cell));if(!emails.length){if(row.some(cell=>String(cell??'').trim()))invalid++;continue}for(const rawEmail of emails){const email=rawEmail.trim().toLowerCase();if(seen.has(email)){duplicates++;continue}seen.add(email);output.push({email,name:indexes.name>=0?String(row[indexes.name]??'').trim():'',phone:indexes.phone>=0?String(row[indexes.phone]??'').trim():''})}}return{rows:output,invalid,duplicates,headerRow}}
function renderSubscriberImportPreview(file,parsed){subscriberImportRows=parsed.rows;const summary=$('#subscriber-import-summary');summary.innerHTML=`<span>📊</span><div><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(parsed.sheetName||'גיליון ראשון')} · ${formatNumber(parsed.rawRows)} שורות שנקראו</small></div><button class="button button-small button-ghost" type="button" id="subscriber-import-choose">החלפת קובץ</button>`;$('#subscriber-import-choose').onclick=()=>$('#subscriber-import-file').click();$('#subscriber-import-stats').innerHTML=[[parsed.rows.length,'כתובות תקינות'],[parsed.invalid,'שורות ללא אימייל'],[parsed.duplicates,'כפילויות בקובץ'],[parsed.headerRow>=0?'כן':'לא','כותרות זוהו']].map(([n,label])=>`<div class="import-stat"><strong>${typeof n==='number'?formatNumber(n):escapeHtml(n)}</strong><small>${label}</small></div>`).join('');$('#subscriber-import-preview').innerHTML=parsed.rows.slice(0,10).map(row=>`<tr><td>${escapeHtml(row.name||'—')}</td><td>${escapeHtml(row.phone||'—')}</td><td>${escapeHtml(row.email)}</td></tr>`).join('');$('#subscriber-import-preview-wrap').classList.toggle('is-hidden',!parsed.rows.length);$('#subscriber-import-submit').disabled=!parsed.rows.length;$('#subscriber-import-result').classList.add('is-hidden');formStatus($('#subscriber-import-form'),parsed.rows.length?'':'לא נמצאו כתובות אימייל תקינות בקובץ.',parsed.rows.length?'':'error')}
async function parseSubscriberSpreadsheet(file){if(!file)return;const allowed=/\.(xlsx|xls|csv)$/i.test(file.name);if(!allowed){formStatus($('#subscriber-import-form'),'יש לבחור קובץ XLSX, XLS או CSV.','error');return}formStatus($('#subscriber-import-form'),'קורא את הקובץ...');$('#subscriber-import-submit').disabled=true;try{const XLSX=await loadSpreadsheetLibrary(),workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});const sheetName=workbook.SheetNames[0];if(!sheetName)throw new Error('לא נמצא גיליון בקובץ.');const matrix=XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{header:1,defval:'',raw:false,blankrows:false});const parsed=extractSubscriberRows(matrix);renderSubscriberImportPreview(file,{...parsed,sheetName,rawRows:matrix.length})}catch(error){subscriberImportRows=[];$('#subscriber-import-submit').disabled=true;formStatus($('#subscriber-import-form'),`לא הצלחנו לקרוא את הקובץ: ${error.message}`,'error')}}
function resetSubscriberImport(){subscriberImportRows=[];$('#subscriber-import-file').value='';$('#subscriber-import-stats').innerHTML='';$('#subscriber-import-preview').innerHTML='';$('#subscriber-import-preview-wrap').classList.add('is-hidden');$('#subscriber-import-progress').classList.add('is-hidden');$('#subscriber-import-result').className='import-result is-hidden';$('#subscriber-import-submit').disabled=true;$('#subscriber-import-submit').textContent='ייבוא לרשימת התפוצה';$('#subscriber-import-summary').innerHTML='<span>📄</span><div><strong>לא נבחר קובץ</strong><small>בחרו קובץ כדי להציג תצוגה מקדימה</small></div><button class="button button-small button-ghost" type="button" id="subscriber-import-choose">בחירת קובץ</button>';$('#subscriber-import-choose').onclick=()=>$('#subscriber-import-file').click();formStatus($('#subscriber-import-form'),'')}
async function importSubscriberRows(){const form=$('#subscriber-import-form'),button=$('#subscriber-import-submit');if(!subscriberImportRows.length)return;button.disabled=true;button.textContent='מייבא...';$('#subscriber-import-progress-bar').value=0;setText('#subscriber-import-progress-percent','0%');$('#subscriber-import-progress').classList.remove('is-hidden');$('#subscriber-import-result').classList.add('is-hidden');let totals={inserted:0,updated:0,invalid:0,duplicates:0,total:0},completed=false;const batchSize=100;try{for(let i=0;i<subscriberImportRows.length;i+=batchSize){const batch=subscriberImportRows.slice(i,i+batchSize),result=await api('/api/admin/subscribers',{method:'POST',body:JSON.stringify({action:'import',rows:batch,source:$('#subscriber-import-source').value,reactivate:$('#subscriber-import-reactivate').checked})});for(const key of Object.keys(totals))totals[key]+=Number(result[key]||0);const done=Math.min(subscriberImportRows.length,i+batch.length),percent=Math.round(done/subscriberImportRows.length*100);$('#subscriber-import-progress-bar').value=percent;setText('#subscriber-import-progress-percent',`${percent}%`);setText('#subscriber-import-progress-label',`יובאו ${formatNumber(done)} מתוך ${formatNumber(subscriberImportRows.length)}`)}const result=$('#subscriber-import-result');result.className='import-result';result.innerHTML=`<strong>הייבוא הושלם בהצלחה ✅</strong><br>נוספו ${formatNumber(totals.inserted)} כתובות חדשות, עודכנו ${formatNumber(totals.updated)} כתובות קיימות.${totals.invalid?` ${formatNumber(totals.invalid)} שורות לא תקינות דולגו.`:''}`;toast(`נוספו ${formatNumber(totals.inserted)} נרשמים חדשים`);completed=true;subscriberImportRows=[];await loadSubscribers();await loadDashboard()}catch(error){const result=$('#subscriber-import-result');result.className='import-result error';result.textContent=`הייבוא נעצר: ${error.message}`;formStatus(form,error.message,'error')}finally{button.disabled=completed;button.textContent=completed?'הייבוא הושלם':'נסה שוב'}}
function initSubscribers(){let timer;$('#subscriber-search').oninput=()=>{clearTimeout(timer);timer=setTimeout(loadSubscribers,300)};$('#subscriber-status').onchange=loadSubscribers;$('#whatsapp-broadcast-button').onclick=()=>goView('newsletter').then(()=>setTimeout(()=>$('#whatsapp-broadcast-message').focus(),50));$('#import-subscribers-button').onclick=()=>{resetSubscriberImport();$('#subscriber-import-modal').showModal()};$('#subscriber-import-file').onchange=e=>parseSubscriberSpreadsheet(e.target.files?.[0]);$('#subscriber-import-form').addEventListener('submit',async e=>{e.preventDefault();await importSubscriberRows()})}

async function loadContacts(status=''){
  const p=new URLSearchParams({limit:'200'});if(status)p.set('status',status);const data=await api(`/api/admin/contacts?${p}`);state.contacts=data.messages;
  $('#contacts-grid').innerHTML=state.contacts.length?state.contacts.map(m=>`<article class="message-card ${m.status}"><header><div><h3>${escapeHtml(m.name)}</h3><small>${escapeHtml(m.subject||'פנייה מהאתר')}</small></div><span class="status-badge ${m.status}">${statusLabel[m.status]}</span></header><p>${escapeHtml(m.message)}</p><div class="message-contact">${m.phone?`<a href="tel:${escapeHtml(m.phone)}">📞 ${escapeHtml(m.phone)}</a>`:''}${m.email?`<a href="mailto:${escapeHtml(m.email)}">✉ ${escapeHtml(m.email)}</a>`:''}</div>${Number(m.reply_count)>0?`<div class="reply-sent-note">✅ קיימות ${formatNumber(m.reply_count)} תשובות קודמות במייל${m.last_reply_at?` · האחרונה ${formatDate(m.last_reply_at)}`:''}</div>`:''}<footer><small>${formatDate(m.created_at)}</small><div class="table-actions">${normalizeWhatsAppPhone(m.phone)?`<button class="button-whatsapp-inline" data-contact-reply="${m.id}">השב ב־WhatsApp</button>`:''}<button data-contact-status-action="${m.id}" data-status="handled">טופל</button><button data-contact-status-action="${m.id}" data-status="archived">ארכיון</button><button data-contact-delete="${m.id}">מחיקה</button></div></footer></article>`).join(''):'<div class="admin-empty">אין פניות בקטגוריה הזו</div>';
  $$('[data-contact-reply]').forEach(b=>b.onclick=()=>openContactReply(state.contacts.find(m=>m.id===Number(b.dataset.contactReply))));
  $$('[data-contact-status-action]').forEach(b=>b.onclick=async()=>{await api('/api/admin/contacts',{method:'PATCH',body:JSON.stringify({id:Number(b.dataset.contactStatusAction),status:b.dataset.status})});await loadContacts($('.status-tabs [data-contact-status].active')?.dataset.contactStatus||'')});
  $$('[data-contact-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('למחוק את הפנייה?'))return;await api('/api/admin/contacts',{method:'DELETE',body:JSON.stringify({id:Number(b.dataset.contactDelete)})});await loadContacts()});
}
function initContacts(){
  $$('.status-tabs [data-contact-status]').forEach(b=>b.onclick=()=>{$$('.status-tabs [data-contact-status]').forEach(x=>x.classList.remove('active'));b.classList.add('active');loadContacts(b.dataset.contactStatus)});
  $('#contact-reply-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,phone=form.elements.phone.value,message=form.elements.message.value.trim(),url=whatsappUrl(phone,message);if(!url){formStatus(form,'מספר הטלפון אינו תקין.','error');return}if(message.length<2){formStatus(form,'יש לכתוב תשובה.','error');return}const opened=window.open(url,'_blank');if(!opened){formStatus(form,'הדפדפן חסם את החלון. יש לאפשר חלונות קופצים לאתר.','error');return}try{opened.opener=null}catch{}const id=Number(form.elements.id.value);formStatus(form,'WhatsApp נפתח עם ההודעה המוכנה.','success');try{await api('/api/admin/contacts',{method:'PATCH',body:JSON.stringify({id,status:'handled'})})}catch{}setTimeout(()=>$('#contact-reply-modal').close(),650);await loadContacts($('.status-tabs [data-contact-status].active')?.dataset.contactStatus||'')});
}


function renderRecordCenterPreview(){
  const key=$('#settings-form').elements.record_center_image_key?.value||'',node=$('#record-center-setting-preview');if(!node)return;
  node.innerHTML=key?`<img src="${mediaUrl(key)}" alt="תמונה במרכז התקליט">`:'GI';
}

async function loadHeroSlides(){
  try{const data=await api('/api/admin/slides');state.slides=data.slides||[]}catch(error){state.slides=[];if(state.view==='settings')toast(error.message,'error')}
  return state.slides;
}

function heroSlidePreview(slide){
  if(slide.kind==='image')return `<img src="${mediaUrl(slide.object_key)}" alt="">`;
  return `<video src="${mediaUrl(slide.object_key)}" muted preload="metadata"></video><span class="slide-play">▶</span>`;
}

function renderHeroSlides(){
  const list=$('#hero-slides-list');if(!list)return;
  list.innerHTML=state.slides.length?state.slides.map((slide,index)=>`<article class="hero-slide-admin" data-id="${slide.id}"><div class="hero-slide-thumb">${heroSlidePreview(slide)}</div><div class="hero-slide-copy"><strong>${escapeHtml(slide.title||`${slide.kind==='image'?'תמונה':'סרטון'} ${index+1}`)}</strong><small>${slide.kind==='image'?'תמונה':'סרטון'} · <span class="status-badge ${slide.status}">${statusLabel[slide.status]||slide.status}</span></small><label>משך תצוגה<input data-slide-duration="${slide.id}" type="number" min="2" max="60" value="${Number(slide.duration_seconds||6)}"> שניות</label></div><div class="hero-slide-actions"><button type="button" data-slide-move="up" data-id="${slide.id}" ${index===0?'disabled':''}>↑</button><button type="button" data-slide-move="down" data-id="${slide.id}" ${index===state.slides.length-1?'disabled':''}>↓</button><button type="button" data-slide-toggle="${slide.id}">${slide.status==='published'?'לטיוטה':'פרסום'}</button><button type="button" class="danger" data-slide-delete="${slide.id}">מחיקה</button></div></article>`).join(''):'<div class="admin-empty">המצגת ריקה. הוסיפו תמונה או סרטון.</div>';
  $$('[data-slide-duration]',list).forEach(input=>input.onchange=async()=>{await api('/api/admin/slides',{method:'PATCH',body:JSON.stringify({id:Number(input.dataset.slideDuration),duration_seconds:Number(input.value)})});await loadHeroSlides();renderHeroSlides();refreshHomeMediaEditors()});
  $$('[data-slide-toggle]',list).forEach(button=>button.onclick=async()=>{const slide=state.slides.find(x=>x.id===Number(button.dataset.slideToggle));await api('/api/admin/slides',{method:'PATCH',body:JSON.stringify({id:slide.id,status:slide.status==='published'?'draft':'published'})});await loadHeroSlides();renderHeroSlides();refreshHomeMediaEditors()});
  $$('[data-slide-delete]',list).forEach(button=>button.onclick=async()=>{if(!confirm('למחוק את הפריט מהמצגת?'))return;await api('/api/admin/slides',{method:'DELETE',body:JSON.stringify({id:Number(button.dataset.slideDelete)})});await loadHeroSlides();renderHeroSlides();refreshHomeMediaEditors()});
  $$('[data-slide-move]',list).forEach(button=>button.onclick=async()=>{const id=Number(button.dataset.id),index=state.slides.findIndex(x=>x.id===id),otherIndex=button.dataset.slideMove==='up'?index-1:index+1;if(otherIndex<0||otherIndex>=state.slides.length)return;const a=state.slides[index],b=state.slides[otherIndex];await Promise.all([api('/api/admin/slides',{method:'PATCH',body:JSON.stringify({id:a.id,sort_order:b.sort_order})}),api('/api/admin/slides',{method:'PATCH',body:JSON.stringify({id:b.id,sort_order:a.sort_order})})]);await loadHeroSlides();renderHeroSlides();refreshHomeMediaEditors()});
}

function openContactReply(message){
  const form=$('#contact-reply-form');form.reset();form.elements.id.value=message.id;form.elements.phone.value=message.phone||'';form.elements.message.value=`שלום ${message.name||''},\n\nבקשר לפנייה שלך באתר קעמפ גן ישראל חדרה:\n\n`;setText('#contact-reply-recipient',`${message.name} · ${message.phone||'ללא טלפון'}`);$('#contact-reply-original').innerHTML=`<strong>הפנייה המקורית</strong><p>${escapeHtml(message.message)}</p>`;formStatus(form,'');$('#contact-reply-modal').showModal();setTimeout(()=>{form.elements.message.focus();form.elements.message.setSelectionRange(form.elements.message.value.length,form.elements.message.value.length)},50);
}

function composeWhatsAppBroadcast(){const message=$('#whatsapp-broadcast-message').value.trim(),link=$('#whatsapp-broadcast-link').value.trim();return [message,link].filter(Boolean).join('\n\n')}
function renderWhatsAppRecipientPreview(){const valid=state.whatsappRecipients;$('#newsletter-list').innerHTML=valid.length?`<div class="whatsapp-recipient-summary"><strong>${formatNumber(valid.length)} מספרים מוכנים</strong><small>מוצגים כאן 12 הראשונים. אפשר להוריד את הרשימה המלאה או להתחיל תור שליחה.</small></div><div class="whatsapp-recipient-chips">${valid.slice(0,12).map(item=>`<button type="button" data-whatsapp-preview="${item.id}"><span>${escapeHtml(item.name||'ללא שם')}</span><small>${escapeHtml(item.phone)}</small></button>`).join('')}${valid.length>12?`<span class="whatsapp-more-chip">+${formatNumber(valid.length-12)} נוספים</span>`:''}</div>`:'<div class="admin-empty">אין נרשמים פעילים עם מספר טלפון תקין.</div>';$$('[data-whatsapp-preview]').forEach(button=>button.onclick=()=>{const item=valid.find(row=>row.id===Number(button.dataset.whatsappPreview)),message=composeWhatsAppBroadcast()||`שלום ${item?.name||''},`;window.open(whatsappUrl(item.phone,message),'_blank','noopener')})}
async function loadWhatsAppBroadcast(){const data=await api('/api/admin/subscribers?limit=2000&status=active');const all=data.subscribers||[];state.whatsappRecipients=all.map(item=>({...item,whatsapp_phone:normalizeWhatsAppPhone(item.phone)})).filter(item=>item.whatsapp_phone);const missing=Math.max(0,Number(data.total||all.length)-state.whatsappRecipients.length);$('#newsletter-stats').innerHTML=[['👥',data.total||all.length,'נרשמים פעילים'],['📱',state.whatsappRecipients.length,'מספרים תקינים'],['⚠️',missing,'ללא טלפון תקין']].map(([i,n,l])=>`<article class="admin-stat"><span>${i}</span><div><strong>${formatNumber(n)}</strong><small>${l}</small></div></article>`).join('');renderWhatsAppRecipientPreview()}
function startWhatsAppQueue(){const message=composeWhatsAppBroadcast();if(message.length<2){toast('יש לכתוב הודעה לפני תחילת השליחה.','error');$('#whatsapp-broadcast-message').focus();return}if(!state.whatsappRecipients.length){toast('אין נמענים עם מספר טלפון תקין.','error');return}state.whatsappIndex=0;state.whatsappOpened=new Set();renderWhatsAppQueue();$('#newsletter-modal').showModal()}
function renderWhatsAppQueue(){const total=state.whatsappRecipients.length,index=Math.min(Math.max(0,state.whatsappIndex),Math.max(0,total-1));state.whatsappIndex=index;const item=state.whatsappRecipients[index],opened=state.whatsappOpened.has(item?.id),percent=total?Math.round((index+(opened?1:0))/total*100):0;setText('#whatsapp-queue-label',`נמען ${formatNumber(index+1)} מתוך ${formatNumber(total)}`);setText('#whatsapp-queue-percent',`${percent}%`);$('#whatsapp-queue-bar').value=percent;$('#whatsapp-current-recipient').innerHTML=item?`<span class="whatsapp-avatar">${escapeHtml((item.name||'?').trim().slice(0,1)||'?')}</span><div><strong>${escapeHtml(item.name||'ללא שם')}</strong><a href="tel:${escapeHtml(item.phone)}">${escapeHtml(item.phone)}</a><small>${opened?'✓ הצ׳אט כבר נפתח בסבב הזה':'מוכן לפתיחה'}</small></div>`:'<div class="admin-empty">אין נמען</div>';$('#whatsapp-queue-message').textContent=composeWhatsAppBroadcast();$('#whatsapp-prev').disabled=index===0;$('#whatsapp-next').disabled=index>=total-1;$('#whatsapp-open-current').textContent=opened?'פתיחה מחדש ב־WhatsApp':'פתיחת הצ׳אט ב־WhatsApp'}
function openCurrentWhatsApp(){const item=state.whatsappRecipients[state.whatsappIndex],message=composeWhatsAppBroadcast();if(!item)return;const opened=window.open(whatsappUrl(item.phone,message),'_blank');if(!opened){toast('הדפדפן חסם את החלון. יש לאפשר חלונות קופצים.','error');return}try{opened.opener=null}catch{}state.whatsappOpened.add(item.id);renderWhatsAppQueue()}
function whatsappCsv(){const quote=value=>`"${String(value??'').replace(/"/g,'""')}"`;return '\ufeff'+[['שם','טלפון מקורי','מספר WhatsApp בינלאומי'],...state.whatsappRecipients.map(item=>[item.name,item.phone,item.whatsapp_phone])].map(row=>row.map(quote).join(',')).join('\r\n')}
function initNewsletter(){
  $('#create-newsletter-button').onclick=()=>{$('#whatsapp-broadcast-message').focus();window.scrollTo({top:0,behavior:'smooth'})};$('#newsletter-refresh').onclick=()=>loadWhatsAppBroadcast().catch(error=>toast(error.message,'error'));$('#whatsapp-start').onclick=startWhatsAppQueue;
  $('#whatsapp-copy-message').onclick=async()=>{try{await copyText(composeWhatsAppBroadcast());toast('ההודעה הועתקה')}catch(error){toast(error.message,'error')}};
  $('#whatsapp-copy-phones').onclick=async()=>{try{await copyText(state.whatsappRecipients.map(item=>item.whatsapp_phone).join('\n'));toast('רשימת המספרים הועתקה')}catch(error){toast(error.message,'error')}};
  $('#whatsapp-download-csv').onclick=()=>{if(!state.whatsappRecipients.length){toast('אין מספרים להורדה.','error');return}downloadText('camp-whatsapp-contacts.csv',whatsappCsv(),'text/csv;charset=utf-8')};
  $('#whatsapp-open-current').onclick=openCurrentWhatsApp;$('#whatsapp-prev').onclick=()=>{state.whatsappIndex=Math.max(0,state.whatsappIndex-1);renderWhatsAppQueue()};$('#whatsapp-next').onclick=()=>{state.whatsappIndex=Math.min(state.whatsappRecipients.length-1,state.whatsappIndex+1);renderWhatsAppQueue()};
}

function formatAnalyticsDuration(value){
  const seconds=Math.max(0,Math.round(Number(value)||0));
  if(seconds<60)return `${seconds} שנ׳`;
  if(seconds<3600)return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} דק׳`;
  return `${Math.floor(seconds/3600)}:${String(Math.floor((seconds%3600)/60)).padStart(2,'0')} שע׳`;
}

function analyticsPageLabel(pageKey,pageTitle=''){
  const title=String(pageTitle||'').trim();
  if(title&&!/^https?:|^\//.test(title))return title.replace(/\s*\|\s*קעמפ גן ישראל חדרה\s*$/,'');
  const key=String(pageKey||'/');
  if(key==='/'||key==='index')return 'דף הבית';
  if(key.startsWith('day/'))return `גלריה — ${key.slice(4)}`;
  return key;
}

function analyticsSourceLabel(value){return({direct:'כניסה ישירה',google:'Google',whatsapp:'WhatsApp',facebook:'Facebook',instagram:'Instagram',telegram:'Telegram',other:'אתר אחר'})[value]||value||'לא ידוע'}
function analyticsDeviceLabel(value){return({mobile:'טלפון',desktop:'מחשב',tablet:'טאבלט',unknown:'לא ידוע'})[value]||value}
function analyticsDeviceIcon(value){return({mobile:'📱',desktop:'💻',tablet:'▣',unknown:'❔'})[value]||'🔗'}
function analyticsPercent(value){return `${Math.round(Number(value)||0)}%`}

function setAnalyticsChange(selector,item,{inverse=false}={}){
  const node=$(selector);if(!node)return;
  const delta=Number(item?.delta||0),good=inverse?delta<=0:delta>=0;
  node.className=`analytics-change ${good?'positive':'negative'}`;
  node.textContent=`${delta>0?'↑':delta<0?'↓':'•'} ${Math.abs(delta)}% מהתקופה הקודמת`;
}

function activateAnalyticsTab(tab){
  state.analyticsTab=tab;
  $$('[data-analytics-tab]').forEach(button=>button.classList.toggle('active',button.dataset.analyticsTab===tab));
  $$('[data-analytics-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.analyticsPanel===tab));
}

function renderAnalyticsSummary(data){
  const summary=data.summary||{},comparison=data.comparison||{};
  setText('#analytics-visitors',formatNumber(summary.unique_visitors));
  setText('#analytics-sessions',formatNumber(summary.sessions));
  setText('#analytics-pageviews',formatNumber(summary.page_views));
  setText('#analytics-average-session',formatAnalyticsDuration(summary.average_session_seconds));
  setText('#analytics-returning',analyticsPercent(summary.returning_rate));
  setText('#analytics-quick-exit',analyticsPercent(summary.quick_exit_rate));
  setText('#analytics-active-now',formatNumber(summary.active_connections));
  setText('#analytics-legacy-views',formatNumber(data.legacy_views||0));
  setText('#analytics-period-summary',`${formatNumber(summary.unique_visitors)} מבקרים · ${formatNumber(summary.sessions)} ביקורים · ${formatAnalyticsDuration(summary.engaged_seconds)} זמן פעיל`);
  setAnalyticsChange('#analytics-change-visitors',comparison.unique_visitors);
  setAnalyticsChange('#analytics-change-sessions',comparison.sessions);
  setAnalyticsChange('#analytics-change-pageviews',comparison.page_views);
  setAnalyticsChange('#analytics-change-time',comparison.average_session_seconds);
  setAnalyticsChange('#analytics-change-returning',comparison.returning_rate);
  setAnalyticsChange('#analytics-change-bounce',comparison.quick_exit_rate,{inverse:true});
}

function renderAnalyticsPages(data){
  const body=$('#analytics-pages-body');if(!body)return;
  body.innerHTML=data.pages?.length?data.pages.map(page=>`<tr>
    <td><strong>${escapeHtml(analyticsPageLabel(page.page_key,page.page_title))}</strong><small>${escapeHtml(page.page_key)}</small></td>
    <td>${formatNumber(page.visitors)}</td>
    <td>${formatNumber(page.sessions)}</td>
    <td>${formatNumber(page.page_views)}</td>
    <td>${formatAnalyticsDuration(page.average_seconds)}</td>
    <td>${formatAnalyticsDuration(page.engaged_seconds)}</td>
    <td><span class="analytics-meter"><i style="width:${Math.min(100,Number(page.average_scroll)||0)}%"></i></span>${analyticsPercent(page.average_scroll)}</td>
    <td><span class="quick-exit ${Number(page.quick_exit_rate)<=20?'good':Number(page.quick_exit_rate)>=45?'bad':''}">${analyticsPercent(page.quick_exit_rate)}</span></td>
  </tr>`).join(''):'<tr><td colspan="8"><div class="admin-empty">הנתונים המפורטים יתחילו להופיע לאחר פריסת V24</div></td></tr>';
}

function contentMetric(item,key){return Number(item?.metrics?.[key]||0)}
function contentCompletion(item,startKey='start'){const starts=contentMetric(item,startKey),complete=contentMetric(item,'complete');return starts?Math.round(complete/starts*100):0}

function renderVideoContent(items){
  const node=$('#analytics-videos');if(!node)return;
  node.innerHTML=items?.length?items.map(item=>{const start=contentMetric(item,'start'),q25=contentMetric(item,'q25'),q50=contentMetric(item,'q50'),q75=contentMetric(item,'q75'),complete=contentMetric(item,'complete'),seconds=contentMetric(item,'watch_seconds');return `<article class="content-analytics-item"><div class="content-analytics-head"><strong>${escapeHtml(item.content_label)}</strong><b>${analyticsPercent(contentCompletion(item))} השלימו</b></div><div class="video-funnel"><span style="--value:100%"><i></i><small>${formatNumber(start)} התחילו</small></span><span style="--value:${start?q25/start*100:0}%"><i></i><small>${formatNumber(q25)} הגיעו ל־25%</small></span><span style="--value:${start?q50/start*100:0}%"><i></i><small>${formatNumber(q50)} הגיעו לחצי</small></span><span style="--value:${start?q75/start*100:0}%"><i></i><small>${formatNumber(q75)} הגיעו ל־75%</small></span><span style="--value:${start?complete/start*100:0}%"><i></i><small>${formatNumber(complete)} סיימו</small></span></div><footer>זמן צפייה: <strong>${formatAnalyticsDuration(seconds)}</strong></footer></article>`}).join(''):'<div class="admin-empty">עוד אין נתוני צפייה בסרטונים</div>';
}

function renderAudioContent(items){
  const node=$('#analytics-audio');if(!node)return;
  node.innerHTML=items?.length?items.map(item=>{const starts=contentMetric(item,'start'),complete=contentMetric(item,'complete'),seconds=contentMetric(item,'listen_seconds');return `<article class="compact-content-item"><span>🎵</span><div><strong>${escapeHtml(item.content_label)}</strong><small>${formatNumber(starts)} הפעלות · ${formatNumber(complete)} סיומים · ${formatAnalyticsDuration(seconds)} האזנה</small><span class="rank-bar"><i style="width:${starts?Math.min(100,complete/starts*100):0}%"></i></span></div><b>${analyticsPercent(contentCompletion(item))}</b></article>`}).join(''):'<div class="admin-empty">עוד אין נתוני האזנה</div>';
}

function renderGalleryContent(items){
  const node=$('#analytics-galleries');if(!node)return;
  node.innerHTML=items?.length?items.map(item=>{const open=contentMetric(item,'open'),complete=contentMetric(item,'complete'),itemsOpened=contentMetric(item,'item_open')+contentMetric(item,'video_open'),downloads=contentMetric(item,'download');return `<article class="compact-content-item"><span>📸</span><div><strong>${escapeHtml(item.content_label)}</strong><small>${formatNumber(open)} פתיחות · ${formatNumber(itemsOpened)} פריטים נצפו · ${formatNumber(downloads)} הורדות</small><span class="rank-bar"><i style="width:${open?Math.min(100,complete/open*100):0}%"></i></span></div><b>${open?analyticsPercent(complete/open*100):'0%'}</b></article>`}).join(''):'<div class="admin-empty">עוד אין נתוני גלריות</div>';
}

function renderActionContent(items){
  const node=$('#analytics-actions');if(!node)return;
  node.innerHTML=items?.length?items.map(item=>{const total=Object.entries(item.metrics||{}).filter(([key])=>!key.endsWith('_seconds')).reduce((sum,[,value])=>sum+Number(value||0),0);return `<article class="compact-content-item"><span>🎯</span><div><strong>${escapeHtml(item.content_label)}</strong><small>${escapeHtml(Object.entries(item.metrics||{}).map(([key,value])=>`${key}: ${formatNumber(value)}`).join(' · '))}</small></div><b>${formatNumber(total)}</b></article>`}).join(''):'<div class="admin-empty">עוד אין פעולות נוספות</div>';
}

function renderBreakdown(selector,items,labelFn,iconFn){
  const node=$(selector);if(!node)return;
  const max=Math.max(1,...(items||[]).map(item=>Number(item.sessions||0)));
  node.innerHTML=items?.length?items.map(item=>{const key=item.source??item.device;return `<div class="breakdown-row"><span class="breakdown-icon">${iconFn?iconFn(key):'↗'}</span><div><strong>${escapeHtml(labelFn(key))}</strong><small>${formatNumber(item.visitors)} מבקרים · ${formatNumber(item.sessions)} ביקורים</small><span class="rank-bar"><i style="width:${Number(item.sessions||0)/max*100}%"></i></span></div><b>${formatNumber(item.sessions)}</b></div>`}).join(''):'<div class="admin-empty">עוד אין נתונים</div>';
}

function renderAnalyticsInsights(data){
  const insights=[];
  const topPage=data.pages?.[0];
  if(topPage)insights.push(['🏆','העמוד המוביל',`${analyticsPageLabel(topPage.page_key,topPage.page_title)} עם ${formatNumber(topPage.page_views)} צפיות`]);
  const source=data.sources?.[0];
  if(source)insights.push(['↗','מקור הכניסה המרכזי',`${analyticsSourceLabel(source.source)} הביא ${formatNumber(source.sessions)} ביקורים`]);
  const device=data.devices?.[0];
  if(device)insights.push([analyticsDeviceIcon(device.device),'המכשיר הנפוץ',`${analyticsDeviceLabel(device.device)} — ${formatNumber(device.sessions)} ביקורים`]);
  const video=(data.content?.videos||[]).filter(item=>contentMetric(item,'start')>0).sort((a,b)=>contentCompletion(b)-contentCompletion(a))[0];
  if(video)insights.push(['🎬','הסרטון שמחזיק הכי טוב',`${video.content_label} — ${analyticsPercent(contentCompletion(video))} השלמה`]);
  $('#analytics-insights').innerHTML=insights.length?insights.map(([icon,title,text])=>`<article><span>${icon}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(text)}</small></div></article>`).join(''):'<div class="admin-empty">התובנות יופיעו לאחר הצטברות נתונים</div>';
}

function renderActivePages(data){
  $('#active-pages').innerHTML=data.active_pages?.length?data.active_pages.map(page=>`<div class="active-page-row"><span class="live-dot"></span><strong>${escapeHtml(analyticsPageLabel(page.page_key))}</strong><b>${formatNumber(page.active)}</b></div>`).join(''):'<div class="admin-empty">אין כרגע מבקרים פעילים</div>';
}

function renderAnalytics(data){
  renderAnalyticsSummary(data);
  renderAnalyticsChart();
  renderAnalyticsPages(data);
  renderVideoContent(data.content?.videos||[]);
  renderAudioContent(data.content?.audio||[]);
  renderGalleryContent(data.content?.galleries||[]);
  renderActionContent(data.content?.actions||[]);
  renderBreakdown('#analytics-sources',data.sources||[],analyticsSourceLabel);
  renderBreakdown('#analytics-devices',data.devices||[],analyticsDeviceLabel,analyticsDeviceIcon);
  renderAnalyticsInsights(data);
  renderActivePages(data);
}

async function loadAnalytics(){
  const days=$('#analytics-days')?.value||30;
  const data=await api(`/api/admin/analytics?days=${days}`);
  state.analyticsData=data;
  renderAnalytics(data);
  clearTimeout(window._analyticsLiveTimer);
  window._analyticsLiveTimer=setTimeout(()=>{if(state.view==='analytics')loadAnalytics().catch(()=>{})},20000);
}

function analyticsChartValue(row,metric){return Number(row?.[metric]||0)}
function analyticsChartLabel(metric,value){return metric==='engaged_seconds'?formatAnalyticsDuration(value):formatNumber(value)}

function renderAnalyticsChart(){
  const data=state.analyticsData;if(!data)return;
  const canvas=$('#analytics-chart');if(!canvas)return;
  const metric=$('#analytics-metric')?.value||state.analyticsMetric||'page_views';
  state.analyticsMetric=metric;
  const timeline=data.timeline||[],dpr=devicePixelRatio||1,width=canvas.clientWidth||700,height=270;
  canvas.width=width*dpr;canvas.height=height*dpr;
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const css=getComputedStyle(document.documentElement),line=css.getPropertyValue('--line').trim(),primary=css.getPropertyValue('--primary').trim(),muted=css.getPropertyValue('--muted').trim();
  const values=timeline.map(row=>analyticsChartValue(row,metric)),max=Math.max(1,...values);
  ctx.font='11px Arial';ctx.fillStyle=muted;ctx.textAlign='left';
  for(let i=0;i<5;i++){
    const ratio=1-i/4,y=24+i*(height-64)/4,value=Math.round(max*ratio);
    ctx.strokeStyle=line;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(48,y);ctx.lineTo(width-10,y);ctx.stroke();ctx.fillText(analyticsChartLabel(metric,value),4,y+4);
  }
  if(!values.length)return;
  const points=values.map((value,index)=>({x:55+index*(width-75)/Math.max(1,values.length-1),y:height-40-value/max*(height-75),value,row:timeline[index]}));
  const gradient=ctx.createLinearGradient(0,30,0,height);gradient.addColorStop(0,`${primary}38`);gradient.addColorStop(1,`${primary}00`);
  ctx.beginPath();points.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.lineTo(points.at(-1).x,height-40);ctx.lineTo(points[0].x,height-40);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
  ctx.beginPath();points.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.strokeStyle=primary;ctx.lineWidth=3;ctx.lineJoin='round';ctx.stroke();
  ctx.fillStyle=primary;points.forEach(point=>{ctx.beginPath();ctx.arc(point.x,point.y,4,0,Math.PI*2);ctx.fill()});
  ctx.fillStyle=muted;ctx.textAlign='center';const step=Math.max(1,Math.ceil(points.length/7));points.forEach((point,index)=>{if(index%step===0||index===points.length-1){const date=new Date(`${point.row.day}T12:00:00Z`);ctx.fillText(`${date.getUTCDate()}/${date.getUTCMonth()+1}`,point.x,height-17)}});
}

async function loadHealth(){try{const data=await api('/api/admin/health');state.health=data;renderHealth(data)}catch(error){renderHealth({ok:false,checks:[{name:'המערכת',ok:false,detail:error.message}]})}}
function renderHealth(data){$('#system-dot').className=`system-dot ${data.ok?'ok':'error'}`;const hero=$('#health-hero');hero.className=`health-hero ${data.ok?'ok':'error'}`;hero.innerHTML=`<span>${data.ok?'✅':'⚠️'}</span><div><h3>${data.ok?'המערכת פועלת מצוין':'נדרשת השלמת הגדרה'}</h3><p>${data.ok?'D1, R2 והאבטחה מחוברים ופועלים.':'עברו על הבדיקות והשלימו את הפריטים האדומים.'}</p></div>`;$('#health-grid').innerHTML=(data.checks||[]).map(c=>`<article class="health-card"><span>${c.ok?'✅':'❌'}</span><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.detail)}</p></article>`).join('')}


async function loadFaqAdmin(){
  const data=await api('/api/admin/faq');state.faq=data.faq||[];renderFaqAdmin();
}
function renderFaqAdmin(){
  const list=$('#faq-admin-list');if(!list)return;
  list.innerHTML=state.faq.length?state.faq.map((item,index)=>`<article class="faq-admin-card"><div class="faq-admin-order">${index+1}</div><div class="faq-admin-copy"><strong>${escapeHtml(item.question)}</strong><p>${escapeHtml(item.answer)}</p><small>${item.visible?'מוצג באתר':'מוסתר'} · סדר ${Number(item.sort_order||0)}</small></div><div class="faq-admin-actions"><button type="button" data-faq-move="up" data-id="${item.id}" ${index===0?'disabled':''}>↑</button><button type="button" data-faq-move="down" data-id="${item.id}" ${index===state.faq.length-1?'disabled':''}>↓</button><button type="button" data-faq-edit="${item.id}">עריכה</button></div></article>`).join(''):'<div class="admin-empty">עדיין אין שאלות. לחצו על “הוספת שאלה”.</div>';
  $$('[data-faq-edit]',list).forEach(b=>b.onclick=()=>openFaqModal(state.faq.find(x=>x.id===Number(b.dataset.faqEdit))));
  $$('[data-faq-move]',list).forEach(b=>b.onclick=()=>moveFaq(Number(b.dataset.id),b.dataset.faqMove));
}
function openFaqModal(item=null){
  const form=$('#faq-form');form.reset();form.elements.id.value=item?.id||'';form.elements.question.value=item?.question||'';form.elements.answer.value=item?.answer||'';form.elements.sort_order.value=item?.sort_order??state.faq.length;form.elements.visible.checked=item?item.visible!==false:true;setText('#faq-modal-title',item?'עריכת שאלה':'הוספת שאלה');$('#delete-faq').classList.toggle('is-hidden',!item);formStatus(form,'');$('#faq-modal').showModal();
}
async function moveFaq(id,direction){
  const index=state.faq.findIndex(x=>x.id===id),otherIndex=direction==='up'?index-1:index+1;if(index<0||otherIndex<0||otherIndex>=state.faq.length)return;
  const a=state.faq[index],b=state.faq[otherIndex],aOrder=Number(a.sort_order||index),bOrder=Number(b.sort_order||otherIndex);
  await api('/api/admin/faq',{method:'PATCH',body:JSON.stringify({...a,sort_order:bOrder})});await api('/api/admin/faq',{method:'PATCH',body:JSON.stringify({...b,sort_order:aOrder})});await loadFaqAdmin();
}
function initFaqAdmin(){
  $('#create-faq')?.addEventListener('click',()=>openFaqModal());
  $('#faq-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form));data.sort_order=Number(data.sort_order)||0;data.visible=form.elements.visible.checked;const id=Number(data.id)||0;delete data.id;try{await api('/api/admin/faq',{method:id?'PATCH':'POST',body:JSON.stringify(id?{...data,id}:data)});toast(id?'השאלה עודכנה':'השאלה נוספה');$('#faq-modal').close();await loadFaqAdmin()}catch(error){formStatus(form,error.message,'error')}});
  $('#delete-faq')?.addEventListener('click',async()=>{const id=Number($('#faq-form').elements.id.value);if(!id||!confirm('למחוק את השאלה לצמיתות?'))return;await api('/api/admin/faq',{method:'DELETE',body:JSON.stringify({id})});$('#faq-modal').close();toast('השאלה נמחקה');await loadFaqAdmin();});
}


async function loadTeamAdmin(){
  const data=await api('/api/admin/team');state.teamRoles=data.roles||[];renderTeamAdmin();
}
function renderTeamAdmin(){
  const list=$('#team-admin-list');if(!list)return;
  list.innerHTML=state.teamRoles.length?state.teamRoles.map((item,index)=>`<article class="faq-admin-card team-admin-card"><div class="faq-admin-order">${escapeHtml(item.icon||'👤')}</div><div class="faq-admin-copy"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.subtitle||item.description)}</p><small>${item.visible?'מוצג באתר':'מוסתר'}${item.featured?' · מודגש':''} · סדר ${Number(item.sort_order||0)}</small></div><div class="faq-admin-actions"><button type="button" data-team-move="up" data-id="${item.id}" ${index===0?'disabled':''}>↑</button><button type="button" data-team-move="down" data-id="${item.id}" ${index===state.teamRoles.length-1?'disabled':''}>↓</button><button type="button" data-team-edit="${item.id}">עריכה</button></div></article>`).join(''):'<div class="admin-empty">עדיין אין תפקידים. לחצו על “הוספת תפקיד”.</div>';
  $$('[data-team-edit]',list).forEach(b=>b.onclick=()=>openTeamRoleModal(state.teamRoles.find(x=>x.id===Number(b.dataset.teamEdit))));
  $$('[data-team-move]',list).forEach(b=>b.onclick=()=>moveTeamRole(Number(b.dataset.id),b.dataset.teamMove));
}
function openTeamRoleModal(item=null){
  const form=$('#team-role-form');form.reset();form.elements.id.value=item?.id||'';form.elements.title.value=item?.title||'';form.elements.subtitle.value=item?.subtitle||'';form.elements.description.value=item?.description||'';form.elements.icon.value=item?.icon||'';form.elements.sort_order.value=item?.sort_order??state.teamRoles.length;form.elements.featured.checked=item?item.featured===true:false;form.elements.visible.checked=item?item.visible!==false:true;setText('#team-role-modal-title',item?'עריכת תפקיד':'הוספת תפקיד');$('#delete-team-role').classList.toggle('is-hidden',!item);formStatus(form,'');$('#team-role-modal').showModal();
}
async function moveTeamRole(id,direction){
  const index=state.teamRoles.findIndex(x=>x.id===id),otherIndex=direction==='up'?index-1:index+1;if(index<0||otherIndex<0||otherIndex>=state.teamRoles.length)return;
  const a=state.teamRoles[index],b=state.teamRoles[otherIndex],aOrder=Number(a.sort_order||index),bOrder=Number(b.sort_order||otherIndex);
  await api('/api/admin/team',{method:'PATCH',body:JSON.stringify({...a,sort_order:bOrder})});await api('/api/admin/team',{method:'PATCH',body:JSON.stringify({...b,sort_order:aOrder})});await loadTeamAdmin();
}
function initTeamAdmin(){
  $('#create-team-role')?.addEventListener('click',()=>openTeamRoleModal());
  $('#team-role-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form));data.sort_order=Number(data.sort_order)||0;data.featured=form.elements.featured.checked;data.visible=form.elements.visible.checked;const id=Number(data.id)||0;delete data.id;try{await api('/api/admin/team',{method:id?'PATCH':'POST',body:JSON.stringify(id?{...data,id}:data)});toast(id?'התפקיד עודכן':'התפקיד נוסף');$('#team-role-modal').close();await loadTeamAdmin()}catch(error){formStatus(form,error.message,'error')}});
  $('#delete-team-role')?.addEventListener('click',async()=>{const id=Number($('#team-role-form').elements.id.value);if(!id||!confirm('למחוק את התפקיד לצמיתות?'))return;await api('/api/admin/team',{method:'DELETE',body:JSON.stringify({id})});$('#team-role-modal').close();toast('התפקיד נמחק');await loadTeamAdmin();});
}

function initTheme(){const stored=localStorage.getItem('camp-admin-theme');if(stored==='dark')document.body.classList.add('dark');$('#admin-theme').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('camp-admin-theme',document.body.classList.contains('dark')?'dark':'light');if(state.view==='analytics')loadAnalytics()}}
function initMisc(){
  $('#change-password-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;formStatus(form,'מעדכן...');try{const data=Object.fromEntries(new FormData(form));await api('/api/admin/password',{method:'POST',body:JSON.stringify(data)});form.reset();formStatus(form,'הסיסמה שונתה בהצלחה','success');toast('הסיסמה שונתה')}catch(error){formStatus(form,error.message,'error')}});$$('[data-close-dialog]').forEach(button=>button.onclick=()=>button.closest('dialog')?.close());$('#health-refresh').onclick=loadHealth;$('#analytics-days').onchange=loadAnalytics;$('#analytics-metric').onchange=renderAnalyticsChart;$$('[data-analytics-tab]').forEach(button=>button.onclick=()=>activateAnalyticsTab(button.dataset.analyticsTab));window.addEventListener('resize',()=>{if(state.view==='analytics')clearTimeout(window._chartTimer),window._chartTimer=setTimeout(renderAnalyticsChart,150)})}
async function boot(){initAuth();initNavigation();initDayForm();initMedia();initSettings();initAnnouncements();initTestimonials();initSubscribers();initNewsletter();initContacts();initTeamAdmin();initTheme();initMisc();try{const response=await fetch('/api/admin/session',{credentials:'same-origin'}),data=await response.json().catch(()=>({}));if(response.ok&&data.authenticated)await showApp(data);else showLogin()}catch{showLogin()}}
document.addEventListener('DOMContentLoaded',boot);

document.addEventListener('DOMContentLoaded',()=>initFaqAdmin());
