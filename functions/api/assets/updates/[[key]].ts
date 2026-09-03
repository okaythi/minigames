interface PagesContext {
  readonly request: Request
  readonly env: { ASSETS_BUCKET: R2Bucket }
  readonly params: { key?: string | string[] }
}

export const onRequestGet = async ({ request, env, params }: PagesContext): Promise<Response> => {
  if (!env.ASSETS_BUCKET) {
    return new Response('Bucket not configured', { status: 500 })
  }

  const rawKey = Array.isArray(params.key) ? params.key.join('/') : (params.key ?? '')
  if (!rawKey) {
    return new Response('Not found', { status: 404 })
  }

  // Ensure key format matches storage
  const candidateKeys = rawKey.startsWith('updates/') ? [rawKey] : [`updates/${rawKey}`, rawKey]

  let object: R2ObjectBody | null = null
  const rangeHeader = request.headers.get('range')

  for (const key of candidateKeys) {
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1]!, 10)
        const end = match[2] ? parseInt(match[2], 10) : undefined
        const rangeOpt = end !== undefined
          ? { offset: start, length: end - start + 1 }
          : { offset: start }
        object = await env.ASSETS_BUCKET.get(key, { range: rangeOpt })

        if (object) break
      }
    }

    object = await env.ASSETS_BUCKET.get(key)
    if (object) break
  }

  if (!object) {
    return new Response('Not found', { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('accept-ranges', 'bytes')
  headers.set('cache-control', 'public, max-age=31536000, immutable')

  const status = rangeHeader && 'range' in object ? 206 : 200

  return new Response(object.body, { status, headers })
}
