import type { ReactNode } from 'react'

export type ChassisTier = 'bronze' | 'silver' | 'gold' | 'cyber' | 'dojo' | 'hazard'

interface ChassisProps {
  readonly tier: ChassisTier
  readonly unlocked: boolean
  readonly children: ReactNode
  readonly size?: number
  readonly className?: string
  readonly id?: string
}

/**
 * Deterministic 64×64 SVG Chassis Frame Engine.
 *
 * Guarantees strict 3-layer semantic architecture:
 *  1. <g id="background-chassis"> : Outer frame geometry, bevels, rim, and socket
 *  2. <g id="primary-emblem">     : Central thematic vector symbol (inner bbox: 16,16 to 48,48)
 *  3. <g id="accent-highlights">  : Specular edge glints, corner studs, neon nodes
 */
export function AchievementChassis({
  tier,
  unlocked,
  children,
  size = 64,
  className = '',
  id = '',
}: ChassisProps) {
  // Deterministic gradient ID prefix for this tier/lock state
  const prefix = `nx-chassis-${tier}-${unlocked ? 'u' : 'l'}`

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`nx-achievement-badge-svg ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
      data-tier={tier}
      data-unlocked={unlocked ? 'true' : 'false'}
      data-achievement-id={id}
    >
      <defs>
        {/* Universal Chassis Shadow Filter */}
        <filter id={`${prefix}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity={unlocked ? '0.35' : '0.2'} />
        </filter>

        {/* Tier-specific Gradients */}
        {tier === 'gold' && (
          <>
            <linearGradient id={`${prefix}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="45%" stopColor="#f6821f" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <radialGradient id={`${prefix}-socket`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#3b1f07" />
              <stop offset="85%" stopColor="#1c0e04" />
            </radialGradient>
          </>
        )}

        {tier === 'silver' && (
          <>
            <linearGradient id={`${prefix}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f4f4f5" />
              <stop offset="50%" stopColor="#a1a1aa" />
              <stop offset="100%" stopColor="#52525b" />
            </linearGradient>
            <radialGradient id={`${prefix}-socket`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#27272a" />
              <stop offset="85%" stopColor="#141416" />
            </radialGradient>
          </>
        )}

        {tier === 'bronze' && (
          <>
            <linearGradient id={`${prefix}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fdba74" />
              <stop offset="50%" stopColor="#c2410c" />
              <stop offset="100%" stopColor="#7c2d12" />
            </linearGradient>
            <radialGradient id={`${prefix}-socket`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#29150d" />
              <stop offset="85%" stopColor="#160c07" />
            </radialGradient>
          </>
        )}

        {tier === 'cyber' && (
          <>
            <linearGradient id={`${prefix}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#0e7490" />
            </linearGradient>
            <radialGradient id={`${prefix}-socket`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#082f49" />
              <stop offset="85%" stopColor="#031625" />
            </radialGradient>
          </>
        )}

        {tier === 'dojo' && (
          <>
            <linearGradient id={`${prefix}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fca5a5" />
              <stop offset="40%" stopColor="#ef4444" />
              <stop offset="85%" stopColor="#991b1b" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
            <radialGradient id={`${prefix}-socket`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#300d0d" />
              <stop offset="85%" stopColor="#160606" />
            </radialGradient>
          </>
        )}

        {tier === 'hazard' && (
          <>
            <linearGradient id={`${prefix}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="45%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <radialGradient id={`${prefix}-socket`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#2c1a06" />
              <stop offset="85%" stopColor="#140b03" />
            </radialGradient>
          </>
        )}

        {/* Locked State Overrides */}
        {!unlocked && (
          <>
            <linearGradient id={`${prefix}-locked-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#52525b" />
              <stop offset="100%" stopColor="#27272a" />
            </linearGradient>
            <radialGradient id={`${prefix}-locked-socket`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#1c1c1f" />
              <stop offset="100%" stopColor="#101012" />
            </radialGradient>
          </>
        )}
      </defs>

      {/* ──────────────────────────────────────────────────────────────────
          LAYER 1: BACKGROUND CHASSIS (Outer Bevel, Rim & Recessed Socket)
          ────────────────────────────────────────────────────────────────── */}
      <g id="background-chassis">
        {renderChassisBase(tier, unlocked, prefix)}
      </g>

      {/* ──────────────────────────────────────────────────────────────────
          LAYER 2: PRIMARY EMBLEM (Constrained 32×32 inner zone: 16 to 48)
          ────────────────────────────────────────────────────────────────── */}
      <g id="primary-emblem" transform-origin="32 32">
        {children}
      </g>

      {/* ──────────────────────────────────────────────────────────────────
          LAYER 3: ACCENT HIGHLIGHTS (Specular Sheen, Glints, Corner Studs)
          ────────────────────────────────────────────────────────────────── */}
      <g id="accent-highlights" pointerEvents="none">
        {renderChassisAccents(tier, unlocked)}
      </g>
    </svg>
  )
}

function renderChassisBase(tier: ChassisTier, unlocked: boolean, prefix: string) {
  const rimFill = unlocked ? `url(#${prefix}-rim)` : `url(#${prefix}-locked-rim)`
  const socketFill = unlocked ? `url(#${prefix}-socket)` : `url(#${prefix}-locked-socket)`

  switch (tier) {
    case 'gold':
      // Crowned 6-point Hex Shield
      return (
        <>
          {/* Base plate with drop shadow */}
          <polygon
            points="32,4 56,15 56,48 32,60 8,48 8,15"
            fill={rimFill}
            filter={`url(#${prefix}-shadow)`}
          />
          {/* Inner beveled bevel line */}
          <polygon
            points="32,6 54,16 54,46 32,57 10,46 10,16"
            fill="none"
            stroke="#000"
            strokeOpacity="0.4"
            strokeWidth="1.2"
          />
          {/* Recessed socket */}
          <polygon
            points="32,9 51,18 51,45 32,54 13,45 13,18"
            fill={socketFill}
          />
          {/* Subtle inner socket depth stroke */}
          <polygon
            points="32,9 51,18 51,45 32,54 13,45 13,18"
            fill="none"
            stroke={unlocked ? '#f6821f' : '#3f3f46'}
            strokeOpacity={unlocked ? '0.35' : '0.2'}
            strokeWidth="1"
          />
        </>
      )

    case 'cyber':
      // Angular Sci-Fi Hex with Cutaway Edges
      return (
        <>
          <polygon
            points="32,5 57,18 57,46 32,59 7,46 7,18"
            fill={rimFill}
            filter={`url(#${prefix}-shadow)`}
          />
          <polygon
            points="32,7 55,19 55,44 32,57 9,44 9,19"
            fill="none"
            stroke="#000"
            strokeOpacity="0.5"
            strokeWidth="1"
          />
          {/* Recessed tech socket */}
          <polygon
            points="32,10 52,21 52,43 32,54 12,43 12,21"
            fill={socketFill}
          />
          {/* Circuit tech corner brackets */}
          <path
            d="M 16,16 L 12,21 L 12,26 M 48,16 L 52,21 L 52,26 M 16,48 L 12,43 L 12,38 M 48,48 L 52,43 L 52,38"
            fill="none"
            stroke={unlocked ? '#22d3ee' : '#52525b'}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </>
      )

    case 'dojo':
      // Medallion Ring with Torii & Seal Notches
      return (
        <>
          <circle
            cx="32"
            cy="32"
            r="27"
            fill={rimFill}
            filter={`url(#${prefix}-shadow)`}
          />
          <circle
            cx="32"
            cy="32"
            r="25"
            fill="none"
            stroke="#000"
            strokeOpacity="0.4"
            strokeWidth="1.2"
          />
          {/* Recessed circular tatami socket */}
          <circle
            cx="32"
            cy="32"
            r="21.5"
            fill={socketFill}
          />
          {/* Medallion four-point notches */}
          <path
            d="M 32,5 L 32,9 M 32,55 L 32,59 M 5,32 L 9,32 M 55,32 L 59,32"
            stroke={unlocked ? '#fde047' : '#3f3f46'}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )

    case 'hazard':
      // Industrial Diamond / Warning Chevron Shield
      return (
        <>
          <polygon
            points="32,4 58,32 32,60 6,32"
            fill={rimFill}
            filter={`url(#${prefix}-shadow)`}
          />
          <polygon
            points="32,7 55,32 32,57 9,32"
            fill="none"
            stroke="#000"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
          {/* Recessed diamond socket */}
          <polygon
            points="32,10 51,32 32,54 13,32"
            fill={socketFill}
          />
          {/* Industrial notch brackets */}
          <line x1="28" y1="6" x2="36" y2="6" stroke="#000" strokeWidth="2" strokeOpacity="0.5" />
          <line x1="28" y1="58" x2="36" y2="58" stroke="#000" strokeWidth="2" strokeOpacity="0.5" />
        </>
      )

    case 'silver':
      // Octagonal Beveled Shield
      return (
        <>
          <polygon
            points="20,5 44,5 59,20 59,44 44,59 20,59 5,44 5,20"
            fill={rimFill}
            filter={`url(#${prefix}-shadow)`}
          />
          <polygon
            points="21,7 43,7 57,21 57,43 43,57 21,57 7,43 7,21"
            fill="none"
            stroke="#000"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          <polygon
            points="22,10 42,10 54,22 54,42 42,54 22,54 10,42 10,22"
            fill={socketFill}
          />
        </>
      )

    case 'bronze':
    default:
      // Rounded Chamfered Squircle (Arcade Classic)
      return (
        <>
          <rect
            x="5"
            y="5"
            width="54"
            height="54"
            rx="14"
            fill={rimFill}
            filter={`url(#${prefix}-shadow)`}
          />
          <rect
            x="7"
            y="7"
            width="50"
            height="50"
            rx="12"
            fill="none"
            stroke="#000"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          <rect
            x="10"
            y="10"
            width="44"
            height="44"
            rx="10"
            fill={socketFill}
          />
        </>
      )
  }
}

function renderChassisAccents(tier: ChassisTier, unlocked: boolean) {
  if (!unlocked) {
    // Locked State: subtle dark lock rivet in bottom center
    return (
      <circle cx="32" cy="54" r="1.5" fill="#52525b" />
    )
  }

  switch (tier) {
    case 'gold':
      return (
        <>
          {/* Top light reflection glint */}
          <path
            d="M 18,12 L 32,6 L 46,12"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.6"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Corner golden rivets */}
          <circle cx="12" cy="18" r="1.5" fill="#fde047" />
          <circle cx="52" cy="18" r="1.5" fill="#fde047" />
          <circle cx="32" cy="58" r="1.5" fill="#fde047" />
        </>
      )

    case 'cyber':
      return (
        <>
          {/* Cyber light piping glints */}
          <path
            d="M 18,9 L 32,6 L 46,9"
            fill="none"
            stroke="#67e8f9"
            strokeOpacity="0.8"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="32" cy="6" r="1.8" fill="#a5f3fc" />
          <circle cx="7" cy="32" r="1.5" fill="#22d3ee" />
          <circle cx="57" cy="32" r="1.5" fill="#22d3ee" />
        </>
      )

    case 'dojo':
      return (
        <>
          <circle cx="32" cy="11" r="1.5" fill="#fef08a" />
          <circle cx="32" cy="53" r="1.5" fill="#fef08a" />
          <path
            d="M 17,17 A 22 22 0 0 1 47 17"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.35"
            strokeWidth="1.2"
          />
        </>
      )

    case 'hazard':
      return (
        <>
          <circle cx="32" cy="8" r="1.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="0.8" />
          <path
            d="M 15,32 L 32,15 L 49,32"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.3"
            strokeWidth="1.2"
          />
        </>
      )

    case 'silver':
      return (
        <>
          <path
            d="M 23,7 L 41,7"
            stroke="#ffffff"
            strokeOpacity="0.75"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="9" cy="22" r="1.3" fill="#ffffff" strokeOpacity="0.6" />
          <circle cx="55" cy="22" r="1.3" fill="#ffffff" strokeOpacity="0.6" />
        </>
      )

    case 'bronze':
    default:
      return (
        <>
          <path
            d="M 16,7 L 34,7"
            stroke="#fed7aa"
            strokeOpacity="0.55"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="10" cy="10" r="1.2" fill="#fed7aa" />
          <circle cx="54" cy="10" r="1.2" fill="#fed7aa" />
        </>
      )
  }
}
