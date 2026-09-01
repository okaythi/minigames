/**
 * Reading a JSON request body without trusting it: size-capped, parse-guarded,
 * and typed only after `shared/` has validated the shape. Used by both routes,
 * so neither one invents its own limits.
 */

export const MAX_BODY_BYTES = 2048

export async function readJsonBody(request: Request): Promise<unknown> {
  const buffer = await request.arrayBuffer()
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_BODY_BYTES) {
    return null
  }
  try {
    return JSON.parse(new TextDecoder().decode(buffer)) as unknown
  } catch {
    return null
  }
}
