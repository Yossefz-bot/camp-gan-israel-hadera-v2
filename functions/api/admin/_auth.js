export function authorized(request, env) {
  const token = request.headers.get('x-admin-token') || '';
  return Boolean(env.ADMIN_TOKEN) && token === env.ADMIN_TOKEN;
}
export function denied() { return Response.json({ error: 'unauthorized' }, { status: 401 }); }
