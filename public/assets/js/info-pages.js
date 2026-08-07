const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const escapeHtml=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);

function initShell(){
  const menu=$('#menu-button'),nav=$('#mobile-nav');
  menu?.addEventListener('click',()=>{const open=!nav?.classList.contains('open');nav?.classList.toggle('open',open);menu.classList.toggle('active',open);menu.setAttribute('aria-expanded',String(open));});
  $$('#mobile-nav a').forEach(a=>a.addEventListener('click',()=>{nav?.classList.remove('open');menu?.classList.remove('active');menu?.setAttribute('aria-expanded','false');}));
  const stored=localStorage.getItem('camp-theme');
  if(stored==='dark'||(!stored&&matchMedia('(prefers-color-scheme:dark)').matches))document.body.classList.add('dark');
  $('#theme-toggle')?.addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('camp-theme',document.body.classList.contains('dark')?'dark':'light');});
  const header=$('#site-header');
  const updateHeader=()=>header?.classList.toggle('scrolled',scrollY>8);updateHeader();addEventListener('scroll',updateHeader,{passive:true});
  initReveals();
  $('#current-year') && ($('#current-year').textContent=new Date().getFullYear());
}

function initReveals(){
  const nodes=$$('.reveal,.reveal-up,.reveal-left,.reveal-right,.reveal-scale');
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){nodes.forEach(n=>n.classList.add('visible'));return;}
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;const node=entry.target;node.style.transitionDelay=`${node.dataset.delay||0}ms`;node.classList.add('visible');observer.unobserve(node);}),{threshold:.12,rootMargin:'0px 0px -4%'});
  nodes.forEach(node=>observer.observe(node));
}

async function loadFaq(){
  const list=$('#faq-list');if(!list)return;
  try{
    const res=await fetch('/api/faq',{headers:{accept:'application/json'}}),data=await res.json();
    if(!res.ok)throw new Error(data.message||'לא הצלחנו לטעון את השאלות');
    const rows=(data.faq||[]).filter(x=>x.visible!==false);
    list.innerHTML=rows.length?rows.map((item,i)=>`<article class="faq-item reveal-up" data-delay="${Math.min(i*45,360)}"><button class="faq-question" type="button" aria-expanded="false"><span>${escapeHtml(item.question)}</span><i aria-hidden="true">＋</i></button><div class="faq-answer"><div><p>${escapeHtml(item.answer).replace(/\n/g,'<br>')}</p></div></div></article>`).join(''):'<div class="empty-state"><span>💬</span><h3>השאלות בדרך</h3><p>אנחנו מעדכנים את כל מה שחשוב לדעת.</p></div>';
    $$('.faq-question',list).forEach(btn=>btn.addEventListener('click',()=>{const item=btn.closest('.faq-item'),open=item.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));btn.querySelector('i').textContent=open?'−':'＋';}));
    initReveals();
  }catch(e){list.innerHTML='<div class="empty-state"><span>⚠️</span><h3>לא הצלחנו לטעון כרגע</h3><p>נסו שוב בעוד רגע.</p></div>';}
}

document.addEventListener('DOMContentLoaded',()=>{initShell();loadFaq();window.CampAnalytics?.start(location.pathname||'/');});
