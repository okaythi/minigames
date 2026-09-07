import { AchievementChassis, type ChassisTier } from './chassis'
import { renderAchievementEmblem } from './emblems/emblem-registry'

export interface AchievementIconProps {
  readonly id: string
  readonly icon: string
  readonly unlocked?: boolean
  readonly size?: number
  readonly className?: string
  readonly tier?: ChassisTier
}

/**
 * Derives a deterministic chassis tier from achievement metadata.
 */
function resolveTier(id: string, icon: string, explicitTier?: ChassisTier): ChassisTier {
  if (explicitTier) return explicitTier

  // Dojo tier for Card-Jitsu
  if (
    id.startsWith('cj_') ||
    icon.startsWith('belt-') ||
    icon.startsWith('triad-') ||
    icon.startsWith('dojo-') ||
    icon.startsWith('card-') ||
    icon === 'ninja-mask'
  ) {
    if (id === 'cj_ninja_master' || id === 'cj_binder_complete' || id === 'cj_plays_legend') {
      return 'gold'
    }
    return 'dojo'
  }

  // Cyber tier for FL Tron 3.0
  if (
    id.startsWith('tron_') ||
    icon === 'lightcycle' ||
    icon === 'turbo-exhaust' ||
    icon === 'closed-box' ||
    icon === 'iron-coil' ||
    icon === 'cornering-arrows' ||
    icon === 'blitz-timer'
  ) {
    if (id === 'tron_master_core_overload' || id === 'tron_immortal_cycle' || id === 'tron_master_speedrunner') {
      return 'gold'
    }
    return 'cyber'
  }

  // Hazard tier for Avoid the Spikes hazards and grazes
  if (
    id.includes('mover') ||
    id.includes('destroy') ||
    id.includes('graze') ||
    id.includes('edge') ||
    icon.includes('hazard') ||
    icon.includes('teeth') ||
    icon.includes('razor')
  ) {
    return 'hazard'
  }

  // Legendary Gold Tier Milestones
  if (
    id === 'candy_confectionery_tycoon' ||
    id === 'runs_living_legend' ||
    id === 'streak_fortnight_fortitude' ||
    id === 'social_top_bracket' ||
    id === 'explore_grand_tour' ||
    id === 'avoid_century_flyer' ||
    id === 'avoid_candy_gem_swarm' ||
    id === 'avoid_destroy_movers_80' ||
    id === 'avoid_flap_veteran_grazer' ||
    id === 'pong_infinite_volley' ||
    id === 'pong_grandmasters_end' ||
    id === 'pong_algorithm_slayer' ||
    id === 'pong_flawless_hard' ||
    id === 'pong_max_loadout' ||
    id === 'identity_lab_pioneer' ||
    id === 'identity_developer'
  ) {
    return 'gold'
  }

  // Silver Tier Milestones
  if (
    id === 'candy_sugar_maniac' ||
    id === 'runs_arcade_veteran' ||
    id === 'streak_full_week_punch' ||
    id === 'avoid_spike_hopper' ||
    id === 'avoid_candy_sweet_flight' ||
    id === 'avoid_destroy_movers_50' ||
    id === 'pong_kinetic_maestro' ||
    id === 'pong_precision_veteran' ||
    id === 'pong_total_shutout' ||
    id === 'pong_full_arsenal' ||
    id === 'cj_belt_black' ||
    id === 'cj_binder_archivist' ||
    id === 'cj_plays_champion'
  ) {
    return 'silver'
  }

  // Bronze Tier Classic
  return 'bronze'
}

/**
 * Nixlabs 64×64 SVG Achievement Badge.
 *
 * Combines the deterministic tiered chassis with semantic layers and
 * a constrained thematic vector emblem.
 */
export function AchievementIcon({
  id,
  icon,
  unlocked = true,
  size = 48,
  className = '',
  tier,
}: AchievementIconProps) {
  const resolvedTier = resolveTier(id, icon, tier)

  return (
    <AchievementChassis
      tier={resolvedTier}
      unlocked={unlocked}
      size={size}
      className={className}
      id={id}
    >
      {renderAchievementEmblem(icon, id, unlocked)}
    </AchievementChassis>
  )
}
