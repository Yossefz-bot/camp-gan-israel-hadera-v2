import { json, parseJson, enforceRateLimit, audit } from '../_shared.js';
import { createSession, passwordMatches, secretsReady, sessionCookie } from './_auth.js';

export async function onRequestPost({ request, env }) {
  if (!secretsReady(env)) {
    return json({ error: 'admin_secrets_missing', message: 'יש להגדיר ADMIN_PASSWORD ו-SESSION_SECRET ב-Cloudflare.' }, 503);
  }
  const limit = await enforceRateLimit({ env, request, action: 'admin-login', limit: 10, windowSeconds: 900 });
  if (!limit.allowed) return json({ error: 'too_many_attempts', message: 'בוצעו יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.' }, 429);
  const body = await parseJson(request);
  if (!(await passwordMatches(body.password, env))) {
    await new Promise(resolve => setTimeout(resolve, 250));
    return json({ error: 'invalid_credentials', message: 'הסיסמה אינה נכונה.' }, 401);
  }
  const session = await createSession(env);
  await audit(env, 'login', 'admin', 'primary');
  return json({ ok: true, csrf: session.payload.csrf, expires_at: session.payload.exp }, 200, {
    'set-cookie': sessionCookie(request, session.token, session.maxAge)
  });
}
