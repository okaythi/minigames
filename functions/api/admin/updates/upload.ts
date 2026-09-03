import { requireCmsEditor } from './_auth'
import { jsonResponse } from '../../stats/respond'
import type { StatsEnv } from '../../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database; ASSETS_BUCKET: R2Bucket }
}

const MAX_IMAGE_BYTES = 30 * 1024 * 1024 // 30 MB
const MAX_VIDEO_BYTES = 80 * 1024 * 1024 // 80 MB
const MAX_AUDIO_BYTES = 10 * 1024 * 1024 // 10 MB

const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav'])
const VIDEO_EXTENSIONS = new Set(['.mp4'])

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const auth = await requireCmsEditor(request, env)
  if (!auth.ok) {
    return auth.response
  }

  if (!env.ASSETS_BUCKET) {
    return jsonResponse(500, { ok: false, error: 'ASSETS_BUCKET is not bound' })
  }

  let file: File | null = null
  const contentTypeHeader = request.headers.get('content-type') || ''

  if (contentTypeHeader.includes('multipart/form-data')) {
    const formData = await request.formData()
    const entry = formData.get('file')
    if (entry && typeof entry === 'object' && 'arrayBuffer' in entry) {
      file = entry as File
    }
  }

  if (!file) {
    return jsonResponse(400, { ok: false, error: 'Missing file payload (field "file" required)' })
  }

  const rawName = file.name.toLowerCase()
  const ext = rawName.includes('.') ? rawName.slice(rawName.lastIndexOf('.')) : ''
  const mime = (file.type || '').toLowerCase()

  let category: 'image' | 'video' | 'audio'
  let inferredMime = mime

  if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif'].includes(ext)) {
    category = 'image'
    if (file.size > MAX_IMAGE_BYTES) {
      return jsonResponse(400, { ok: false, error: `Image exceeds maximum allowed size of 30MB (received ${(file.size / 1024 / 1024).toFixed(1)}MB)` })
    }
    if (!inferredMime || inferredMime === 'application/octet-stream') {
      inferredMime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.replace('.', '')}`
    }
  } else if (mime === 'video/mp4' || VIDEO_EXTENSIONS.has(ext)) {
    category = 'video'
    if (file.size > MAX_VIDEO_BYTES) {
      return jsonResponse(400, { ok: false, error: `Video exceeds maximum allowed size of 80MB (received ${(file.size / 1024 / 1024).toFixed(1)}MB)` })
    }
    inferredMime = 'video/mp4'
  } else if (
    mime === 'audio/mpeg' ||
    mime === 'audio/mp3' ||
    mime === 'audio/ogg' ||
    mime.includes('wav') ||
    AUDIO_EXTENSIONS.has(ext)
  ) {
    category = 'audio'
    if (file.size > MAX_AUDIO_BYTES) {
      return jsonResponse(400, { ok: false, error: `Audio exceeds maximum allowed size of 10MB (received ${(file.size / 1024 / 1024).toFixed(1)}MB)` })
    }
    inferredMime = ext === '.mp3' ? 'audio/mpeg' : ext === '.ogg' ? 'audio/ogg' : 'audio/wav'
  } else {
    return jsonResponse(400, {
      ok: false,
      error: 'Unsupported file type. Permitted: images (any extension <=30MB), videos (mp4 <=80MB), audio (mp3, ogg, wav <=10MB)',
    })
  }

  const safeBase = file.name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 40)
  const key = `updates/${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safeBase}`

  const buffer = await file.arrayBuffer()
  await env.ASSETS_BUCKET.put(key, buffer, {
    httpMetadata: {
      contentType: inferredMime,
    },
    customMetadata: {
      category,
      originalName: file.name,
      uploadedBy: auth.user.username,
    },
  })

  const url = `/api/assets/updates/${key}`

  return jsonResponse(200, {
    ok: true,
    url,
    key,
    category,
    name: file.name,
    size: file.size,
  })
}
