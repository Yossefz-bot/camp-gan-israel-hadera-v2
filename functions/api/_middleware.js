import { json } from './_shared.js';

export async function onRequest(context) {
  try {
    const response = await context.next();
    const headers = new Headers(response.headers);
    headers.set('x-content-type-options', 'nosniff');
    headers.set('referrer-policy', 'strict-origin-when-cross-origin');
    headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    console.error('Unhandled API error', error);
    return json({ error: 'internal_error', message: 'אירעה תקלה זמנית במערכת.' }, 500);
  }
}
