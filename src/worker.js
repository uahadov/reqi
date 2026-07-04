export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Serve static assets normally
    if (url.pathname.startsWith('/assets/') || url.pathname.includes('.')) {
      return env.ASSETS.fetch(request);
    }

    // For all other routes, serve index.html (SPA fallback)
    return env.ASSETS.fetch(new URL('/index.html', request.url));
  },
};
