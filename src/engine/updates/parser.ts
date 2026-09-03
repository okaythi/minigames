import type {
  CreateItemInput,
  CreateReleaseInput,
  ItemId,
  ReleaseId,
  ReleaseStatus,
  TargetScope,
  TargetScopeType,
  UpdateItemInput,
  UpdateReleaseMetaInput,
  UpdateTag,
} from './types'
import { asItemId, asReleaseId } from './types'

/**
 * Functional parsers enforcing "Parse, don't validate".
 * Transforms untrusted, unknown inputs into guaranteed, strongly typed domain values.
 * Zero "any" types used.
 */

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly string[] }

const VALID_TAGS: ReadonlySet<UpdateTag> = new Set<UpdateTag>([
  'Balance',
  'New',
  'Fix',
  'Feature',
  'Polish',
])

const VALID_STATUSES: ReadonlySet<ReleaseStatus> = new Set<ReleaseStatus>([
  'draft',
  'review',
  'published',
  'archived',
])

const VALID_SCOPE_TYPES: ReadonlySet<TargetScopeType> = new Set<TargetScopeType>([
  'game',
  'engine',
  'platform',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function parseReleaseId(raw: unknown): ParseResult<ReleaseId> {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, errors: ['ReleaseId must be a non-empty string'] }
  }
  return { ok: true, value: asReleaseId(raw.trim()) }
}

export function parseItemId(raw: unknown): ParseResult<ItemId> {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, errors: ['ItemId must be a non-empty string'] }
  }
  return { ok: true, value: asItemId(raw.trim()) }
}

export function parseUpdateTag(raw: unknown): ParseResult<UpdateTag> {
  if (typeof raw === 'string' && VALID_TAGS.has(raw as UpdateTag)) {
    return { ok: true, value: raw as UpdateTag }
  }
  return {
    ok: false,
    errors: [`Invalid UpdateTag: "${String(raw)}". Allowed: ${Array.from(VALID_TAGS).join(', ')}`],
  }
}

export function parseReleaseStatus(raw: unknown): ParseResult<ReleaseStatus> {
  if (typeof raw === 'string' && VALID_STATUSES.has(raw as ReleaseStatus)) {
    return { ok: true, value: raw as ReleaseStatus }
  }
  return {
    ok: false,
    errors: [
      `Invalid ReleaseStatus: "${String(raw)}". Allowed: ${Array.from(VALID_STATUSES).join(', ')}`,
    ],
  }
}

