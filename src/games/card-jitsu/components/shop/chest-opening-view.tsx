import { useEffect, useRef, useState } from 'react'
import type { DrawnCard } from '../../../../../shared/card-jitsu-shop-protocol'
import { DOJO_STORE_CONFIG } from '../../store.config'
import { CardDisplay } from './card-display'
import { playCardFlip, playChestOpen, playPowerReveal } from './shop-audio'

interface ChestOpeningViewProps {
  readonly cards: readonly DrawnCard[]
  readonly onFinish: () => void
  readonly onOpenAnother?: () => void
  readonly canOpenAnother?: boolean
}

type Phase = 'ready' | 'opening' | 'revealing' | 'complete'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  life: number
  maxLife: number
}

export function ChestOpeningView({
  cards,
  onFinish,
  onOpenAnother,
  canOpenAnother = false,
}: ChestOpeningViewProps) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [flippedCount, setFlippedCount] = useState<number>(0)
  const [powerRevealed, setPowerRevealed] = useState<boolean>(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<Particle[]>([])

  // Emit burst particles when chest opens
  const triggerBurst = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const count = DOJO_STORE_CONFIG.animation.burstParticleCount
    const palette = ['#ffd700', '#f6821f', '#fbad41', '#e53e3e', '#3182ce', '#ffffff']

    const newParticles: Particle[] = []
    const cx = canvas.width / 2
    const cy = canvas.height / 2

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 8
      const maxLife = 30 + Math.floor(Math.random() * 30)
      newParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 3 + Math.random() * 5,
        color: palette[Math.floor(Math.random() * palette.length)] ?? '#ffd700',
        alpha: 1,
        life: 0,
        maxLife,
      })
    }
    particlesRef.current = newParticles
  }

  // Particle animation loop
  useEffect(() => {
    let animId: number
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const particles = particlesRef.current

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        if (!p) continue
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.15 // Gravity
        p.life++
        p.alpha = Math.max(0, 1 - p.life / p.maxLife)

        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        if (p.life >= p.maxLife) {
          particles.splice(i, 1)
        }
      }

      if (particles.length > 0 || phase === 'opening') {
        animId = requestAnimationFrame(loop)
      }
    }

    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [phase])

  // Handle chest click to unlatch and open
  const handleChestClick = () => {
    if (phase !== 'ready') return
    setPhase('opening')
    if (DOJO_STORE_CONFIG.animation.enableWebAudio) {
      playChestOpen()
    }
    triggerBurst()

    // Transition to card reveals
    setTimeout(() => {
      setPhase('revealing')
    }, DOJO_STORE_CONFIG.animation.chestWobbleDurationMs)
  }

  // Sequence the card flips
  useEffect(() => {
    if (phase !== 'revealing') return

    let current = 0
    const flipInterval = setInterval(() => {
      current++
      if (current <= 9) {
        setFlippedCount(current)
        if (DOJO_STORE_CONFIG.animation.enableWebAudio) {
          playCardFlip()
        }
      } else {
        clearInterval(flipInterval)

        // Dramatic suspense before the 10th card (the Power Card)
        setTimeout(() => {
          setFlippedCount(10)
          setPowerRevealed(true)
          if (DOJO_STORE_CONFIG.animation.enableWebAudio) {
            playPowerReveal()
          }

          // Complete sequence
          setTimeout(() => {
            setPhase('complete')
          }, 800)
        }, DOJO_STORE_CONFIG.animation.powerCardSuspenseMs)
      }
    }, DOJO_STORE_CONFIG.animation.normalCardFlipIntervalMs)

    return () => clearInterval(flipInterval)
  }, [phase])

  return (
    <div className={`dojo-chest-stage ${phase}`} data-protected-image="true">
      {/* Particle Canvas Overlay */}
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        className="dojo-chest-canvas"
        data-protected-image="true"
      />

      {/* Chest View (Before revealing cards) */}
      {(phase === 'ready' || phase === 'opening') && (
        <div className="dojo-chest-centerpiece" onClick={handleChestClick}>
          <div className={`dojo-chest-model ${phase === 'opening' ? 'is-opening' : 'is-idle'}`}>
            <div className="dojo-chest-lid">
              <div className="dojo-chest-lock">
                <svg className="dojo-chest-lock-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                </svg>
              </div>
            </div>
            <div className="dojo-chest-base">
              <div className="dojo-chest-emblem">
                <svg className="dojo-chest-emblem-svg" viewBox="0 0 40 40" width="36" height="36" fill="none">
                  <circle cx="20" cy="20" r="18" stroke="#ffd700" strokeWidth="2.5" />
                  <circle cx="20" cy="11" r="5" fill="#e53e3e" />
                  <circle cx="12" cy="26" r="5" fill="#3182ce" />
                  <circle cx="28" cy="26" r="5" fill="#00a3c4" />
                  <circle cx="20" cy="20" r="3" fill="#ffd700" />
                </svg>
              </div>
            </div>
            <div className="dojo-chest-glow" />
          </div>
          <div className="dojo-chest-prompt">
            {phase === 'ready' ? (
              <>
                <div className="dojo-chest-prompt-main">Click the Chest to Open!</div>
                <div className="dojo-chest-prompt-sub">10 Cards Awaiting Inside</div>
              </>
            ) : (
              <div className="dojo-chest-prompt-opening">Unlocking Dojo Secrets...</div>
            )}
          </div>
        </div>
      )}

      {/* Card Reveal Grid (During & after reveals) */}
      {(phase === 'revealing' || phase === 'complete') && (
        <div className="dojo-cards-reveal-container">
          <div className="dojo-cards-reveal-header">
            <h3 className="dojo-reveal-title">
              {phase === 'complete' ? 'Pack Opened!' : 'Revealing Cards...'}
            </h3>
            {powerRevealed && (
              <span className="dojo-power-alert">GUARANTEED POWER CARD UNLOCKED!</span>
            )}
          </div>

          <div className="dojo-cards-grid-5x2">
            {cards.map((c, index) => {
              const isFlipped = index < flippedCount
              const isPower = index === 9
              return (
                <div
                  key={c.id}
                  className={`dojo-card-slot ${isPower ? 'power-slot' : ''} ${isPower && powerRevealed ? 'power-burst' : ''}`}
                >
                  <CardDisplay
                    card={c}
                    quantity={c.totalOwned}
                    isNew={c.isNew}
                    isFlipped={isFlipped}
                    size="sm"
                    showDetails={phase === 'complete'}
                  />
                </div>
              )
            })}
          </div>

          {phase === 'complete' && (
            <div className="dojo-reveal-actions">
              {canOpenAnother && onOpenAnother && (
                <button
                  type="button"
                  className="nx-btn nx-btn-primary dojo-btn-another"
                  onClick={onOpenAnother}
                >
                  Open Another Pack ({DOJO_STORE_CONFIG.pack.price} Candy)
                </button>
              )}
              <button
                type="button"
                className="nx-btn nx-btn-secondary dojo-btn-done"
                onClick={onFinish}
              >
                Back to Dojo Store
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
