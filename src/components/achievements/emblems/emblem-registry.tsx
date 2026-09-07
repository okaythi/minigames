import type { ReactNode } from 'react'
import { getPlatformEmblem } from './platform-emblems'
import { getAvoidEmblem } from './avoid-emblems'
import { getPongEmblem } from './pong-emblems'
import { getTronEmblem } from './tron-emblems'
import { getCardJitsuEmblem } from './card-jitsu-emblems'

/**
 * Universal dispatcher that maps icon keys and achievement IDs to their
 * constrained 32×32 vector emblem.
 */
export function renderAchievementEmblem(
  icon: string,
  id: string,
  unlocked: boolean,
): ReactNode {
  if (
    id.startsWith('avoid_') ||
    icon === 'wall-ricochet' ||
    icon === 'airborne-candy' ||
    icon === 'hazard-teeth' ||
    icon === 'slalom-target' ||
    icon === 'chaos-cyclone' ||
    icon === 'red-sweeper' ||
    icon === 'hazard-dynamite' ||
    icon === 'apex-firework' ||
    icon === 'razor-blade' ||
    icon === 'perimeter-spikes' ||
    icon === 'flap-feather'
  ) {
    return getAvoidEmblem(icon, unlocked)
  }

  if (
    id.startsWith('pong_') ||
    icon === 'paddle-volley' ||
    icon === 'pong-bot' ||
    icon === 'secret-boss-eye' ||
    icon === 'solid-defense' ||
    icon === 'shop-cart' ||
    icon === 'power-magnet' ||
    icon === 'power-glass' ||
    icon === 'power-speed'
  ) {
    return getPongEmblem(icon, unlocked)
  }

  if (
    id.startsWith('tron_') ||
    icon === 'lightcycle' ||
    icon === 'turbo-exhaust' ||
    icon === 'closed-box' ||
    icon === 'iron-coil' ||
    icon === 'flawless-sparkle' ||
    icon === 'cornering-arrows' ||
    icon === 'blitz-timer'
  ) {
    return getTronEmblem(icon, unlocked)
  }

  if (
    id.startsWith('cj_') ||
    icon === 'belt-white' ||
    icon === 'belt-black' ||
    icon === 'ninja-mask' ||
    icon === 'triad-fire' ||
    icon === 'triad-water' ||
    icon === 'triad-snow' ||
    icon === 'triad-harmony' ||
    icon === 'combat-lightning' ||
    icon === 'combat-endurance' ||
    icon === 'combat-inversion' ||
    icon === 'combat-strike' ||
    icon === 'card-binder' ||
    icon === 'binder-star' ||
    icon === 'dojo-pagoda' ||
    icon === 'booster-pack'
  ) {
    return getCardJitsuEmblem(icon, unlocked)
  }

  // Default to platform & meta
  return getPlatformEmblem(icon, unlocked)
}
