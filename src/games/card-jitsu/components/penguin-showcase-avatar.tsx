import type { CSSProperties } from 'react'

export interface PenguinShowcaseAvatarProps {
  readonly colorId?: number
  readonly beltRank?: number
  readonly className?: string
  readonly style?: CSSProperties
}

/**
 * Renders an authentic Club Penguin paperdoll avatar dynamically by layering
 * 600×600 transparent PNG assets (body color + martial belt + ninja mask).
 */
export function PenguinShowcaseAvatar({
  colorId = 1,
  beltRank = 0,
  className,
  style,
}: PenguinShowcaseAvatarProps) {
  const safeColor = colorId >= 1 && colorId <= 16 ? colorId : 1
  // Belt rank 1..9 maps to items 4025..4033; rank 10 wears Black Belt (4033) + Ninja Mask (104)
  const beltId =
    beltRank >= 1 && beltRank <= 9
      ? 4024 + beltRank
      : beltRank >= 10
        ? 4033
        : null
  const isNinjaMaster = beltRank >= 10

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...style,
  }

  const layerStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    pointerEvents: 'none',
    userSelect: 'none',
  }

  return (
    <div className={`nx-penguin-avatar-paperdoll ${className ?? ''}`} style={containerStyle}>
      {/* Layer 1: Body Color (1-16) */}
      <img
        src={`/games/card-jitsu/paperdoll/colors/${safeColor}.png`}
        alt="Penguin"
        style={layerStyle}
        draggable={false}
      />

      {/* Layer 2: Martial Belt (4025-4033) */}
      {beltId !== null && (
        <img
          src={`/games/card-jitsu/paperdoll/belts/${beltId}.png`}
          alt="Martial Belt"
          style={layerStyle}
          draggable={false}
        />
      )}

      {/* Layer 3: Ninja Mask (104) for Ninja Master */}
      {isNinjaMaster && (
        <img
          src="/games/card-jitsu/paperdoll/items/104.png"
          alt="Ninja Mask"
          style={layerStyle}
          draggable={false}
        />
      )}
    </div>
  )
}
