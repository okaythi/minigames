interface PagesContext {
  readonly env: { ASSETS_BUCKET: R2Bucket }
  readonly params: { key: string }
}

export const onRequestGet = async ({ env, params }: PagesContext): Promise<Response> => {
  const object = await env.ASSETS_BUCKET.get(params.key)

  if (object === null) {
    return new Response('Not found', { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('cache-control', 'public, max-age=31536000, immutable')

  return new Response(object.body, { headers })
}
