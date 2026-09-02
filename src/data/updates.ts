export type UpdateTag = 'Balance' | 'New' | 'Fix' | 'Feature' | 'Polish'

export interface UpdateChangeItem {
  readonly tag: UpdateTag
  readonly subject?: string
  readonly description: string
}

export interface UpdateGamePillar {
  readonly gameSlug: string
  readonly gameTitle: string
  readonly changes: readonly UpdateChangeItem[]
}

export interface UpdateRelease {
  readonly version: string
  readonly title: string
  readonly date: string
  readonly headline: string
  readonly developerRationale?: string
  readonly pillars: readonly UpdateGamePillar[]
}

export const UPDATE_RELEASES: readonly UpdateRelease[] = [
  {
    version: '0.2.0',
    title: 'Hazard Dissolve Mechanics, Minimax Engine & Staff Verification',
    date: 'September 2, 2026',
    headline: 'Hazard dissolve mechanics, AI depth-12 minimax, and Staff badges',
    developerRationale:
      'We wanted to make collecting candy in Avoid the Spikes feel genuinely offensive rather than purely evasive. When candy is grabbed, nearby red movers disintegrate with procedural burst particles, creating tactical breathing room. Meanwhile in FL Tron, our depth-12 minimax engine ensures Master-tier bots play ruthlessly without falling into suicidal spiral traps.',
    pillars: [
      {
        gameSlug: 'avoid-the-spikes',
        gameTitle: 'Avoid the Spikes!',
        changes: [
          {
            tag: 'Balance',
            subject: 'Red Movers',
            description: 'Red moving teeth now dissolve upon candy pickup, granting brief sanctuary and resetting nearby attractor spawn rates.',
          },
          {
            tag: 'New',
            subject: 'Demolition Badges',
            description: 'Added 3 new achievements for dissolving 10, 50, and 80 moving hazards in total.',
          },
          {
            tag: 'Polish',
            subject: 'Particle FX',
            description: 'Procedural radial burst particles emit when teeth shatter upon candy collection.',
          },
        ],
      },
      {
        gameSlug: 'fl-tron-3',
        gameTitle: 'FL Tron 3.0',
        changes: [
          {
            tag: 'Balance',
            subject: 'Personality Engine',
            description: 'Replaced primitive greedy pathfinding with a depth-12 iterative deepening minimax solver backed by Voronoi territory heuristics.',
          },
          {
            tag: 'Fix',
            subject: 'Zero-Trap Veto',
            description: 'Eliminated accidental self-encirclement and death spirals on difficulty 6.',
          },
          {
            tag: 'Balance',
            subject: 'Turbo Boost EV',
            description: 'Tuned turbo burst recharge rate and increased slipstream drafting reward.',
          },
        ],
      },
      {
        gameSlug: 'pong',
        gameTitle: 'Pong',
        changes: [
          {
            tag: 'Fix',
            subject: 'Audio Synthesis',
            description: 'Corrected swapped frequency envelopes between boundary wall bounces and paddle hits.',
          },
          {
            tag: 'Polish',
            subject: 'Paddle Feel',
            description: 'Smoothed tactile pointer tracking interpolation on high-DPI displays.',
          },
        ],
      },
      {
        gameSlug: 'platform',
        gameTitle: 'Arcade Platform',
        changes: [
          {
            tag: 'New',
            subject: 'Staff Verification',
            description: 'Verified Lab Developers now display the official Discord Staff emblem in Nixlabs orange across their passport and achievements.',
          },
          {
            tag: 'Feature',
            subject: 'Migration Countdown',
            description: 'Added live countdown warnings for anonymous progress migration with reactive dismissals.',
          },
          {
            tag: 'New',
            subject: 'Patch Notes Hub',
            description: 'Introduced dedicated update notes page with game-by-game changelogs and balance rationale.',
          },
        ],
      },
    ],
  },
  {
    version: '0.1.5',
    title: 'Player Passports & Achievement Network',
    date: 'August 24, 2026',
    headline: 'Player Passports, 80 arcade achievements, and candy banking',
    developerRationale:
      'The initial arcade foundation focused entirely on isolated canvas games. With version 0.1.5, we unified every player identity under a Player Passport backed by Cloudflare D1 and R2 for zero-loss progression.',
    pillars: [
      {
        gameSlug: 'platform',
        gameTitle: 'Arcade Platform',
        changes: [
          {
            tag: 'Feature',
            subject: 'Player Passport',
            description: 'Public profile pages with custom avatar uploads to R2, unique badges, and play history.',
          },
          {
            tag: 'Feature',
            subject: 'Achievements Catalogue',
            description: '80 platform achievements across 4 tracks with real-time celebration toasts.',
          },
          {
            tag: 'New',
            subject: 'Candy Vault',
            description: 'Unified bonus candy economy synced automatically across devices.',
          },
        ],
      },
      {
        gameSlug: 'pong',
        gameTitle: 'Pong',
        changes: [
          {
            tag: 'New',
            subject: 'Tactical Triad',
            description: 'Introduced Shield, Speed, and Shrink tactical power-ups.',
          },
          {
            tag: 'Balance',
            subject: 'Difficulty Curve',
            description: 'Calibrated AI reaction delays across Easy, Normal, and Hard campaigns.',
          },
        ],
      },
      {
        gameSlug: 'avoid-the-spikes',
        gameTitle: 'Avoid the Spikes!',
        changes: [
          {
            tag: 'Polish',
            subject: 'Near-Miss Graze',
            description: 'Added close-call graze detection with bonus candy multipliers and audio thrum.',
          },
        ],
      },
    ],
  },
]

export const LATEST_UPDATE = UPDATE_RELEASES[0]!
