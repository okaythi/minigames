import { useState, useEffect } from 'react'
import { GameTemplate } from '../template/game-template'
import { flTron3Manifest } from './manifest'
import { createTronRuntime } from './runtime'
import type { DifficultyLevel } from './engine/types'
import { type GameSnapshot } from '../template/snapshot'
import { QuantumHologram } from '../../components/quantum-hologram'
import { getMe } from '../../services/auth-api'

function renderLeftImage(snapshot: GameSnapshot) {
  const { customState } = snapshot
  if (!customState) return null
  
  const { level, phase } = customState

  let stateName: 'determined' | 'mad' | 'sad' | 'smug' = 'determined'
  
  if (phase === 'game_over') {
    stateName = 'smug' // AI won
  } else if (phase === 'victory') {
    stateName = 'sad' // AI lost
  } else {
    // Normal state, pre-game, during game
    if (level === 6) {
      stateName = 'mad'
    } else {
      stateName = 'determined'
    }
  }

  return (
    <div style={{ flex: 1, position: 'relative', width: '264px' }}>
      <QuantumHologram stateName={stateName} />
    </div>
  )
}

const LEVEL_LABELS: Record<DifficultyLevel, { name: string; tag: string }> = {
  1: { name: 'Novice', tag: 'L1' },
  2: { name: 'Scout', tag: 'L2' },
  3: { name: 'Hunter', tag: 'L3' },
  4: { name: 'Tactician', tag: 'L4' },
  5: { name: 'Assassin', tag: 'L5' },
  6: { name: 'Master Core', tag: 'L6' },
}

export default function FLTron3Game() {
  const [isThy, setIsThy] = useState(false)
  const [levelSelectEnabled, setLevelSelectEnabled] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<DifficultyLevel>(1)

  useEffect(() => {
    // Check authenticated user
    void getMe().then((profile) => {
      if (profile?.username?.toLowerCase() === 'thy') {
        setIsThy(true)
      }
    })

    // Also check local dev fallback
    if (typeof window !== 'undefined') {
      const isParamThy = window.location.search.includes('user=thy')
      const isLocalThy = window.localStorage.getItem('user')?.toLowerCase() === 'thy' ||
        window.localStorage.getItem('dev_user')?.toLowerCase() === 'thy'
      if (isParamThy || isLocalThy) {
        setIsThy(true)
      }
    }
  }, [])

  const handleToggle = (enabled: boolean) => {
    setLevelSelectEnabled(enabled)
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __tronSelectedStartingLevel?: DifficultyLevel | undefined
        __tronLevelSelectEnabled?: boolean | undefined
      }
      win.__tronLevelSelectEnabled = enabled
      win.__tronSelectedStartingLevel = enabled ? selectedLevel : undefined
    }
  }

  const handleSelectLevel = (lvl: DifficultyLevel) => {
    setSelectedLevel(lvl)
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __tronSelectedStartingLevel?: DifficultyLevel | undefined
        __tronLevelSelectEnabled?: boolean | undefined
      }
      win.__tronLevelSelectEnabled = true
      win.__tronSelectedStartingLevel = lvl
      window.dispatchEvent(new CustomEvent('tron:start-level', { detail: { level: lvl } }))
    }
  }

  return (
    <>
      <GameTemplate game={{ manifest: flTron3Manifest, createRuntime: createTronRuntime }} renderLeft={renderLeftImage} />

      {isThy && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'rgba(20, 21, 24, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(246, 130, 31, 0.45)',
            borderRadius: '12px',
            padding: '10px 14px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(246, 130, 31, 0.15)',
            color: '#fff',
            fontFamily: 'var(--nx-font-mono, monospace)',
            fontSize: '11px',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
            <span style={{ color: '#f6821f', fontWeight: 800, letterSpacing: '0.6px', fontSize: '11px' }}>
              ⚡ THY // LEVEL SELECT
            </span>
            <button
              type="button"
              onClick={() => handleToggle(!levelSelectEnabled)}
              style={{
                background: levelSelectEnabled ? '#f6821f' : 'rgba(255, 255, 255, 0.12)',
                color: levelSelectEnabled ? '#000' : '#aaa',
                border: 'none',
                borderRadius: '12px',
                padding: '3px 10px',
                fontSize: '10px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {levelSelectEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {levelSelectEnabled && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
              {([1, 2, 3, 4, 5, 6] as const).map((lvl) => {
                const info = LEVEL_LABELS[lvl]
                const isCurrent = selectedLevel === lvl
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleSelectLevel(lvl)}
                    style={{
                      flex: 1,
                      background: isCurrent ? 'rgba(246, 130, 31, 0.28)' : 'rgba(255, 255, 255, 0.06)',
                      color: isCurrent ? '#f6821f' : '#bbb',
                      border: isCurrent ? '1px solid #f6821f' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '5px 4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{info.tag}</span>
                    <span style={{ fontSize: '8.5px', opacity: 0.8 }}>{info.name.slice(0, 4)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}
