import { integer, json } from '../_shared.js';
import { requireAdmin } from './_auth.js';

export async function onRequestGet({request,env}){
  const auth=await requireAdmin(request,env);if(auth.response)return auth.response;if(!env.DB)return json({error:'db_binding_missing'},503);
  const url=new URL(request.url),days=Math.min(365,Math.max(7,integer(url.searchParams.get('days'),30)));
  try{
    const [timeline,pages,events,total]=await Promise.all([
      env.DB.prepare("SELECT day,SUM(count) AS views FROM analytics_daily WHERE event_key='view' AND day>=date('now',?) GROUP BY day ORDER BY day").bind(`-${days-1} day`).all(),
      env.DB.prepare("SELECT page_key,SUM(count) AS views FROM analytics_daily WHERE event_key='view' AND day>=date('now',?) GROUP BY page_key ORDER BY views DESC LIMIT 20").bind(`-${days-1} day`).all(),
      env.DB.prepare("SELECT event_key,SUM(count) AS count FROM analytics_daily WHERE day>=date('now',?) GROUP BY event_key ORDER BY count DESC").bind(`-${days-1} day`).all(),
      env.DB.prepare("SELECT COALESCE(SUM(count),0) AS n FROM analytics_daily WHERE event_key='view' AND day>=date('now',?)").bind(`-${days-1} day`).first()
    ]);
    return json({days,total_views:Number(total?.n||0),timeline:timeline.results||[],pages:pages.results||[],events:events.results||[]});
  }catch(error){return json({error:'operation_failed',message:error.message},500)}
}
