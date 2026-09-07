import type { ReactNode } from 'react'

/**
 * Platform & Meta track vector emblems (centered in [16, 16, 48, 48]).
 */
export function getPlatformEmblem(icon: string, unlocked: boolean): ReactNode {
  const fillPrimary = unlocked ? '#f6821f' : '#71717a'
  const fillSecondary = unlocked ? '#fbad41' : '#52525b'
  const strokeColor = unlocked ? '#fff' : '#a1a1aa'
  const accentGlow = unlocked ? '#fde047' : '#3f3f46'

  switch (icon) {
    case 'candy-vault':
      return (
        <g id="emblem-candy-vault">
          {/* Left wrapper twist */}
          <polygon points="19,25 25,32 19,39" fill={fillSecondary} stroke={strokeColor} strokeWidth="1.2" strokeLinejoin="round" />
          {/* Right wrapper twist */}
          <polygon points="45,25 39,32 45,39" fill={fillSecondary} stroke={strokeColor} strokeWidth="1.2" strokeLinejoin="round" />
          {/* Main candy oval */}
          <ellipse cx="32" cy="32" rx="11" ry="8" fill={fillPrimary} stroke={strokeColor} strokeWidth="1.5" />
          {/* Candy swirl stripes */}
          <path d="M 28,26 Q 32,32 28,38" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 33,24 Q 37,32 33,40" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )

    case 'arcade-quarter':
      return (
        <g id="emblem-arcade-quarter">
          <circle cx="32" cy="32" r="14" fill={fillSecondary} stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="32" cy="32" r="11" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="3 2" />
          {/* Coin Star Core */}
          <polygon points="32,24 34,29 39,29 35,33 37,38 32,35 27,38 29,33 25,29 30,29" fill={fillPrimary} />
        </g>
      )

    case 'arcade-cabinet':
      return (
        <g id="emblem-arcade-cabinet">
          {/* Cabinet body */}
          <path d="M 23,17 L 41,17 L 39,27 L 41,47 L 23,47 L 25,27 Z" fill={fillPrimary} stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
          {/* Marquee */}
          <rect x="25" y="19" width="14" height="4" rx="1" fill={accentGlow} />
          {/* Screen */}
          <rect x="26" y="25" width="12" height="9" rx="1" fill="#18181b" stroke={fillSecondary} strokeWidth="1" />
          {/* Pixel blip on screen */}
          <rect x="30" y="28" width="4" height="3" rx="0.5" fill="#22c55e" />
          {/* Joystick */}
          <line x1="32" y1="39" x2="32" y2="43" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="32" cy="38" r="2" fill="#ef4444" />
        </g>
      )

    case 'arcade-legend':
      return (
        <g id="emblem-arcade-legend">
          {/* Trophy Cup */}
          <path d="M 24,20 L 40,20 L 38,32 Q 38,36 32,36 Q 26,36 26,32 Z" fill={fillSecondary} stroke={strokeColor} strokeWidth="1.5" />
          {/* Trophy Stem & Base */}
          <rect x="30" y="36" width="4" height="6" fill={fillPrimary} stroke={strokeColor} strokeWidth="1" />
          <rect x="24" y="42" width="16" height="4" rx="1" fill={fillPrimary} stroke={strokeColor} strokeWidth="1.2" />
          {/* Trophy Handles */}
          <path d="M 24,23 Q 19,23 20,29 Q 22,34 26,32" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 40,23 Q 45,23 44,29 Q 42,34 38,32" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          {/* Crown on Cup */}
          <polygon points="28,24 30,28 32,23 34,28 36,24 36,29 28,29" fill={accentGlow} />
        </g>
      )

    case 'flame-streak':
      return (
        <g id="emblem-flame-streak">
          {/* Outer flame */}
          <path d="M 32,16 Q 39,24 39,32 Q 39,44 32,46 Q 25,44 25,32 Q 25,26 29,22 Q 29,27 33,26 Q 30,22 32,16 Z" fill={fillPrimary} stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
          {/* Inner core flame */}
          <path d="M 32,27 Q 36,32 36,37 Q 36,44 32,44 Q 28,44 28,37 Q 28,33 30,31 Q 31,34 33,33 Q 31,30 32,27 Z" fill={accentGlow} />
        </g>
      )

    case 'claimed-identity':
      return (
        <g id="emblem-claimed-identity">
          {/* Hanging badge card */}
          <rect x="22" y="21" width="20" height="25" rx="3" fill="#ffffff" stroke={strokeColor} strokeWidth="1.5" />
          {/* Top Lanyard Clip */}
          <rect x="29" y="17" width="6" height="5" rx="1" fill={fillSecondary} stroke={strokeColor} strokeWidth="1" />
          <circle cx="32" cy="19" r="1" fill="#fff" />
          {/* ID Photo Avatar */}
          <circle cx="32" cy="28" r="4" fill={fillPrimary} />
          <path d="M 26,39 C 26,35 28,34 32,34 C 36,34 38,35 38,39" fill={fillPrimary} />
          {/* Bottom text bar */}
          <line x1="26" y1="42" x2="38" y2="42" stroke={fillSecondary} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )

    case 'camera-avatar':
      return (
        <g id="emblem-camera-avatar">
          {/* Camera housing */}
          <rect x="20" y="23" width="24" height="20" rx="3" fill={fillPrimary} stroke={strokeColor} strokeWidth="1.5" />
          {/* Flash / Pentaprism top */}
          <polygon points="27,23 30,18 34,18 37,23" fill={fillSecondary} stroke={strokeColor} strokeWidth="1.2" strokeLinejoin="round" />
          {/* Big Lens */}
          <circle cx="32" cy="33" r="6.5" fill="#18181b" stroke="#fff" strokeWidth="1.5" />
          <circle cx="32" cy="33" r="3.5" fill={accentGlow} />
          {/* Flash dot */}
          <circle cx="39" cy="27" r="1.5" fill="#fff" />
        </g>
      )

    case 'pioneer-bolt':
      return (
        <g id="emblem-pioneer-bolt">
          <polygon
            points="34,16 23,31 31,31 29,48 41,31 33,31"
            fill={accentGlow}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      )

    case 'developer-wrench':
      return (
        <g id="emblem-developer-wrench">
          {/* Crossed Wrench & Hammer */}
          <path d="M 21,21 L 43,43 M 43,21 L 21,43" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
          <path d="M 22,22 L 42,42" stroke={fillPrimary} strokeWidth="2" strokeLinecap="round" />
          <path d="M 42,22 L 22,42" stroke={fillSecondary} strokeWidth="2" strokeLinecap="round" />
          {/* Wrench Jaw */}
          <circle cx="21" cy="21" r="3" fill={fillPrimary} stroke={strokeColor} strokeWidth="1" />
          {/* Cog Wheel Center */}
          <circle cx="32" cy="32" r="4.5" fill={accentGlow} stroke={strokeColor} strokeWidth="1" />
          <circle cx="32" cy="32" r="1.5" fill="#18181b" />
        </g>
      )

    case 'passport-clipboard':
      return (
        <g id="emblem-passport-clipboard">
          <rect x="22" y="19" width="20" height="27" rx="2" fill="#ffffff" stroke={strokeColor} strokeWidth="1.5" />
          <rect x="27" y="17" width="10" height="4" rx="1" fill={fillSecondary} stroke={strokeColor} strokeWidth="1" />
          {/* Stamp checkmark inside */}
          <circle cx="32" cy="33" r="7" fill="none" stroke={fillPrimary} strokeWidth="1.2" strokeDasharray="2 1.5" />
          <path d="M 28,33 L 31,36 L 36,30" fill="none" stroke={fillPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )

    case 'crossed-swords':
      return (
        <g id="emblem-crossed-swords">
          {/* Left Sword */}
          <line x1="20" y1="44" x2="44" y2="20" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="20" y1="44" x2="44" y2="20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="22" y1="38" x2="26" y2="42" stroke={fillPrimary} strokeWidth="2" strokeLinecap="round" />
          {/* Right Sword */}
          <line x1="44" y1="44" x2="20" y2="20" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="44" y1="44" x2="20" y2="20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="42" y1="38" x2="38" y2="42" stroke={fillPrimary} strokeWidth="2" strokeLinecap="round" />
          {/* Clash spark */}
          <circle cx="32" cy="32" r="2.5" fill={accentGlow} />
        </g>
      )

    case 'diamond-crown':
      return (
        <g id="emblem-diamond-crown">
          {/* Diamond faceted gem */}
          <polygon points="32,20 44,28 32,46 20,28" fill={fillPrimary} stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
          <polygon points="32,20 37,28 32,46 27,28" fill={accentGlow} stroke={strokeColor} strokeWidth="1" />
          {/* Top glint */}
          <circle cx="32" cy="18" r="1.5" fill="#fff" />
        </g>
      )

    case 'tour-compass':
      return (
        <g id="emblem-tour-compass">
          <circle cx="32" cy="32" r="13" fill="#18181b" stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="32" cy="32" r="10" fill="none" stroke={fillSecondary} strokeWidth="1" strokeDasharray="1 3" />
          {/* North needle */}
          <polygon points="32,20 35,32 32,30 29,32" fill="#ef4444" stroke={strokeColor} strokeWidth="1" />
          {/* South needle */}
          <polygon points="32,44 35,32 32,34 29,32" fill="#ffffff" stroke={strokeColor} strokeWidth="1" />
          <circle cx="32" cy="32" r="2" fill={accentGlow} />
        </g>
      )

    case 'terminal-keyboard':
    default:
      return (
        <g id="emblem-terminal-keyboard">
          {/* CRT Terminal Screen */}
          <rect x="20" y="20" width="24" height="19" rx="2.5" fill="#18181b" stroke={strokeColor} strokeWidth="1.5" />
          {/* Prompt > */}
          <path d="M 24,26 L 28,29 L 24,32" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          {/* Underscore cursor */}
          <line x1="30" y1="32" x2="35" y2="32" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
          {/* Keyboard base */}
          <polygon points="19,42 45,42 43,45 21,45" fill={fillSecondary} stroke={strokeColor} strokeWidth="1" />
        </g>
      )
  }
}
