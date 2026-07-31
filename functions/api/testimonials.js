export async function onRequestPost({ request, env }) {
  try {
    const b=await request.json().catch(()=>({}));
    const name=String(b.name||'').trim().slice(0,160), relation=String(b.relation||'').trim().slice(0,160), phone=String(b.phone||'').trim().slice(0,80), message=String(b.message||'').trim().slice(0,3000), rating=Math.min(5,Math.max(1,Number(b.rating)||5));
    if(name.length<2||message.length<10)return Response.json({error:'יש להזין שם ותגובה של לפחות 10 תווים'}, {status:400});
    await env.DB.prepare("INSERT INTO testimonials(name,relation,phone,rating,message,status,sort_order,updated_at) VALUES(?,?,?,?,?,'pending',0,CURRENT_TIMESTAMP)").bind(name,relation,phone,rating,message).run();
    return Response.json({ok:true});
  } catch(error){return Response.json({error:error.message},{status:500})}
}
