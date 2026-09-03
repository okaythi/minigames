interface Env {
  readonly ASSETS?: { fetch: (request: Request) => Promise<Response> }
}

export const onRequest = async (context: {
  request: Request
  env: Env
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>
}): Promise<Response> => {
  const userAgent = context.request.headers.get('user-agent') || ''
  const isBot =
    /discordbot|twitterbot|facebookexternalhit|telegrambot|slackbot|linkedinbot|whatsapp|skypeuripreview|embedly|quora link preview|outbrain|pinterest|vkshare|w3c_validator/i.test(
      userAgent,
    )

  if (isBot) {
    return new Response(
      '<!doctype html><html><head><meta name="robots" content="noindex, nofollow, nosnippet, noimageindex" /></head><body></body></html>',
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow, nosnippet, noimageindex, noarchive',
        },
      },
    )
  }

  const response = await context.next()

  // For SPA client-side routes (like /updates, /about, /games/:slug, etc.):
  // If the asset layer returns 404 on a GET/HEAD navigation request that is not
  // an API route and not a static file with an extension, fall back to serving
  // index.html so direct URL access and page reloads work seamlessly.
  if (
    response.status === 404 &&
    (context.request.method === 'GET' || context.request.method === 'HEAD')
  ) {
    const url = new URL(context.request.url)
    const isApi = url.pathname.startsWith('/api/')
    const lastSegment = url.pathname.slice(url.pathname.lastIndexOf('/') + 1)
    const hasExtension = lastSegment.includes('.')

    if (!isApi && !hasExtension) {
      let assetResponse: Response | null = null
      const indexRequest = new Request(new URL('/', context.request.url), context.request)

      if (context.env?.ASSETS) {
        assetResponse = await context.env.ASSETS.fetch(indexRequest)
        if (assetResponse.status === 404) {
          assetResponse = await context.env.ASSETS.fetch(
            new Request(new URL('/index.html', context.request.url), context.request),
          )
        }
      } else {
        assetResponse = await context.next(indexRequest)
      }

      if (assetResponse && assetResponse.status < 400) {
        const clone = new Response(assetResponse.body, assetResponse)
        clone.headers.set('X-Robots-Tag', 'noindex, nofollow, nosnippet, noimageindex, noarchive')
        return clone
      }
    }
  }

  const clone = new Response(response.body, response)
  clone.headers.set('X-Robots-Tag', 'noindex, nofollow, nosnippet, noimageindex, noarchive')
  return clone
}
