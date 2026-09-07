import type { ReactNode } from 'react'

/**
 * FL Tron 3.0 vector emblems (centered in [16, 16, 48, 48]).
 */
export function getTronEmblem(icon: string, unlocked: boolean): ReactNode {
  const neonCyan = unlocked ? '#22d3ee' : '#71717a'
  const neonBlue = unlocked ? '#0284c7' : '#3f3f46'
  const strokeColor = unlocked ? '#fff' : '#a1a1aa'
  const accentGlow = unlocked ? '#67e8f9' : '#52525b'

  switch (icon) {
    case 'lightcycle':
      return (
        <g id="emblem-lightcycle">
          {/* Cyber lightcycle chassis */}
          <path d="M 20,36 L 25,27 L 37,27 L 44,36 L 41,39 L 23,39 Z" fill={neonBlue} stroke={strokeColor} strokeWidth="1.2" strokeLinejoin="round" />
          {/* Cockpit canopy */}
          <polygon points="27,27 34,27 36,31 29,31" fill="#fff" />
          {/* Front luminous wheel hub */}
          <circle cx="41" cy="36" r="5" fill="#09090b" stroke={neonCyan} strokeWidth="2" />
          <circle cx="41" cy="36" r="2" fill="#fff" />
          {/* Rear luminous wheel hub */}
          <circle cx="23" cy="36" r="5" fill="#09090b" stroke={neonCyan} strokeWidth="2" />
          <circle cx="23" cy="36" r="2" fill="#fff" />
          {/* Trailing light wall ribbon */}
          <path d="M 18,36 L 16,36" stroke={neonCyan} strokeWidth="3" strokeLinecap="square" />
        </g>
      )

    case 'turbo-exhaust':
      return (
        <g id="emblem-turbo-exhaust">
          {/* Exhaust Thruster Nozzle */}
          <polygon points="22,25 31,27 31,37 22,39" fill="#18181b" stroke={strokeColor} strokeWidth="1.2" strokeLinejoin="round" />
          {/* Nitro Core Blast */}
          <polygon points="31,28 44,32 31,36" fill={neonCyan} stroke="#fff" strokeWidth="1" />
          <polygon points="31,30 39,32 31,34" fill="#ffffff" />
          {/* Exhaust particle trails */}
          <line x1="17" y1="28" x2="21" y2="28" stroke={accentGlow} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="15" y1="32" x2="20" y2="32" stroke={accentGlow} strokeWidth="2" strokeLinecap="round" />
          <line x1="17" y1="36" x2="21" y2="36" stroke={accentGlow} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )

    case 'closed-box':
      return (
        <g id="emblem-closed-box">
          {/* 4-Wall light box trap */}
          <rect x="21" y="21" width="22" height="22" fill="#082f49" fillOpacity="0.5" stroke={neonCyan} strokeWidth="2.5" />
          {/* Trapped enemy blip inside */}
          <circle cx="32" cy="32" r="3.5" fill="#ef4444" stroke="#fff" strokeWidth="1" />
          {/* Grid lines inside box */}
          <line x1="32" y1="21" x2="32" y2="43" stroke={accentGlow} strokeWidth="0.8" strokeDasharray="2 2" strokeOpacity="0.5" />
          <line x1="21" y1="32" x2="43" y2="32" stroke={accentGlow} strokeWidth="0.8" strokeDasharray="2 2" strokeOpacity="0.5" />
        </g>
      )

    case 'iron-coil':
      return (
        <g id="emblem-iron-coil">
          {/* Concentric spiral light wall path */}
          <path d="M 32,32 L 32,27 A 5 5 0 0 1 37 32 A 9 9 0 0 1 28 41 A 13 13 0 0 1 19 32 A 17 17 0 0 1 36 15" fill="none" stroke={neonCyan} strokeWidth="2.2" strokeLinecap="round" />
          {/* Target cycle in center */}
          <circle cx="32" cy="32" r="2.5" fill="#ef4444" />
        </g>
      )

    case 'flawless-sparkle':
      return (
        <g id="emblem-flawless-sparkle">
          {/* Grand 4-point Diamond Star */}
          <path d="M 32,17 Q 32,32 47,32 Q 32,32 32,47 Q 32,32 17,32 Q 32,32 32,17 Z" fill={accentGlow} stroke={strokeColor} strokeWidth="1.2" />
          {/* Core White Glint */}
          <circle cx="32" cy="32" r="3" fill="#ffffff" />
          {/* Micro sparkles */}
          <circle cx="23" cy="23" r="1.5" fill="#fff" />
          <circle cx="41" cy="41" r="1.5" fill="#fff" />
        </g>
      )

    case 'cornering-arrows':
      return (
        <g id="emblem-cornering-arrows">
          {/* 90-degree Razor Turn Path */}
          <path d="M 20,44 L 20,24 L 44,24" fill="none" stroke={neonCyan} strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" />
          {/* Chevron arrowhead */}
          <polyline points="38,18 44,24 38,30" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Speed blip at corner apex */}
          <circle cx="20" cy="24" r="2.5" fill="#ffffff" />
        </g>
      )

    case 'blitz-timer':
    default:
      return (
        <g id="emblem-blitz-timer">
          {/* Futuristic Stopwatch */}
          <circle cx="32" cy="33" r="12" fill="#082f49" stroke={strokeColor} strokeWidth="1.5" />
          {/* Top button */}
          <rect x="30" y="17" width="4" height="4" rx="0.5" fill={neonCyan} stroke={strokeColor} strokeWidth="1" />
          {/* Dial ring tick marks */}
          <circle cx="32" cy="33" r="9" fill="none" stroke={neonCyan} strokeWidth="1" strokeDasharray="2 3" />
          {/* Stopwatch Hand pointing fast */}
          <line x1="32" y1="33" x2="38" y2="25" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="33" r="2" fill="#ef4444" />
        </g>
      )
  }
}
