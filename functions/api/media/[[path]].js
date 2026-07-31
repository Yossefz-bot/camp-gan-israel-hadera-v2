export async function onRequestGet({ params, env, request }) {
  const key = Array.isArray(params.path) ? params.path.join('/') : params.path;
  if (!key) return new Response('Not found', { status:404 });
  const object = await env.MEDIA.get(key, { range:request.headers });
  if (!object) return new Response('Not found', { status:404 });
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set('etag',object.httpEtag); headers.set('Accept-Ranges','bytes'); headers.set('Cache-Control','public,max-age=31536000,immutable');
  if (object.range) {
    const range = object.range; headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${object.size}`); headers.set('Content-Length',String(range.length));
  } else headers.set('Content-Length',String(object.size));
  return new Response(object.body,{headers,status:object.range?206:200});
}