export function parseTargetScope(raw: unknown): ParseResult<TargetScope> {
  if (!isRecord(raw)) {
    return { ok: false, errors: ['TargetScope must be an object'] }
  }

  const errors: string[] = []

  if (!isNonEmptyString(raw['type']) || !VALID_SCOPE_TYPES.has(raw['type'] as TargetScopeType)) {
    errors.push(
      `scope.type must be one of: ${Array.from(VALID_SCOPE_TYPES).join(', ')}`,
    )
  }

  if (!isNonEmptyString(raw['targetId'])) {
    errors.push('scope.targetId must be a non-empty string')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const entityName = isNonEmptyString(raw['entityName']) ? raw['entityName'].trim() : undefined

  return {
    ok: true,
    value: {
      type: raw['type'] as TargetScopeType,
      targetId: (raw['targetId'] as string).trim(),
      entityName,
    },
  }
}

export function parseCreateReleaseInput(raw: unknown): ParseResult<CreateReleaseInput> {
  if (!isRecord(raw)) {
    return { ok: false, errors: ['Release input must be an object'] }
  }

  const errors: string[] = []

  if (!isNonEmptyString(raw['globalVersion'])) {
    errors.push('globalVersion must be a non-empty string')
  }

  if (!isNonEmptyString(raw['title'])) {
    errors.push('title must be a non-empty string')
  }

  let headline = ''
  if (!isNonEmptyString(raw['headline'])) {
    errors.push('headline must be a non-empty string')
  } else {
    headline = raw['headline'].trim()
    if (headline.length > 80) {
      errors.push(`headline exceeds maximum 80 characters (got ${headline.length})`)
    }
  }

  if (!isNonEmptyString(raw['releaseDate'])) {
    errors.push('releaseDate must be a non-empty string')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const authorUsername = isNonEmptyString(raw['authorUsername'])
    ? raw['authorUsername'].trim()
    : undefined
  const rationale = isNonEmptyString(raw['rationale']) ? raw['rationale'].trim() : undefined

  return {
    ok: true,
    value: {
      globalVersion: (raw['globalVersion'] as string).trim(),
      title: (raw['title'] as string).trim(),
      headline,
      releaseDate: (raw['releaseDate'] as string).trim(),
      authorUsername,
      rationale,
    },
  }
}

export function parseCreateItemInput(raw: unknown): ParseResult<CreateItemInput> {
  if (!isRecord(raw)) {
    return { ok: false, errors: ['Item input must be an object'] }
  }

  const errors: string[] = []

  const scopeResult = parseTargetScope(raw['scope'])
  if (!scopeResult.ok) {
    errors.push(...scopeResult.errors)
  }

  const tagResult = parseUpdateTag(raw['tag'])
  if (!tagResult.ok) {
    errors.push(...tagResult.errors)
  }

  if (!isNonEmptyString(raw['description'])) {
    errors.push('description must be a non-empty string')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const itemVersion = isNonEmptyString(raw['itemVersion']) ? raw['itemVersion'].trim() : undefined
  const subject = isNonEmptyString(raw['subject']) ? raw['subject'].trim() : undefined
  const sortOrder = typeof raw['sortOrder'] === 'number' && Number.isFinite(raw['sortOrder'])
    ? raw['sortOrder']
    : undefined

  return {
    ok: true,
    value: {
      scope: (scopeResult as { ok: true; value: TargetScope }).value,
      tag: (tagResult as { ok: true; value: UpdateTag }).value,
      description: (raw['description'] as string).trim(),
      itemVersion,
      subject,
      sortOrder,
    },
  }
}

export function parseUpdateReleaseMetaInput(raw: unknown): ParseResult<UpdateReleaseMetaInput> {
  if (!isRecord(raw)) {
    return { ok: false, errors: ['Update input must be an object'] }
  }

  const errors: string[] = []
  const result: {
    globalVersion?: string | undefined
    title?: string | undefined
    headline?: string | undefined
    releaseDate?: string | undefined
    authorUsername?: string | undefined
    status?: ReleaseStatus | undefined
  } = {}

  if ('globalVersion' in raw) {
    if (isNonEmptyString(raw['globalVersion'])) {
      result.globalVersion = raw['globalVersion'].trim()
    } else {
      errors.push('globalVersion must be a non-empty string')
    }
  }

  if ('title' in raw) {
    if (isNonEmptyString(raw['title'])) {
      result.title = raw['title'].trim()
    } else {
      errors.push('title must be a non-empty string')
    }
  }

  if ('headline' in raw) {
    if (isNonEmptyString(raw['headline'])) {
      const h = raw['headline'].trim()
      if (h.length > 80) {
        errors.push(`headline exceeds maximum 80 characters (got ${h.length})`)
      } else {
        result.headline = h
      }
    } else {
      errors.push('headline must be a non-empty string')
    }
  }

  if ('releaseDate' in raw) {
    if (isNonEmptyString(raw['releaseDate'])) {
      result.releaseDate = raw['releaseDate'].trim()
    } else {
      errors.push('releaseDate must be a non-empty string')
    }
  }

  if ('status' in raw) {
    const statusRes = parseReleaseStatus(raw['status'])
    if (statusRes.ok) {
      result.status = statusRes.value
    } else {
      errors.push(...statusRes.errors)
    }
  }

  if ('authorUsername' in raw) {
    result.authorUsername = isNonEmptyString(raw['authorUsername'])
      ? raw['authorUsername'].trim()
      : undefined
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, value: result }
}

export function parseUpdateItemInput(raw: unknown): ParseResult<UpdateItemInput> {
  if (!isRecord(raw)) {
    return { ok: false, errors: ['Item update input must be an object'] }
  }

  const errors: string[] = []
  const result: {
    scope?: TargetScope | undefined
    tag?: UpdateTag | undefined
    itemVersion?: string | undefined
    subject?: string | undefined
    description?: string | undefined
    sortOrder?: number | undefined
  } = {}

  if ('scope' in raw) {
    const scopeRes = parseTargetScope(raw['scope'])
    if (scopeRes.ok) {
      result.scope = scopeRes.value
    } else {
      errors.push(...scopeRes.errors)
    }
  }

  if ('tag' in raw) {
    const tagRes = parseUpdateTag(raw['tag'])
    if (tagRes.ok) {
      result.tag = tagRes.value
    } else {
      errors.push(...tagRes.errors)
    }
  }

  if ('description' in raw) {
    if (isNonEmptyString(raw['description'])) {
      result.description = raw['description'].trim()
    } else {
      errors.push('description must be a non-empty string')
    }
  }

  if ('itemVersion' in raw) {
    result.itemVersion = isNonEmptyString(raw['itemVersion']) ? raw['itemVersion'].trim() : undefined
  }

  if ('subject' in raw) {
    result.subject = isNonEmptyString(raw['subject']) ? raw['subject'].trim() : undefined
  }

  if ('sortOrder' in raw) {
    if (typeof raw['sortOrder'] === 'number' && Number.isFinite(raw['sortOrder'])) {
      result.sortOrder = raw['sortOrder']
    } else {
      errors.push('sortOrder must be a valid finite number')
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, value: result }
}