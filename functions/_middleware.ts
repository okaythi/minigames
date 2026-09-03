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

      if (context.env?.ASSETS) {
        const cleanRequest = new Request(new URL('/index.html', context.request.url), {
          method: 'GET',
          headers: {
            'Accept': 'text/html',
          },
        })
        assetResponse = await context.env.ASSETS.fetch(cleanRequest)
        if (assetResponse.status >= 400) {
          assetResponse = await context.env.ASSETS.fetch(
            new Request(new URL('/', context.request.url), {
              method: 'GET',
              headers: {
                'Accept': 'text/html',
              },
            }),
          )
        }
      } else {
        assetResponse = await context.next(new Request(new URL('/', context.request.url)))
      }

      if (assetResponse && assetResponse.status < 400 && assetResponse.body) {
        const clone = new Response(assetResponse.body, {
          status: 200,
          headers: assetResponse.headers,
        })
        clone.headers.set('Content-Type', 'text/html; charset=utf-8')
        clone.headers.set('Cache-Control', 'no-cache, must-revalidate')
        clone.headers.set('X-Robots-Tag', 'noindex, nofollow, nosnippet, noimageindex, noarchive')
        return clone
      }
    }
  }

  const clone = new Response(response.body, response)
  clone.headers.set('X-Robots-Tag', 'noindex, nofollow, nosnippet, noimageindex, noarchive')
  return clone
}
