import type { ReactNode } from 'react'

/**
 * Avoid the Spikes! vector emblems (centered in [16, 16, 48, 48]).
 */
export function getAvoidEmblem(icon: string, unlocked: boolean): ReactNode {
  const fillPrimary = unlocked ? '#f6821f' : '#71717a'
  const strokeColor = unlocked ? '#fff' : '#a1a1aa'
  const dangerColor = unlocked ? '#ef4444' : '#52525b'
  const accentGlow = unlocked ? '#fde047' : '#3f3f46'

  switch (icon) {
    case 'wall-ricochet':
      return (
        <g id="emblem-wall-ricochet">
          {/* Wall on the left */}
          <rect x="18" y="18" width="4" height="28" rx="1" fill="#404041" stroke={strokeColor} strokeWidth="1" />
          {/* Wall spike */}
          <polygon points="22,32 29,28 29,36" fill={dangerColor} stroke={strokeColor} strokeWidth="1" />
          {/* Bouncing Bird/Ball */}
          <circle cx="38" cy="24" r="5" fill={fillPrimary} stroke={strokeColor} strokeWidth="1.2" />
          {/* Ricochet bounce path */}
          <path d="M 44,40 L 26,32 L 38,24" fill="none" stroke={accentGlow} strokeWidth="1.8" strokeDasharray="3 2" strokeLinecap="round" />
          {/* Impact star */}
          <polygon points="26,32 28,30 29,32 28,34" fill="#fff" />
        </g>
      )

    case 'airborne-candy':
      return (
        <g id="emblem-airborne-candy">
          {/* Motion trail lines */}
          <path d="M 18,36 Q 24,36 27,33" fill="none" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M 20,41 Q 26,41 29,38" fill="none" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
          {/* Flying Gem Candy */}
          <polygon points="35,19 45,29 35,43 25,29" fill={fillPrimary} stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
          <polygon points="35,19 40,29 35,43 30,29" fill={accentGlow} stroke={strokeColor} strokeWidth="1" />
          <circle cx="35" cy="23" r="1.5" fill="#fff" />
        </g>
      )

    case 'hazard-teeth':
      return (
        <g id="emblem-hazard-teeth">
          {/* Moving center spike hazard */}
          <polygon points="32,18 45,42 19,42" fill={dangerColor} stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
          {/* Inner core eye/hazard symbol */}
          <circle cx="32" cy="33" r="4.5" fill="#18181b" stroke={accentGlow} strokeWidth="1.2" />
          <circle cx="32" cy="33" r="2" fill="#fff" />
          {/* Danger motion chevron */}
          <path d="M 32,14 L 35,11 M 32,14 L 29,11" stroke={accentGlow} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )

    case 'slalom-target':
      return (
        <g id="emblem-slalom-target">
          {/* Concentric target rings */}
          <circle cx="32" cy="32" r="13" fill="none" stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="32" cy="32" r="8" fill="none" stroke={dangerColor} strokeWidth="1.5" />
          <circle cx="32" cy="32" r="3" fill={accentGlow} />
          {/* Crosshairs */}
          <line x1="32" y1="16" x2="32" y2="21" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="32" y1="43" x2="32" y2="48" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16" y1="32" x2="21" y2="32" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="43" y1="32" x2="48" y2="32" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )

    case 'chaos-cyclone':
      return (
        <g id="emblem-chaos-cyclone">
          {/* Swirling storm cyclone arms */}
          <path d="M 32,18 A 14 14 0 0 1 46 32 A 10 10 0 0 1 36 42 A 6 6 0 0 1 32 32" fill="none" stroke={fillPrimary} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 32,46 A 14 14 0 0 1 18 32 A 10 10 0 0 1 28 22 A 6 6 0 0 1 32 32" fill="none" stroke={dangerColor} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="32" cy="32" r="2.5" fill={accentGlow} />
        </g>
      )

    case 'red-sweeper':
      return (
        <g id="emblem-red-sweeper">
          {/* Shattered Spike Exploding */}
          <polygon points="32,22 36,29 29,27" fill={dangerColor} stroke={strokeColor} strokeWidth="1" />
          <polygon points="24,35 29,42 22,40" fill={dangerColor} stroke={strokeColor} strokeWidth="1" />
          <polygon points="41,35 44,42 36,39" fill={dangerColor} stroke={strokeColor} strokeWidth="1" />
          {/* Central impact burst */}
          <circle cx="32" cy="33" r="3.5" fill={accentGlow} />
          {/* Spark rays */}
          <line x1="32" y1="26" x2="32" y2="20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="26" y1="33" x2="19" y2="33" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="38" y1="33" x2="45" y2="33" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )

    case 'hazard-dynamite':
      return (
        <g id="emblem-hazard-dynamite">
          {/* TNT sticks bundle */}
          <rect x="23" y="24" width="7" height="19" rx="1" fill={dangerColor} stroke={strokeColor} strokeWidth="1.2" />
          <rect x="34" y="24" width="7" height="19" rx="1" fill={dangerColor} stroke={strokeColor} strokeWidth="1.2" />
          <rect x="28.5" y="22" width="7" height="21" rx="1" fill={dangerColor} stroke={strokeColor} strokeWidth="1.2" />
          {/* Binding band */}
          <rect x="22" y="31" width="20" height="4" fill="#18181b" />
          {/* Burning fuse */}
          <path d="M 32,22 Q 34,17 38,17" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          {/* Spark */}
          <circle cx="39" cy="17" r="2" fill={accentGlow} />
        </g>
      )

    case 'apex-firework':
      return (
        <g id="emblem-apex-firework">
          {/* Grand radiant starburst */}
          <circle cx="32" cy="32" r="3" fill="#fff" />
          <line x1="32" y1="18" x2="32" y2="24" stroke={fillPrimary} strokeWidth="2" strokeLinecap="round" />
          <line x1="32" y1="40" x2="32" y2="46" stroke={fillPrimary} strokeWidth="2" strokeLinecap="round" />
          <line x1="18" y1="32" x2="24" y2="32" stroke={fillPrimary} strokeWidth="2" strokeLinecap="round" />
          <line x1="40" y1="32" x2="46" y2="32" stroke={fillPrimary} strokeWidth="2" strokeLinecap="round" />
          {/* Diagonals */}
          <line x1="22" y1="22" x2="27" y2="27" stroke={accentGlow} strokeWidth="2" strokeLinecap="round" />
          <line x1="42" y1="22" x2="37" y2="27" stroke={accentGlow} strokeWidth="2" strokeLinecap="round" />
          <line x1="22" y1="42" x2="27" y2="37" stroke={accentGlow} strokeWidth="2" strokeLinecap="round" />
          <line x1="42" y1="42" x2="37" y2="37" stroke={accentGlow} strokeWidth="2" strokeLinecap="round" />
        </g>
      )

    case 'razor-blade':
      return (
        <g id="emblem-razor-blade">
          {/* Sharp spike tip with razor edge */}
          <polygon points="32,17 44,45 20,45" fill={dangerColor} stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="32" y1="17" x2="32" y2="45" stroke="#fff" strokeWidth="1" />
          {/* Graze spark right at the tip */}
          <circle cx="32" cy="17" r="3" fill={accentGlow} />
          <path d="M 28,14 L 32,17 L 36,14" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )

    case 'perimeter-spikes':
      return (
        <g id="emblem-perimeter-spikes">
          {/* Ceiling teeth band */}
          <polygon points="18,18 23,26 28,18 33,26 38,18 43,26 46,18" fill={dangerColor} stroke={strokeColor} strokeWidth="1.2" />
          {/* Floor teeth band */}
          <polygon points="18,46 23,38 28,46 33,38 38,46 43,38 46,46" fill={dangerColor} stroke={strokeColor} strokeWidth="1.2" />
          {/* Player gliding between them */}
          <circle cx="32" cy="32" r="3.5" fill={fillPrimary} stroke="#fff" strokeWidth="1" />
        </g>
      )

    case 'flap-feather':
    default:
      return (
        <g id="emblem-flap-feather">
          {/* Aerodynamic Flap Feather */}
          <path d="M 43,19 C 33,21 21,30 20,44 C 27,43 37,36 43,26 Z" fill={fillPrimary} stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
          {/* Feather quill stem */}
          <line x1="20" y1="44" x2="43" y2="19" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          {/* Wind streak */}
          <path d="M 24,24 Q 30,22 36,25" fill="none" stroke={accentGlow} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )
  }
}
