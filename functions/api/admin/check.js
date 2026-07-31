import { authorized, denied } from './_auth.js';
export async function onRequestGet({ request, env }) {
  if (!authorized(request, env)) return denied();
  return Response.json({ ok: true });
}
