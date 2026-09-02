export const onRequest = async (context: {
  request: Request
  next: () => Promise<Response>
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
  const clone = new Response(response.body, response)
  clone.headers.set('X-Robots-Tag', 'noindex, nofollow, nosnippet, noimageindex, noarchive')
  return clone
}
