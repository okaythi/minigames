import {
  parseCreateItemInput,
  parseCreateReleaseInput,
  parseUpdateTag,
  parseReleaseStatus,
} from '../src/engine/updates/parser'
import { defaultProjections } from '../src/engine/updates/projections'
import { InterfaceRegistry } from '../src/engine/updates/registry'
import { asItemId, asReleaseId } from '../src/engine/updates/types'
import type { ReleaseItem, ReleaseMeta } from '../src/engine/updates/types'
import { UpdateNotesEngine } from '../src/engine/updates/engine'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${message}`)
}

console.log('--- Starting Update Notes Engine Invariant Tests ---')

// 1. "Parse, don't validate" Parser Invariants
console.log('\n[1. Parser Invariants]')

// 1a. UpdateTag parsing
const validTag = parseUpdateTag('Balance')
assert(validTag.ok === true && validTag.value === 'Balance', 'parses valid UpdateTag "Balance"')

const invalidTag = parseUpdateTag('audio')
assert(invalidTag.ok === false, 'rejects invalid UpdateTag "audio"')

// 1b. ReleaseStatus parsing
const validStatus = parseReleaseStatus('draft')
assert(validStatus.ok === true && validStatus.value === 'draft', 'parses valid ReleaseStatus "draft"')

const invalidStatus = parseReleaseStatus('pending_review_xyz')
assert(invalidStatus.ok === false, 'rejects invalid ReleaseStatus')

// 1c. Release Input Parsing & Headline constraint
const validReleaseInput = parseCreateReleaseInput({
  globalVersion: '1.0.0',
  title: 'Next Gen Release',
  headline: 'Compact headline under eighty characters',
  releaseDate: 'September 2026',
})
assert(validReleaseInput.ok === true, 'parses valid CreateReleaseInput')

const oversizedHeadlineInput = parseCreateReleaseInput({
  globalVersion: '1.0.0',
  title: 'Next Gen Release',
  headline: 'This headline is way too long because it exceeds eighty characters by a huge margin and should fail',
  releaseDate: 'September 2026',
})
assert(oversizedHeadlineInput.ok === false, 'rejects headline exceeding 80 characters')

// 1d. Item Input with Item-Level Versioning
const validItemInput = parseCreateItemInput({
  scope: {
    type: 'game',
    targetId: 'avoid-the-spikes',
    entityName: 'Red Movers',
  },
  tag: 'Balance',
  itemVersion: '1.2.0',
  subject: 'Disintegration',
  description: 'Movers dissolve upon candy collection.',
  sortOrder: 1,
})
assert(validItemInput.ok === true, 'parses valid item with granular itemVersion')
if (validItemInput.ok) {
  assert(validItemInput.value.itemVersion === '1.2.0', 'preserves itemVersion "1.2.0"')
}

// 2. Extensible InterfaceRegistry Invariants
console.log('\n[2. InterfaceRegistry Extensibility]')
const registry = new InterfaceRegistry()

interface MockAnalyticsHose {
  readonly trackPageView: (page: string) => void
}

const mockAnalytics: MockAnalyticsHose = {
  trackPageView: (page) => console.log(`[Analytics] Tracked ${page}`),
}

registry.register('analytics', mockAnalytics)
assert(registry.has('analytics') === true, 'registered custom "analytics" interface')
assert(registry.get<MockAnalyticsHose>('analytics') === mockAnalytics, 'retrieved custom interface with strict typing')

// 3. Dual Projection Invariants (Game Pillars vs Tag Groups)
console.log('\n[3. Dual Projection Invariants]')
const releaseId = asReleaseId('rel_test_1')

const mockItems: readonly ReleaseItem[] = [
  {
    id: asItemId('item_1'),
    releaseId,
    scope: { type: 'game', targetId: 'avoid-the-spikes' },
    tag: 'Balance',
    itemVersion: '1.2.0',
    subject: 'Spike Speed',
    description: 'Adjusted speed multiplier',
    sortOrder: 1,
    createdAt: 1000,
    updatedAt: 1000,
  },
  {
    id: asItemId('item_2'),
    releaseId,
    scope: { type: 'game', targetId: 'pong' },
    tag: 'Balance',
    itemVersion: '1.0.5',
    subject: 'Paddle Friction',
    description: 'Smoothed friction curve',
    sortOrder: 2,
    createdAt: 1000,
    updatedAt: 1000,
  },
  {
    id: asItemId('item_3'),
    releaseId,
    scope: { type: 'game', targetId: 'fl-tron-3' },
    tag: 'Fix',
    subject: 'Zero-Trap',
    description: 'Eliminated death loops',
    sortOrder: 3,
    createdAt: 1000,
    updatedAt: 1000,
  },
]

// Projection A: Game Pillars
const gamePillars = defaultProjections.toGamePillars(mockItems)
assert(gamePillars.length === 3, 'projected into 3 distinct game pillars')
assert(gamePillars.some((p) => p.gameSlug === 'avoid-the-spikes' && p.gameTitle === 'Avoid the Spikes!'), 'resolved Avoid title')
assert(gamePillars.some((p) => p.gameSlug === 'fl-tron-3' && p.gameTitle === 'FL Tron 3.0'), 'resolved FL Tron title')

// Projection B: Tag Groups
const tagGroups = defaultProjections.toTagGroups(mockItems)
assert(tagGroups.length === 2, 'projected into 2 tag groups (Balance & Fix)')
const balanceGroup = tagGroups.find((tg) => tg.tag === 'Balance')
assert(balanceGroup !== undefined && balanceGroup.items.length === 2, 'Balance group contains exactly 2 cross-game items')

// 4. Core Engine Ingestion & Reader Invariants
console.log('\n[4. Engine Ingestion & Composite Reader Invariants]')
const engine = new UpdateNotesEngine()

async function testEngine() {
  const published = await engine.reader.getPublished()
  assert(published.length > 0, 'engine retrieves baseline seed releases')

  const latest = await engine.reader.getLatestPublished()
  assert(latest !== null, 'engine retrieves latest published release')
  assert(latest?.meta.globalVersion === '0.2.0', 'latest release matches version 0.2.0')

  // 5. Writer Interface CMS Operations
  console.log('\n[5. WriterInterface CMS Flow]')
  let notified = false
  const unsubscribe = engine.subscriber.subscribe(() => {
    notified = true
  })

  // Create a draft
  const draftId = await engine.writer.createDraft({
    globalVersion: '0.3.0',
    title: 'Upcoming Winter Expansion',
    headline: 'New procedural game modes and custom pass themes',
    releaseDate: 'November 2026',
    rationale: 'We are expanding the arcade into competitive seasons.',
  })
  assert(typeof draftId === 'string' && draftId.startsWith('rel_'), 'writer created new draft with unique ID')

  // Add an item to the draft
  const newItemId = await engine.writer.addItem(draftId, {
    scope: { type: 'game', targetId: 'pong' },
    tag: 'New',
    itemVersion: '2.0.0',
    subject: 'Quad Mode',
    description: 'Added 4-player split arcade mode.',
  })
  assert(typeof newItemId === 'string' && newItemId.startsWith('item_'), 'writer added item with itemVersion')

  // Verify draft queries
  const drafts = await engine.reader.getDrafts()
  assert(drafts.some((d) => d.meta.id === draftId), 'reader queries active drafts')

  const draftRelease = await engine.reader.getReleaseById(draftId)
  assert(draftRelease?.items.length === 1, 'draft release reflects newly added item')
  assert(draftRelease?.pillars[0]?.items[0]?.itemVersion === '2.0.0', 'draft item retains itemVersion 2.0.0')

  // Publish draft
  await engine.writer.publish(draftId)
  const publishedAfter = await engine.reader.getPublished()
  assert(publishedAfter.some((p) => p.meta.id === draftId), 'published draft appears in published feed')
  assert(notified === true, 'subscriber received reactive event notification on publish')

  // Clean up
  await engine.writer.archive(draftId)
  unsubscribe()

  console.log('\n✨ ALL UPDATE NOTES ENGINE INVARIANT TESTS PASSED!')
}

void testEngine()
