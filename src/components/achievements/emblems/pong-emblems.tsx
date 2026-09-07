import type { ReactNode } from 'react'

/**
 * Pong track vector emblems (centered in [16, 16, 48, 48]).
 */
export function getPongEmblem(icon: string, unlocked: boolean): ReactNode {
  const fillPrimary = unlocked ? '#f6821f' : '#71717a'
  const strokeColor = unlocked ? '#fff' : '#a1a1aa'
  const accentColor = unlocked ? '#38bdf8' : '#52525b'
  const glowColor = unlocked ? '#fde047' : '#3f3f46'

  switch (icon) {
    case 'paddle-volley':
      return (
        <g id="emblem-paddle-volley">
          {/* Vertical Paddle */}
          <rect x="20" y="22" width="5" height="20" rx="2" fill="#ffffff" stroke={strokeColor} strokeWidth="1.2" />
          {/* Pong Ball */}
          <rect x="36" y="29" width="6" height="6" rx="1" fill={fillPrimary} stroke={strokeColor} strokeWidth="1" />
          {/* Kinetic trail dashed lines */}
          <line x1="26" y1="32" x2="35" y2="32" stroke={glowColor} strokeWidth="2" strokeDasharray="2 1.5" />
          {/* Speed ripples */}
          <path d="M 44,28 Q 48,32 44,36" fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )

    case 'pong-bot':
      return (
        <g id="emblem-pong-bot">
          {/* Robot Head */}
          <rect x="21" y="22" width="22" height="19" rx="3" fill="#27272a" stroke={strokeColor} strokeWidth="1.5" />
          {/* Antenna */}
          <line x1="32" y1="22" x2="32" y2="17" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="32" cy="16" r="2" fill={fillPrimary} />
          {/* Visor Screen */}
          <rect x="24" y="26" width="16" height="6" rx="1" fill="#09090b" />
          <rect x="26" y="28" width="5" height="2" rx="0.5" fill={accentColor} />
          <rect x="33" y="28" width="5" height="2" rx="0.5" fill={accentColor} />
          {/* Audio grill */}
          <line x1="26" y1="36" x2="38" y2="36" stroke="#52525b" strokeWidth="1" strokeLinecap="round" />
        </g>
      )

    case 'secret-boss-eye':
      return (
        <g id="emblem-secret-boss-eye">
          {/* Outer Eyeball Contour */}
          <path d="M 18,32 Q 32,19 46,32 Q 32,45 18,32 Z" fill="#18181b" stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
          {/* Mechanical Iris */}
          <circle cx="32" cy="32" r="7" fill="#ef4444" stroke="#fff" strokeWidth="1" />
          {/* Predictive Slit Pupil */}
          <ellipse cx="32" cy="32" rx="2" ry="5.5" fill="#000" />
          <circle cx="33" cy="30" r="1" fill="#fff" />
          {/* Kinematic targeting reticles */}
          <path d="M 32,17 L 32,20 M 32,44 L 32,47 M 17,32 L 20,32 M 44,32 L 47,32" stroke={glowColor} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )

    case 'solid-defense':
      return (
        <g id="emblem-solid-defense">
          {/* Shield Silhouette */}
          <path d="M 23,20 L 41,20 Q 42,32 32,44 Q 22,32 23,20 Z" fill={fillPrimary} stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
          {/* Inner defense chevron */}
          <path d="M 27,24 L 32,21 L 37,24 L 37,31 Q 37,37 32,41 Q 27,37 27,31 Z" fill="#ffffff" />
          {/* Pong barrier emblem on shield */}
          <rect x="29.5" y="28" width="5" height="8" rx="1" fill="#18181b" />
        </g>
      )

    case 'shop-cart':
      return (
        <g id="emblem-shop-cart">
          {/* Shopping Cart Body */}
          <path d="M 20,22 L 24,22 L 27,37 L 41,37 L 44,26 L 25,26" fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          {/* Wheels */}
          <circle cx="28" cy="41" r="2" fill={fillPrimary} stroke={strokeColor} strokeWidth="1" />
          <circle cx="39" cy="41" r="2" fill={fillPrimary} stroke={strokeColor} strokeWidth="1" />
          {/* Candy Load in cart */}
          <circle cx="34" cy="24" r="4.5" fill={glowColor} stroke="#fff" strokeWidth="1" />
          <ellipse cx="34" cy="24" rx="2" ry="4" fill={fillPrimary} />
        </g>
      )

    case 'power-magnet':
      return (
        <g id="emblem-power-magnet">
          {/* Horseshoe Magnet */}
          <path d="M 23,22 L 23,31 A 9 9 0 0 0 41 31 L 41,22" fill="none" stroke="#ef4444" strokeWidth="5" strokeLinecap="square" />
          {/* Silver pole tips */}
          <rect x="20.5" y="20" width="5" height="4" fill="#ffffff" stroke={strokeColor} strokeWidth="0.8" />
          <rect x="38.5" y="20" width="5" height="4" fill="#ffffff" stroke={strokeColor} strokeWidth="0.8" />
          {/* Magnetic flux lines */}
          <path d="M 27,18 Q 32,23 37,18" fill="none" stroke={accentColor} strokeWidth="1.2" strokeLinecap="round" />
          {/* Captured ball */}
          <rect x="30" y="28" width="4" height="4" rx="0.8" fill={glowColor} />
        </g>
      )

    case 'power-glass':
      return (
        <g id="emblem-power-glass">
          {/* Crystal Glass Wall */}
          <polygon points="26,19 38,19 36,44 24,44" fill={accentColor} fillOpacity="0.75" stroke={strokeColor} strokeWidth="1.5" />
          {/* Glass reflection highlights */}
          <line x1="28" y1="23" x2="31" y2="40" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="33" y1="22" x2="34" y2="30" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
        </g>
      )

    case 'power-speed':
    default:
      return (
        <g id="emblem-power-speed">
          {/* Dual Turbo Lightning Arrows */}
          <polygon points="31,17 21,31 29,31 26,45 39,29 31,29" fill={glowColor} stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
          {/* Sonic Boom Wind trails */}
          <path d="M 39,21 Q 45,26 43,33" fill="none" stroke={fillPrimary} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )
  }
}
