/**
 * Achievement system — wire types shared between browser client and
 * Cloudflare Pages Functions.
 *
 * Kept intentionally flat so it can be imported by both tsconfig.app.json
 * (browser) and tsconfig.functions.json (edge worker) without dragging in
 * any Node-only or browser-only APIs.
 */

/** Stable identifier for every one of the 80 achievements. */
export type AchievementId =
  // Platform – Candy Vault
  | 'candy_sweet_tooth'
  | 'candy_hoarder'
  | 'candy_sugar_maniac'
  | 'candy_confectionery_tycoon'
  // Platform – Arcade Devotion
  | 'runs_first_quarter'
  | 'runs_arcade_regular'
  | 'runs_arcade_veteran'
  | 'runs_living_legend'
  // Platform – Daily Loops & Streaks
  | 'streak_double_play'
  | 'streak_workweek_warrior'
  | 'streak_full_week_punch'
  | 'streak_fortnight_fortitude'
  // Platform – Identity & Customization
  | 'identity_claimed'
  | 'identity_picture_perfect'
  | 'identity_lab_pioneer'
  // Platform – Social & Competition
  | 'social_passport_stamp'
  | 'social_gauntlet_thrown'
  | 'social_top_bracket'
  // Platform – Exploration & Shortcuts
  | 'explore_grand_tour'
  | 'explore_terminal_velocity'
  // Avoid the Spikes! – Wall Bounce Milestones
  | 'avoid_wall_tapper'
  | 'avoid_wall_bouncer'
  | 'avoid_spike_hopper'
  | 'avoid_century_flyer'
  // Avoid the Spikes! – Mid-Flight Candy
  | 'avoid_candy_snack'
  | 'avoid_candy_mid_air'
  | 'avoid_candy_sweet_flight'
  | 'avoid_candy_gem_swarm'
  // Avoid the Spikes! – Floating Hazard Navigation
  | 'avoid_mover_moving_teeth'
  | 'avoid_mover_slalom_pilot'
  | 'avoid_mover_chaos_navigator'
  // Avoid the Spikes! – Precision Grazes
  | 'avoid_graze_razor'
  | 'avoid_graze_danger_dancer'
  | 'avoid_graze_needle_threader'
  // Avoid the Spikes! – Perimeter Extremities
  | 'avoid_edge_ceiling_skimmer'
  | 'avoid_edge_floor_sweeper'
  | 'avoid_edge_oblivion'
  // Avoid the Spikes! – Flap Precision & Dynamics
  | 'avoid_flap_one_tap'
  | 'avoid_flap_quick_turnaround'
  | 'avoid_flap_veteran_grazer'
  // Pong – Rally Volleys
  | 'pong_rally_opener'
  | 'pong_paddle_ace'
  | 'pong_kinetic_maestro'
  | 'pong_infinite_volley'
  // Pong – Difficulty Progression
  | 'pong_novice_shifter'
  | 'pong_calculated_return'
  | 'pong_precision_veteran'
  | 'pong_grandmasters_end'
  // Pong – The Secret Boss
  | 'pong_kinematic_anomaly'
  | 'pong_algorithm_slayer'
  // Pong – Shutouts & Clean Sheets
  | 'pong_solid_defense'
  | 'pong_total_shutout'
  | 'pong_flawless_hard'
  // Pong – Candy Store & Loadout
  | 'pong_loaded_paddle'
  | 'pong_tactical_triad'
  | 'pong_full_arsenal'
  | 'pong_max_loadout'
  // Pong – Tactical Power Plays
  | 'pong_magnetic_trap'
  | 'pong_glass_savior'
  | 'pong_turbo_smash'
  // FL Tron 3.0 – Campaign
  | 'tron_grid_initiate'
  | 'tron_vector_hunter'
  | 'tron_tactical_nemesis'
  | 'tron_master_core_overload'
  // FL Tron 3.0 – Tactical Turbo
  | 'tron_nitro_ignition'
  | 'tron_turbo_cut'
  | 'tron_triple_burner'
  | 'tron_pure_kinetic'
  // FL Tron 3.0 – Box-In (Trapping)
  | 'tron_closed_grid'
  | 'tron_iron_coil'
  | 'tron_claustrophobia'
  // FL Tron 3.0 – Sweeps & Flawless Runs
  | 'tron_dominant_round'
  | 'tron_clean_sweep'
  | 'tron_immortal_cycle'
  // FL Tron 3.0 – Precision Cornering & Buffering
  | 'tron_buffered_90'
  | 'tron_hairpin_double'
  | 'tron_razor_corridor'
  // FL Tron 3.0 – Time Trials & Blitz Clears
  | 'tron_five_second_blitz'
  | 'tron_three_second_flash'
  | 'tron_master_speedrunner'

/** Pillar grouping for display purposes. */
export type AchievementPillar = 'platform' | 'avoid-the-spikes' | 'pong' | 'fl-tron-3'

/** Static definition of an achievement — never changes at runtime. */
export interface AchievementDef {
  readonly id: AchievementId
  readonly pillar: AchievementPillar
  readonly track: string
  readonly name: string
  readonly description: string
  readonly icon: string
  /** Maximum progress value; `null` means binary (done / not done). */
  readonly maxProgress: number | null
}

/** A single player's state for one achievement. */
export interface PlayerAchievementState {
  readonly id: AchievementId
  /** Unix timestamp (seconds) when the achievement was unlocked. `null` = locked. */
  readonly unlockedAt: number | null
  /** Current progress toward `maxProgress`. Irrelevant when `maxProgress` is null. */
  readonly progress: number
}

/** Full achievement status returned from the API. */
export interface AchievementStatus extends AchievementDef {
  readonly unlockedAt: number | null
  readonly progress: number
}

/** POST body sent to the achievements unlock endpoint. */
export interface AchievementUnlockPayload {
  readonly id: AchievementId
  /** Current progress value to upsert alongside the unlock. */
  readonly progress?: number
}

/** Response from the achievements GET endpoint. */
export interface AchievementsResponse {
  readonly ok: true
  readonly achievements: readonly PlayerAchievementState[]
}
