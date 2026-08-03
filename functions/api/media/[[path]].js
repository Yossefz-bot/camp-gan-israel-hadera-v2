import { clean } from '../_shared.js';

const MIME_BY_EXTENSION = new Map([
  ['mp4','video/mp4'],['m4v','video/x-m4v'],['mov','video/quicktime'],['webm','video/webm'],
  ['mp3','audio/mpeg'],['m4a','audio/mp4'],['aac','audio/aac'],['wav','audio/wav'],['ogg','audio/ogg'],
  ['jpg','image/jpeg'],['jpeg','image/jpeg'],['png','image/png'],['webp','image/webp'],['gif','image/gif'],['avif','image/avif'],
  ['pdf','application/pdf']
]);

function mediaKey(params) {
  const raw = Array.isArray(params.path) ? params.path.join('/') : params.path;
  const key = clean(raw, 1000);
  return key && !key.includes('..') ? key : '';
}

function fallbackContentType(key) {
  const extension = key.split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXTENSION.get(extension) || 'application/octet-stream';
}

function responseHeaders(object, key, requestUrl) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);

  const storedType = String(headers.get('content-type') || '').toLowerCase();
  if (!storedType || storedType === 'application/octet-stream') {
    headers.set('content-type', fallbackContentType(key));
  }

  headers.set('etag', object.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'public,max-age=86400,stale-while-revalidate=604800,no-transform');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('access-control-expose-headers', 'Accept-Ranges,Content-Length,Content-Range,Content-Type,ETag');

  if (object.uploaded) headers.set('last-modified', new Date(object.uploaded).toUTCString());

  const url = new URL(requestUrl);
  const original = object.customMetadata?.originalName || key.split('/').pop() || 'media';
  const disposition = url.searchParams.get('download') === '1' ? 'attachment' : 'inline';
  headers.set('content-disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(original)}`);
  return headers;
}

async function notSatisfiable(env, key, requestUrl) {
  const object = await env.MEDIA.head(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = responseHeaders(object, key, requestUrl);
  headers.set('content-range', `bytes */${object.size}`);
  headers.set('content-length', '0');
  return new Response(null, { status: 416, headers });
}

async function serve({ params, env, request }, headOnly = false) {
  if (!env.MEDIA) return new Response('Media binding is not configured', { status: 503 });
  const key = mediaKey(params);
  if (!key) return new Response('Not found', { status: 404 });

  try {
    if (headOnly) {
      const object = await env.MEDIA.head(key);
      if (!object) return new Response('Not found', { status: 404 });
      const headers = responseHeaders(object, key, request.url);
      headers.set('content-length', String(object.size));
      return new Response(null, { status: 200, headers });
    }

    const rangeHeader = request.headers.get('range');
    if (rangeHeader && (!/^bytes=\d*-\d*$/.test(rangeHeader.trim()) || rangeHeader.includes(','))) {
      return notSatisfiable(env, key, request.url);
    }

    const object = rangeHeader
      ? await env.MEDIA.get(key, { range: new Headers({ Range: rangeHeader }) })
      : await env.MEDIA.get(key);

    if (!object) return new Response('Not found', { status: 404 });
    const headers = responseHeaders(object, key, request.url);

    if (!('body' in object)) return new Response(null, { status: 304, headers });

    if (object.range) {
      const start = Number(object.range.offset || 0);
      const length = Number(object.range.length || 0);
      const end = start + Math.max(0, length - 1);
      headers.set('content-range', `bytes ${start}-${end}/${object.size}`);
      headers.set('content-length', String(length));
      return new Response(object.body, { status: 206, headers });
    }

    headers.set('content-length', String(object.size));
    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    if (request.headers.get('range')) {
      try { return await notSatisfiable(env, key, request.url); } catch {}
    }
    console.error('media delivery failed', { key, message: error?.message });
    return new Response(`Media error: ${error?.message || 'unknown error'}`, { status: 500 });
  }
}

export function onRequestGet(context) {
  return serve(context, false);
}

export function onRequestHead(context) {
  return serve(context, true);
}
