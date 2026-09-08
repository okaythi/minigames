interface Env {
  readonly ASSETS?: { fetch: (request: Request) => Promise<Response> }
}

export const onRequest = async (context: {
  request: Request
  env: Env
}): Promise<Response> => {
  const url = new URL(context.request.url)

  // Prevent direct pages.dev bypass for admin UI by redirecting to the Zero-Trust-protected custom domain
  if (url.hostname.endsWith('.pages.dev')) {
    return Response.redirect(`https://minigames.nixlabs.tech${url.pathname}${url.search}`, 302)
  }

  // On custom domain (after passing Cloudflare Zero Trust), serve SPA index.html
  if (context.env?.ASSETS) {
    const spaRequest = new Request(new URL('/index.html', context.request.url), {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
      },
    })
    return context.env.ASSETS.fetch(spaRequest)
  }

  return new Response('Not found', { status: 404 })
}
