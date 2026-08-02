import { json } from './_shared.js';
export async function onRequestGet({env}){
  if(!env.DB)return json({overrides:[]});
  try{const rows=await env.DB.prepare('SELECT selector,value FROM text_overrides ORDER BY selector').all();return json({overrides:rows.results||[]},200,{'cache-control':'public,max-age=60'});}catch{return json({overrides:[]});}
}
