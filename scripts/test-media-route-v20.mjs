import assert from 'node:assert/strict';
import {
  onRequestGet,
  onRequestHead,
  onRequestOptions
} from '../functions/api/media/[[path]].js';

const bytes = Uint8Array.from(
  { length: 1000 },
  (_, index) => index % 256
);

function makeObject({
  start = 0,
  length = bytes.length,
  contentType = 'application/octet-stream',
  includeBody = true
} = {}) {
  const object = {
    key: 'videos/test.mp4',
    size: bytes.length,
    httpEtag: '"test-etag"',
    uploaded: new Date('2026-08-03T00:00:00Z'),
    customMetadata: {
      originalName: 'סרטון בדיקה.mp4'
    },
    writeHttpMetadata(headers) {
      headers.set('content-type', contentType);
    }
  };

  if (includeBody) {
    object.body = new Blob([
      bytes.slice(start, start + length)
    ]).stream();
  }

  return object;
}

const calls = [];

const env = {
  MEDIA: {
    async head(key) {
      calls.push({ method: 'head', key });
      return key === 'videos/test.mp4'
        ? makeObject({ includeBody: false })
        : null;
    },

    async get(key, options) {
      calls.push({
        method: 'get',
        key,
        range: options?.range
      });

      if (key !== 'videos/test.mp4') {
        return null;
      }

      if (!options?.range) {
        return makeObject();
      }

      assert.equal(
        options.range instanceof Headers,
        false,
        'R2 range must be a plain R2Range object, not Headers'
      );

      const { offset, length } = options.range;

      assert.ok(Number.isInteger(offset));
      assert.ok(Number.isInteger(length));

      return makeObject({
        start: offset,
        length
      });
    }
  }
};

const params = {
  path: ['videos', 'test.mp4']
};

function request(headers = {}, method = 'GET') {
  return new Request(
    'https://example.com/api/media/videos/test.mp4',
    {
      method,
      headers
    }
  );
}

const full = await onRequestGet({
  params,
  env,
  request: request()
});

assert.equal(full.status, 200);
assert.equal(full.headers.get('content-type'), 'video/mp4');
assert.equal(full.headers.get('accept-ranges'), 'bytes');
assert.equal(full.headers.get('content-length'), '1000');
assert.equal((await full.arrayBuffer()).byteLength, 1000);

const firstHundred = await onRequestGet({
  params,
  env,
  request: request({ Range: 'bytes=0-99' })
});

assert.equal(firstHundred.status, 206);
assert.equal(
  firstHundred.headers.get('content-range'),
  'bytes 0-99/1000'
);
assert.equal(
  firstHundred.headers.get('content-length'),
  '100'
);
assert.equal(
  (await firstHundred.arrayBuffer()).byteLength,
  100
);

const openEnded = await onRequestGet({
  params,
  env,
  request: request({ Range: 'bytes=900-' })
});

assert.equal(openEnded.status, 206);
assert.equal(
  openEnded.headers.get('content-range'),
  'bytes 900-999/1000'
);
assert.equal(
  (await openEnded.arrayBuffer()).byteLength,
  100
);

const suffix = await onRequestGet({
  params,
  env,
  request: request({ Range: 'bytes=-50' })
});

assert.equal(suffix.status, 206);
assert.equal(
  suffix.headers.get('content-range'),
  'bytes 950-999/1000'
);
assert.equal(
  (await suffix.arrayBuffer()).byteLength,
  50
);

const clamped = await onRequestGet({
  params,
  env,
  request: request({ Range: 'bytes=950-5000' })
});

assert.equal(clamped.status, 206);
assert.equal(
  clamped.headers.get('content-range'),
  'bytes 950-999/1000'
);
assert.equal(
  (await clamped.arrayBuffer()).byteLength,
  50
);

const invalid = await onRequestGet({
  params,
  env,
  request: request({ Range: 'bytes=2000-3000' })
});

assert.equal(invalid.status, 416);
assert.equal(
  invalid.headers.get('content-range'),
  'bytes */1000'
);

const multiple = await onRequestGet({
  params,
  env,
  request: request({ Range: 'bytes=0-1,4-5' })
});

assert.equal(multiple.status, 416);

const head = await onRequestHead({
  params,
  env,
  request: request({}, 'HEAD')
});

assert.equal(head.status, 200);
assert.equal(head.headers.get('content-length'), '1000');
assert.equal((await head.arrayBuffer()).byteLength, 0);

const rangedHead = await onRequestHead({
  params,
  env,
  request: request(
    { Range: 'bytes=10-19' },
    'HEAD'
  )
});

assert.equal(rangedHead.status, 206);
assert.equal(
  rangedHead.headers.get('content-range'),
  'bytes 10-19/1000'
);
assert.equal(
  rangedHead.headers.get('content-length'),
  '10'
);

const mismatchedIfRange = await onRequestGet({
  params,
  env,
  request: request({
    Range: 'bytes=0-9',
    'If-Range': '"different-etag"'
  })
});

assert.equal(mismatchedIfRange.status, 200);
assert.equal(
  (await mismatchedIfRange.arrayBuffer()).byteLength,
  1000
);

const notModified = await onRequestGet({
  params,
  env,
  request: request({
    'If-None-Match': '"test-etag"'
  })
});

assert.equal(notModified.status, 304);

const options = await onRequestOptions();

assert.equal(options.status, 204);
assert.equal(
  options.headers.get('access-control-allow-origin'),
  '*'
);

const rangeGetCalls = calls.filter(
  call => call.method === 'get' && call.range
);

assert.ok(rangeGetCalls.length >= 4);

for (const call of rangeGetCalls) {
  assert.deepEqual(
    Object.keys(call.range).sort(),
    ['length', 'offset']
  );
}

console.log(
  'All iPhone/Safari media range tests passed.'
);
