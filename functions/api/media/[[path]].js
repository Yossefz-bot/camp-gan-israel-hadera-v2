const MIME_BY_EXTENSION = new Map([
  ['mp4', 'video/mp4'],
  ['m4v', 'video/mp4'],
  ['mov', 'video/quicktime'],
  ['webm', 'video/webm'],
  ['mp3', 'audio/mpeg'],
  ['m4a', 'audio/mp4'],
  ['aac', 'audio/aac'],
  ['wav', 'audio/wav'],
  ['ogg', 'audio/ogg'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
  ['avif', 'image/avif'],
  ['pdf', 'application/pdf']
]);

function cleanText(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function mediaKey(params) {
  const raw = Array.isArray(params?.path)
    ? params.path.join('/')
    : params?.path;

  const key = cleanText(raw);

  if (
    !key ||
    key.includes('..') ||
    key.startsWith('/') ||
    key.includes('\\') ||
    key.includes('\0')
  ) {
    return '';
  }

  return key;
}

function fallbackContentType(key) {
  const extension = key.split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXTENSION.get(extension) || 'application/octet-stream';
}

function buildHeaders(object, key, requestUrl) {
  const headers = new Headers();

  object.writeHttpMetadata?.(headers);

  const storedType = String(headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (
    !storedType ||
    storedType === 'application/octet-stream' ||
    storedType === 'binary/octet-stream'
  ) {
    headers.set('content-type', fallbackContentType(key));
  }

  if (object.httpEtag) {
    headers.set('etag', object.httpEtag);
  }

  if (object.uploaded) {
    headers.set(
      'last-modified',
      new Date(object.uploaded).toUTCString()
    );
  }

  headers.set('accept-ranges', 'bytes');
  headers.set(
    'cache-control',
    'public, max-age=3600, stale-while-revalidate=86400, no-transform'
  );
  headers.set('x-content-type-options', 'nosniff');
  headers.set('access-control-allow-origin', '*');
  headers.set(
    'access-control-expose-headers',
    'Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag, Last-Modified'
  );
  headers.set('cross-origin-resource-policy', 'cross-origin');

  const url = new URL(requestUrl);
  const originalName =
    object.customMetadata?.originalName ||
    key.split('/').pop() ||
    'media';

  const disposition =
    url.searchParams.get('download') === '1'
      ? 'attachment'
      : 'inline';

  headers.set(
    'content-disposition',
    `${disposition}; filename*=UTF-8''${encodeURIComponent(originalName)}`
  );

  return headers;
}

function parseSingleRange(rangeHeader, totalSize) {
  if (!rangeHeader) {
    return null;
  }

  const value = rangeHeader.trim();

  if (value.includes(',')) {
    return { error: true };
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(value);

  if (!match || totalSize <= 0) {
    return { error: true };
  }

  const startText = match[1];
  const endText = match[2];

  if (!startText && !endText) {
    return { error: true };
  }

  let start;
  let end;

  if (!startText) {
    const requestedSuffix = Number(endText);

    if (
      !Number.isSafeInteger(requestedSuffix) ||
      requestedSuffix <= 0
    ) {
      return { error: true };
    }

    const length = Math.min(requestedSuffix, totalSize);
    start = totalSize - length;
    end = totalSize - 1;
  } else {
    start = Number(startText);

    if (
      !Number.isSafeInteger(start) ||
      start < 0 ||
      start >= totalSize
    ) {
      return { error: true };
    }

    if (endText) {
      end = Number(endText);

      if (
        !Number.isSafeInteger(end) ||
        end < start
      ) {
        return { error: true };
      }

      end = Math.min(end, totalSize - 1);
    } else {
      end = totalSize - 1;
    }
  }

  return {
    start,
    end,
    length: end - start + 1,
    r2Range: {
      offset: start,
      length: end - start + 1
    }
  };
}

function ifRangeAllowsPartial(request, object) {
  const ifRange = request.headers.get('if-range');

  if (!ifRange) {
    return true;
  }

  const value = ifRange.trim();

  if (value.startsWith('"') || value.startsWith('W/"')) {
    return value === object.httpEtag;
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime()) ||
    !object.uploaded
  ) {
    return false;
  }

  return new Date(object.uploaded).getTime() <= date.getTime();
}

function isNotModified(request, object) {
  const ifNoneMatch = request.headers.get('if-none-match');

  if (!ifNoneMatch || !object.httpEtag) {
    return false;
  }

  return ifNoneMatch
    .split(',')
    .map(value => value.trim())
    .some(value => value === '*' || value === object.httpEtag);
}

function response416(object, key, requestUrl) {
  const headers = buildHeaders(object, key, requestUrl);
  headers.set('content-range', `bytes */${object.size}`);
  headers.set('content-length', '0');

  return new Response(null, {
    status: 416,
    headers
  });
}

async function serve(context, headOnly = false) {
  const { params, env, request } = context;

  if (!env.MEDIA) {
    return new Response(
      'Media binding is not configured',
      { status: 503 }
    );
  }

  const key = mediaKey(params);

  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const requestedRange = request.headers.get('range');

    /*
     * Safari שולח בקשות Range לנגינת וידאו.
     * Cloudflare R2 דורש אובייקט R2Range מסוג
     * { offset, length } — לא Headers.
     */
    if (requestedRange) {
      const metadata = await env.MEDIA.head(key);

      if (!metadata) {
        return new Response('Not found', { status: 404 });
      }

      if (isNotModified(request, metadata)) {
        const headers = buildHeaders(
          metadata,
          key,
          request.url
        );

        return new Response(null, {
          status: 304,
          headers
        });
      }

      if (!ifRangeAllowsPartial(request, metadata)) {
        const fullObject = await env.MEDIA.get(key);

        if (!fullObject || !('body' in fullObject)) {
          return new Response('Not found', { status: 404 });
        }

        const headers = buildHeaders(
          fullObject,
          key,
          request.url
        );

        headers.set(
          'content-length',
          String(fullObject.size)
        );

        return new Response(
          headOnly ? null : fullObject.body,
          {
            status: 200,
            headers
          }
        );
      }

      const parsedRange = parseSingleRange(
        requestedRange,
        metadata.size
      );

      if (!parsedRange || parsedRange.error) {
        return response416(
          metadata,
          key,
          request.url
        );
      }

      if (headOnly) {
        const headers = buildHeaders(
          metadata,
          key,
          request.url
        );

        headers.set(
          'content-range',
          `bytes ${parsedRange.start}-${parsedRange.end}/${metadata.size}`
        );
        headers.set(
          'content-length',
          String(parsedRange.length)
        );

        return new Response(null, {
          status: 206,
          headers
        });
      }

      const object = await env.MEDIA.get(key, {
        range: parsedRange.r2Range
      });

      if (!object || !('body' in object)) {
        return new Response('Not found', { status: 404 });
      }

      const headers = buildHeaders(
        object,
        key,
        request.url
      );

      headers.set(
        'content-range',
        `bytes ${parsedRange.start}-${parsedRange.end}/${metadata.size}`
      );
      headers.set(
        'content-length',
        String(parsedRange.length)
      );

      return new Response(object.body, {
        status: 206,
        headers
      });
    }

    const object = headOnly
      ? await env.MEDIA.head(key)
      : await env.MEDIA.get(key);

    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    if (isNotModified(request, object)) {
      const headers = buildHeaders(
        object,
        key,
        request.url
      );

      return new Response(null, {
        status: 304,
        headers
      });
    }

    if (!headOnly && !('body' in object)) {
      return new Response(null, {
        status: 304,
        headers: buildHeaders(
          object,
          key,
          request.url
        )
      });
    }

    const headers = buildHeaders(
      object,
      key,
      request.url
    );

    headers.set(
      'content-length',
      String(object.size)
    );

    return new Response(
      headOnly ? null : object.body,
      {
        status: 200,
        headers
      }
    );
  } catch (error) {
    console.error('media delivery failed', {
      key,
      message: error?.message,
      stack: error?.stack
    });

    return new Response(
      `Media error: ${error?.message || 'unknown error'}`,
      { status: 500 }
    );
  }
}

export function onRequestGet(context) {
  return serve(context, false);
}

export function onRequestHead(context) {
  return serve(context, true);
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, HEAD, OPTIONS',
      'access-control-allow-headers':
        'Range, If-Range, If-None-Match',
      'access-control-max-age': '86400'
    }
  });
}
