import { json } from '../_shared.js';
import { secretsReady, verifySession } from './_auth.js';

export async function onRequestGet({ request, env }) {
  const session = await verifySession(request, env);
  return json({
    authenticated: Boolean(session),
    secrets_ready: secretsReady(env),
    csrf: session?.csrf || '',
    expires_at: session?.exp || 0
  }, session ? 200 : 401);
}
