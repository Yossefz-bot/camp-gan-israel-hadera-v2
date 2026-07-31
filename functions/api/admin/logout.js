import { json } from '../_shared.js';
import { clearSessionCookie } from './_auth.js';

export async function onRequestPost({ request }) {
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(request) });
}
