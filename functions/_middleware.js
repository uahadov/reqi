export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // Static assets should be served normally
  if (url.pathname.startsWith('/assets/') || url.pathname.includes('.')) {
    return next();
  }

  // Everything else should fall back to index.html for SPA routing
  const response = await context.env.ASSETS.fetch(new URL('/index.html', request.url));
  return response;
}
