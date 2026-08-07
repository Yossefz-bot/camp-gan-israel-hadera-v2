import { requireAdmin } from './_auth.js';

const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
const defaults=[
  ['הגנרל','מנהל הקעמפ','מוביל את הקעמפ כולו, מחבר בין כל המחלקות ודואג שהחזון, התוכן והשטח יעבדו יחד.','🎖️',0,1,1],
  ['מח״ט','אחריות מערכתית','מתכלל את העבודה בין הגדודים והצוותים, עוקב אחרי הביצוע ודואג שכל יום מתקדם בדיוק לפי התוכנית.','🧭',1,0,1],
  ['מג״ד','מוביל הגדוד','אחראי על האווירה, הסדר וההתקדמות של הגדוד, ומלווה מקרוב את המפקדים והחיילים.','⚡',2,0,1],
  ['סמג״ד','הכוח שמחזיק את השטח','מסייע למג״ד בניהול הגדוד, פותר דברים בזמן אמת ודואג שהפרטים הקטנים לא נופלים בין הכיסאות.','🛡️',3,0,1],
  ['מ״פ','מוביל הפלוגה','מכיר את החיילים מקרוב, מוביל את הפלוגה בפעילויות ובמסדרים ושומר על אנרגיה גבוהה לאורך היום.','📣',4,0,1],
  ['מפקד','הכתובת האישית של החייל','הדמות שנמצאת עם הילדים לאורך היום — מדריכה, מקשיבה, מרימה ויוצרת את החוויה האישית של הקעמפ.','🤝',5,0,1]
];
async function ensure(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS team_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '👤',
    sort_order INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM team_roles').first();
  if(Number(count?.n||0)===0){for(const row of defaults)await env.DB.prepare('INSERT INTO team_roles(title,subtitle,description,icon,sort_order,featured,visible) VALUES(?,?,?,?,?,?,?)').bind(...row).run();}
}
async function body(request){try{return await request.json()}catch{return {}}}
function clean(v,max=1500){return String(v??'').trim().slice(0,max)}
function normalize(x){return {...x,featured:Boolean(x.featured),visible:Boolean(x.visible)}}
export async function onRequestGet({request,env}){const auth=await requireAdmin(request,env);if(auth.response)return auth.response;if(!env.DB)return json({error:'db_binding_missing'},503);await ensure(env);const rows=await env.DB.prepare('SELECT * FROM team_roles ORDER BY sort_order ASC,id ASC').all();return json({roles:(rows.results||[]).map(normalize)});}
export async function onRequestPost({request,env}){const auth=await requireAdmin(request,env);if(auth.response)return auth.response;if(!env.DB)return json({error:'db_binding_missing'},503);await ensure(env);const p=await body(request),title=clean(p.title,100),subtitle=clean(p.subtitle,140),description=clean(p.description,1500),icon=clean(p.icon,20)||'👤';if(title.length<1||description.length<2)return json({message:'יש למלא שם תפקיד והסבר.'},400);const order=Number.isFinite(Number(p.sort_order))?Number(p.sort_order):9999;const result=await env.DB.prepare('INSERT INTO team_roles(title,subtitle,description,icon,sort_order,featured,visible) VALUES(?,?,?,?,?,?,?)').bind(title,subtitle,description,icon,order,p.featured===true?1:0,p.visible===false?0:1).run();return json({ok:true,id:result.meta?.last_row_id});}
export async function onRequestPatch({request,env}){const auth=await requireAdmin(request,env);if(auth.response)return auth.response;if(!env.DB)return json({error:'db_binding_missing'},503);await ensure(env);const p=await body(request),id=Number(p.id);if(!id)return json({message:'חסר מזהה תפקיד.'},400);const title=clean(p.title,100),subtitle=clean(p.subtitle,140),description=clean(p.description,1500),icon=clean(p.icon,20)||'👤';if(title.length<1||description.length<2)return json({message:'יש למלא שם תפקיד והסבר.'},400);const order=Number.isFinite(Number(p.sort_order))?Number(p.sort_order):0;await env.DB.prepare('UPDATE team_roles SET title=?,subtitle=?,description=?,icon=?,sort_order=?,featured=?,visible=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(title,subtitle,description,icon,order,p.featured===true?1:0,p.visible===false?0:1,id).run();return json({ok:true});}
export async function onRequestDelete({request,env}){const auth=await requireAdmin(request,env);if(auth.response)return auth.response;if(!env.DB)return json({error:'db_binding_missing'},503);await ensure(env);const p=await body(request),id=Number(p.id);if(!id)return json({message:'חסר מזהה תפקיד.'},400);await env.DB.prepare('DELETE FROM team_roles WHERE id=?').bind(id).run();return json({ok:true});}
