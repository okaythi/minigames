import type { ReactNode } from 'react'

/**
 * Card-Jitsu track vector emblems (centered in [16, 16, 48, 48]).
 */
export function getCardJitsuEmblem(icon: string, unlocked: boolean): ReactNode {
  const strokeColor = unlocked ? '#fff' : '#a1a1aa'
  const goldColor = unlocked ? '#eab308' : '#71717a'
  const fireRed = unlocked ? '#ef4444' : '#52525b'
  const waterBlue = unlocked ? '#06b6d4' : '#52525b'
  const snowCyan = unlocked ? '#e0f2fe' : '#52525b'

  switch (icon) {
    case 'belt-white':
      return (
        <g id="emblem-belt-white">
          {/* Main White Obi Belt */}
          <rect x="18" y="27" width="28" height="6" rx="1.5" fill="#ffffff" stroke={strokeColor} strokeWidth="1" />
          {/* Tied Knot */}
          <ellipse cx="32" cy="30" rx="3.5" ry="4" fill="#ffffff" stroke={strokeColor} strokeWidth="1.2" />
          {/* Hanging belt ends */}
          <polygon points="31,33 27,45 31,45 34,33" fill="#ffffff" stroke={strokeColor} strokeWidth="1" />
          <polygon points="33,33 36,44 40,43 35,33" fill="#ffffff" stroke={strokeColor} strokeWidth="1" />
        </g>
      )

    case 'belt-black':
      return (
        <g id="emblem-belt-black">
          {/* Main Black Obi Belt */}
          <rect x="18" y="27" width="28" height="6" rx="1.5" fill="#18181b" stroke={strokeColor} strokeWidth="1.2" />
          {/* Tied Knot */}
          <ellipse cx="32" cy="30" rx="3.5" ry="4" fill="#18181b" stroke={strokeColor} strokeWidth="1.2" />
          {/* Hanging belt ends with gold rank bars */}
          <polygon points="31,33 27,45 31,45 34,33" fill="#18181b" stroke={strokeColor} strokeWidth="1" />
          <polygon points="33,33 36,44 40,43 35,33" fill="#18181b" stroke={strokeColor} strokeWidth="1" />
          {/* Gold rank stripe on belt tip */}
          <rect x="28" y="42" width="3" height="1.5" fill={goldColor} />
          <rect x="36.5" y="41" width="3" height="1.5" fill={goldColor} />
        </g>
      )

    case 'ninja-mask':
      return (
        <g id="emblem-ninja-mask">
          {/* Ninja Hood */}
          <path d="M 22,22 Q 32,16 42,22 L 44,38 Q 32,46 20,38 Z" fill="#18181b" stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
          {/* Eye Slit Opening */}
          <path d="M 24,28 Q 32,26 40,28 L 39,33 Q 32,31 25,33 Z" fill="#ffffff" />
          {/* Focused Eyes */}
          <circle cx="28" cy="30" r="1.5" fill="#000" />
          <circle cx="36" cy="30" r="1.5" fill="#000" />
          {/* Headband cloth knot */}
          <rect x="21" y="22" width="22" height="3" fill="#b91c1c" />
        </g>
      )

    case 'triad-fire':
      return (
        <g id="emblem-triad-fire">
          {/* Triple Fire Crest */}
          <path d="M 32,17 Q 38,24 38,32 Q 38,44 32,46 Q 26,44 26,32 Q 26,26 30,22 Q 30,27 34,26 Q 30,22 32,17 Z" fill={fireRed} stroke={strokeColor} strokeWidth="1.2" strokeLinejoin="round" />
          {/* Inner Flame Core */}
          <path d="M 32,28 Q 35,33 35,37 Q 35,43 32,43 Q 29,43 29,37 Q 29,34 31,32 Q 32,35 34,34 Q 31,31 32,28 Z" fill="#fde047" />
        </g>
      )

    case 'triad-water':
      return (
        <g id="emblem-triad-water">
          {/* Water Droplet */}
          <path d="M 32,17 C 32,17 42,28 42,34 C 42,40 37.5,45 32,45 C 26.5,45 22,40 22,34 C 22,28 32,17 32,17 Z" fill={waterBlue} stroke={strokeColor} strokeWidth="1.2" strokeLinejoin="round" />
          {/* Droplet Curvature Highlight */}
          <path d="M 26,34 Q 26,41 32,41" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="34" cy="27" r="1.5" fill="#ffffff" />
        </g>
      )

    case 'triad-snow':
      return (
        <g id="emblem-triad-snow">
          {/* 6-Arm Symmetrical Snowflake */}
          <line x1="32" y1="18" x2="32" y2="46" stroke={snowCyan} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="18" y1="25" x2="46" y2="39" stroke={snowCyan} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="18" y1="39" x2="46" y2="25" stroke={snowCyan} strokeWidth="2.5" strokeLinecap="round" />
          {/* Ice facets */}
          <circle cx="32" cy="32" r="3.5" fill="#ffffff" stroke={waterBlue} strokeWidth="1" />
          <circle cx="32" cy="18" r="1.5" fill="#fff" />
          <circle cx="32" cy="46" r="1.5" fill="#fff" />
          <circle cx="18" cy="25" r="1.5" fill="#fff" />
          <circle cx="46" cy="39" r="1.5" fill="#fff" />
          <circle cx="18" cy="39" r="1.5" fill="#fff" />
          <circle cx="46" cy="25" r="1.5" fill="#fff" />
        </g>
      )

    case 'triad-harmony':
      return (
        <g id="emblem-triad-harmony">
          {/* Tri-Element Yin Yang Swirl */}
          <circle cx="32" cy="32" r="14" fill="#18181b" stroke={strokeColor} strokeWidth="1.5" />
          {/* Fire sector */}
          <path d="M 32,32 L 32,18 A 14 14 0 0 1 44 38 Z" fill={fireRed} />
          {/* Water sector */}
          <path d="M 32,32 L 44,38 A 14 14 0 0 1 20 38 Z" fill={waterBlue} />
          {/* Snow sector */}
          <path d="M 32,32 L 20,38 A 14 14 0 0 1 32,18 Z" fill={snowCyan} />
          <circle cx="32" cy="32" r="3" fill="#ffffff" />
        </g>
      )

    case 'combat-lightning':
      return (
        <g id="emblem-combat-lightning">
          <polygon points="34,16 23,31 31,31 29,48 41,31 33,31" fill="#fde047" stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
          {/* Radiant strike glint */}
          <circle cx="32" cy="31" r="2.5" fill="#ffffff" />
        </g>
      )

    case 'combat-endurance':
      return (
        <g id="emblem-combat-endurance">
          {/* Samurai Shield Plate */}
          <polygon points="32,18 45,24 40,44 32,47 24,44 19,24" fill={goldColor} stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
          {/* Card Mat Counter '9+' */}
          <circle cx="32" cy="32" r="6" fill="#18181b" stroke="#fff" strokeWidth="1" />
          <text x="32" y="35.5" fill="#fde047" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">9</text>
        </g>
      )

    case 'combat-inversion':
      return (
        <g id="emblem-combat-inversion">
          {/* Reversal Arrows Loop */}
          <path d="M 23,28 A 11 11 0 0 1 41 24" fill="none" stroke={goldColor} strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="41,20 45,25 39,26" fill={goldColor} />
          <path d="M 41,36 A 11 11 0 0 1 23 40" fill="none" stroke={goldColor} strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="23,44 19,39 25,38" fill={goldColor} />
          {/* Power card star */}
          <circle cx="32" cy="32" r="3.5" fill="#ffffff" />
        </g>
      )

    case 'combat-strike':
      return (
        <g id="emblem-combat-strike">
          {/* Throwing Kunai Dagger */}
          <polygon points="32,17 36,29 32,41 28,29" fill="#ffffff" stroke={strokeColor} strokeWidth="1.2" />
          <line x1="32" y1="17" x2="32" y2="41" stroke="#a1a1aa" strokeWidth="1" />
          {/* Ring Pommel */}
          <circle cx="32" cy="44" r="2.5" fill="none" stroke={strokeColor} strokeWidth="1.5" />
          {/* Slash wind trail */}
          <path d="M 22,23 Q 32,29 42,23" fill="none" stroke={goldColor} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )

    case 'card-binder':
      return (
        <g id="emblem-card-binder">
          {/* Binder Album Book */}
          <rect x="22" y="19" width="22" height="26" rx="2" fill="#1e293b" stroke={strokeColor} strokeWidth="1.5" />
          {/* Spine bar */}
          <rect x="20" y="19" width="4" height="26" rx="1" fill={goldColor} stroke={strokeColor} strokeWidth="1" />
          {/* 4 Cards Grid on Cover */}
          <rect x="26" y="22" width="6" height="8" rx="0.5" fill={fireRed} />
          <rect x="34" y="22" width="6" height="8" rx="0.5" fill={waterBlue} />
          <rect x="26" y="32" width="6" height="8" rx="0.5" fill={snowCyan} />
          <rect x="34" y="32" width="6" height="8" rx="0.5" fill={goldColor} />
        </g>
      )

    case 'binder-star':
      return (
        <g id="emblem-binder-star">
          {/* 509 Club Grand Star */}
          <polygon
            points="32,17 35.5,26 45,26.5 37.5,33 40,43 32,37.5 24,43 26.5,33 19,26.5 28.5,26"
            fill={goldColor}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="32" r="3" fill="#ffffff" />
        </g>
      )

    case 'dojo-pagoda':
      return (
        <g id="emblem-dojo-pagoda">
          {/* Top roof tier */}
          <path d="M 32,18 L 24,24 L 40,24 Z" fill={fireRed} stroke={strokeColor} strokeWidth="1" />
          {/* Middle tier */}
          <path d="M 32,24 L 21,31 L 43,31 Z" fill={fireRed} stroke={strokeColor} strokeWidth="1" />
          {/* Base tier */}
          <path d="M 32,31 L 18,39 L 46,39 Z" fill={fireRed} stroke={strokeColor} strokeWidth="1.2" />
          {/* Temple pillars & gate */}
          <rect x="25" y="39" width="14" height="6" fill="#18181b" stroke={strokeColor} strokeWidth="1" />
          <rect x="29" y="41" width="6" height="4" rx="1" fill={goldColor} />
        </g>
      )

    case 'booster-pack':
    default:
      return (
        <g id="emblem-booster-pack">
          {/* Foil Booster Pack */}
          <rect x="23" y="19" width="18" height="26" rx="1.5" fill={fireRed} stroke={strokeColor} strokeWidth="1.5" />
          {/* Crimped top & bottom edges */}
          <path d="M 23,22 L 41,22 M 23,42 L 41,42" stroke={strokeColor} strokeWidth="1.2" strokeDasharray="1.5 1.5" />
          {/* Foil Shine ribbon */}
          <polygon points="26,19 32,19 28,45 22,45" fill="#ffffff" fillOpacity="0.35" />
          {/* Dojo Kanji / Star Mark */}
          <circle cx="32" cy="32" r="4.5" fill={goldColor} stroke="#fff" strokeWidth="1" />
          <polygon points="32,29 33.5,33 37,33 34,35 35,38 32,36 29,38 30,35 27,33 30.5,33" fill="#18181b" />
        </g>
      )
  }
}
