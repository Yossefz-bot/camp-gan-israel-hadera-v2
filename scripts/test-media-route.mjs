import assert from 'node:assert/strict';
import { onRequestGet, onRequestHead } from '../functions/api/media/[[path]].js';

const bytes = new Uint8Array(1000).map((_, index) => index % 256);
function objectFor(start = 0, length = bytes.length, ranged = false) {
  const bodyBytes = bytes.slice(start, start + length);
  return {
    size: bytes.length,
    httpEtag: '"test-etag"',
    uploaded: new Date('2026-08-03T00:00:00Z'),
    customMetadata: { originalName: 'test.mp4' },
    writeHttpMetadata(headers) { headers.set('content-type', 'video/mp4'); },
    ...(ranged ? { range: { offset: start, length } } : {}),
    body: new Blob([bodyBytes]).stream()
  };
}
const env = {
  MEDIA: {
    async head(key) { return key === 'videos/test.mp4' ? objectFor() : null; },
    async get(key, options) {
      if (key !== 'videos/test.mp4') return null;
      const range = options?.range?.get?.('range');
      if (!range) return objectFor();
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) throw new Error('invalid range');
      let start, end;
      if (!match[1]) {
        const suffix = Number(match[2]); start = Math.max(0, bytes.length - suffix); end = bytes.length - 1;
      } else {
        start = Number(match[1]); end = match[2] ? Math.min(bytes.length - 1, Number(match[2])) : bytes.length - 1;
      }
      if (start > end || start >= bytes.length) throw new Error('invalid range');
      return objectFor(start, end - start + 1, true);
    }
  }
};
const params = { path: ['videos', 'test.mp4'] };

const full = await onRequestGet({ params, env, request: new Request('https://example.com/api/media/videos/test.mp4') });
assert.equal(full.status, 200);
assert.equal(full.headers.get('content-type'), 'video/mp4');
assert.equal(full.headers.get('accept-ranges'), 'bytes');
assert.equal(full.headers.get('content-length'), '1000');
assert.match(full.headers.get('cache-control'), /no-transform/);

const partial = await onRequestGet({ params, env, request: new Request('https://example.com/api/media/videos/test.mp4', { headers: { Range: 'bytes=0-99' } }) });
assert.equal(partial.status, 206);
assert.equal(partial.headers.get('content-range'), 'bytes 0-99/1000');
assert.equal(partial.headers.get('content-length'), '100');
assert.equal((await partial.arrayBuffer()).byteLength, 100);

const suffix = await onRequestGet({ params, env, request: new Request('https://example.com/api/media/videos/test.mp4', { headers: { Range: 'bytes=-50' } }) });
assert.equal(suffix.status, 206);
assert.equal(suffix.headers.get('content-range'), 'bytes 950-999/1000');

const head = await onRequestHead({ params, env, request: new Request('https://example.com/api/media/videos/test.mp4', { method: 'HEAD' }) });
assert.equal(head.status, 200);
assert.equal(head.headers.get('content-length'), '1000');
assert.equal((await head.arrayBuffer()).byteLength, 0);

const invalid = await onRequestGet({ params, env, request: new Request('https://example.com/api/media/videos/test.mp4', { headers: { Range: 'bytes=2000-3000' } }) });
assert.equal(invalid.status, 416);
assert.equal(invalid.headers.get('content-range'), 'bytes */1000');

console.log('Media route GET, HEAD and byte-range tests passed.');
