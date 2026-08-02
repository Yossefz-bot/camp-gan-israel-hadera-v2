import { clean } from '../_shared.js';

export async function onRequestGet({ params, env, request }) {
  if (!env.MEDIA) return new Response('Media binding is not configured', { status: 503 });
  const raw = Array.isArray(params.path) ? params.path.join('/') : params.path;
  const key = clean(raw, 1000);
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });

  try {
    const rangeHeader = request.headers.get('range');
    const object = rangeHeader
      ? await env.MEDIA.get(key, { range: request.headers })
      : await env.MEDIA.get(key);
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('accept-ranges', 'bytes');
    headers.set('cache-control', 'public,max-age=86400,stale-while-revalidate=604800');
    headers.set('x-content-type-options', 'nosniff');
    const url = new URL(request.url);
    if (url.searchParams.get('download') === '1') {
      const original = object.customMetadata?.originalName || key.split('/').pop() || 'download';
      headers.set('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(original)}`);
    }

    if (!('body' in object)) return new Response(null, { status: 304, headers });
    if (object.range) {
      headers.set('content-range', `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
      headers.set('content-length', String(object.range.length));
      return new Response(object.body, { status: 206, headers });
    }
    headers.set('content-length', String(object.size));
    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    console.error('media delivery failed', { key, message: error?.message });
    return new Response(`Media error: ${error?.message || 'unknown error'}`, { status: 500 });
  }
}
