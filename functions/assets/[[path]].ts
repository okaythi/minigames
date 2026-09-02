interface Env {
  readonly ASSETS_BUCKET?: R2Bucket
  readonly ASSETS?: { fetch: (request: Request) => Promise<Response> }
}

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
}

function getContentType(path: string): string {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase()
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

export const onRequestGet = async (context: {
  request: Request
  env: Env
  params: { path?: string | string[] }
  next: () => Promise<Response>
}): Promise<Response> => {
  const { request, env, params, next } = context
  const rawPath = Array.isArray(params.path)
    ? params.path.join('/')
    : (params.path ?? '')

  if (!env.ASSETS_BUCKET) {
    return next()
  }

  const candidateKeys = [
    `assets/${rawPath}`,
    rawPath,
    `assets/${rawPath.replace(/^assets\//, '')}`,
  ]

  let object: R2ObjectBody | null = null

  for (const key of candidateKeys) {
    if (!key || key.endsWith('/')) continue
    const found = await env.ASSETS_BUCKET.get(key)
    if (found !== null) {
      object = found
      break
    }
  }

  if (!object) {
    return next()
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Content-Disposition', 'inline')

  if (!headers.get('Content-Type') || headers.get('Content-Type') === 'application/octet-stream') {
    headers.set('Content-Type', getContentType(rawPath))
  }

  if (request.headers.get('if-none-match') === object.httpEtag) {
    return new Response(null, { status: 304, headers })
  }

  return new Response(object.body, {
    status: 200,
    headers,
  })
}
