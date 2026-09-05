import { useCallback, useEffect, useRef, useState } from 'react'
import type { DrawnCard } from '../../../../../shared/card-jitsu-shop-protocol'
import { DOJO_STORE_CONFIG } from '../../store.config'
import { CardDisplay } from './card-display'
import {
  playBam,
  playCardFlip,
  playCardLaunch,
  playChestOpen,
  playPowerReveal,
} from './shop-audio'
import './chest-opening-view.css'

interface ChestOpeningViewProps {
  readonly cards: readonly DrawnCard[]
  /** Live pack price (post-first-purchase) for the "open another" CTA. */
  readonly packPrice: number
  readonly onFinish: () => void
  readonly onOpenAnother?: () => void
  readonly canOpenAnother?: boolean
}

type Phase = 'ready' | 'opening' | 'launching' | 'complete'

interface Flight {
  readonly key: string
  readonly index: number
  readonly card: DrawnCard
  readonly fromX: number
  readonly fromY: number
  readonly toX: number
  readonly toY: number
  readonly duration: number
  readonly power: boolean
}

/* ------------------------------------------------------------------ */
/* Particle engine — sparks, embers, comet trails, rings & confetti.  */
/* ------------------------------------------------------------------ */

type ParticleKind = 'spark' | 'ember' | 'trail' | 'ring' | 'confetti'

interface Particle {
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  life: number
  maxLife: number
  gravity: number
  drag: number
  spin: number
  angle: number
}

const GOLD_PALETTE = ['#ffe9a3', '#ffd166', '#ffb347', '#f6821f', '#fff6d8']
const POWER_PALETTE = ['#ffe9a3', '#a5f3fc', '#f0abfc', '#ffd166', '#ffffff', '#86efac']

class ParticleEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private particles: Particle[] = []
  private raf = 0
  private last = 0
  private w = 0
  private h = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    this.ctx = ctx
    this.resize()
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = this.canvas.getBoundingClientRect()
    this.w = rect.width
    this.h = rect.height
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr))
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr))
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  start(): void {
    this.stop()
    this.last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(48, now - this.last)
      this.last = now
      this.step(dt / 16.667)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
  }

  clear(): void {
    this.particles = []
    this.ctx.clearRect(0, 0, this.w, this.h)
  }

  private spawn(p: Particle): void {
    if (this.particles.length > 1400) return
    this.particles.push(p)
  }

  /** Firework explosion of glowing sparks. */
  burst(x: number, y: number, count: number, palette: readonly string[] = GOLD_PALETTE, power = 1): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = (1.5 + Math.random() * 6.5) * power
      this.spawn({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2 * power,
        size: 1.6 + Math.random() * 3.2 * power,
        color: palette[Math.floor(Math.random() * palette.length)] ?? '#ffd166',
        life: 0,
        maxLife: 34 + Math.random() * 34,
        gravity: 0.14,
        drag: 0.985,
        spin: 0,
        angle: 0,
      })
    }
    // A few slow-falling embers for afterglow.
    for (let i = 0; i < Math.floor(count / 4); i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.6 + Math.random() * 2.2
      this.spawn({
        kind: 'ember',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,
        size: 1.4 + Math.random() * 2.4,
        color: palette[Math.floor(Math.random() * palette.length)] ?? '#f6821f',
        life: 0,
        maxLife: 60 + Math.random() * 50,
        gravity: 0.045,
        drag: 0.99,
        spin: 0,
        angle: 0,
      })
    }
  }

  /** Expanding shockwave ring. */
  ring(x: number, y: number, color = '#ffd166', maxRadius = 130): void {
    this.spawn({
      kind: 'ring',
      x,
      y,
      vx: maxRadius,
      vy: 0,
      size: 3,
      color,
      life: 0,
      maxLife: 26,
      gravity: 0,
      drag: 1,
      spin: 0,
      angle: 0,
    })
  }

  /** Comet trail puff emitted along a card's flight path. */
  trail(x: number, y: number, color: string, power = false): void {
    this.spawn({
      kind: 'trail',
      x: x + (Math.random() - 0.5) * 14,
      y: y + (Math.random() - 0.5) * 14,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8 + 0.4,
      size: (power ? 4 : 2.4) + Math.random() * 3,
      color,
      life: 0,
      maxLife: power ? 30 : 20,
      gravity: 0.02,
      drag: 0.97,
      spin: 0,
      angle: 0,
    })
    if (power && Math.random() < 0.6) {
      this.spawn({
        kind: 'spark',
        x,
        y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        size: 1.4 + Math.random() * 2,
        color: POWER_PALETTE[Math.floor(Math.random() * POWER_PALETTE.length)] ?? '#ffd166',
        life: 0,
        maxLife: 22,
        gravity: 0.08,
        drag: 0.98,
        spin: 0,
        angle: 0,
      })
    }
  }

  /** Golden dust wafting up from the open chest. */
  ambient(x: number, y: number): void {
    this.spawn({
      kind: 'ember',
      x: x + (Math.random() - 0.5) * 120,
      y: y + (Math.random() - 0.5) * 18,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -(0.25 + Math.random() * 0.55),
      size: 1 + Math.random() * 2,
      color: GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)] ?? '#ffd166',
      life: 0,
      maxLife: 80 + Math.random() * 60,
      gravity: -0.002,
      drag: 0.995,
      spin: 0,
      angle: 0,
    })
  }

  /** Celebration confetti dropped from above. */
  confettiDrop(width: number): void {
    for (let i = 0; i < 5; i++) {
      this.spawn({
        kind: 'confetti',
        x: Math.random() * width,
        y: -10,
        vx: (Math.random() - 0.5) * 1.6,
        vy: 1 + Math.random() * 1.8,
        size: 3 + Math.random() * 4,
        color: POWER_PALETTE[Math.floor(Math.random() * POWER_PALETTE.length)] ?? '#ffd166',
        life: 0,
        maxLife: 140,
        gravity: 0.02,
        drag: 0.995,
        spin: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI,
      })
    }
  }

  private step(dt: number): void {
    const { ctx } = this
    ctx.clearRect(0, 0, this.w, this.h)
    ctx.globalCompositeOperation = 'lighter'
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      if (!p) continue
      p.life += dt
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1)
        continue
      }
      const t = p.life / p.maxLife
      if (p.kind === 'ring') {
        const r = (p.vx * t) * (2 - t) // ease-out expansion
        ctx.save()
        ctx.globalAlpha = Math.max(0, 1 - t) * 0.9
        ctx.strokeStyle = p.color
        ctx.lineWidth = Math.max(0.5, p.size * (1 - t))
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
        continue
      }
      p.vx *= p.drag ** dt
      p.vy = p.vy * p.drag ** dt + p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.angle += p.spin * dt

      ctx.save()
      if (p.kind === 'confetti') {
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = Math.max(0, 1 - t * t)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      } else {
        const fade = p.kind === 'trail' ? Math.max(0, 1 - t) * 0.75 : Math.max(0, 1 - t)
        ctx.globalAlpha = fade
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(0.4, p.size * (p.kind === 'trail' ? 1 - t * 0.6 : 1 - t * 0.35)), 0, Math.PI * 2)
        ctx.fill()
        if (p.kind === 'spark' && p.size > 2.6) {
          ctx.globalAlpha = fade * 0.35
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 1.9, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}

/* ------------------------------------------------------------------ */
/* Slot card — mounts face-down then flips to reveal on landing.      */
/* ------------------------------------------------------------------ */

function SlotCard({ card, quantity, isNew }: { card: DrawnCard; quantity: number; isNew: boolean }) {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setFlipped(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <CardDisplay
      card={card}
      quantity={quantity}
      isNew={isNew}
      isFlipped={flipped}
      size="sm"
    />
  )
}

/* ------------------------------------------------------------------ */
/* Flying card — Web Animations arc from the chest to its slot.       */
/* ------------------------------------------------------------------ */

interface FlyingCardProps {
  readonly flight: Flight
  readonly reducedMotion: boolean
  readonly onTrail: (x: number, y: number, power: boolean) => void
  readonly onLand: (flight: Flight) => void
}

function FlyingCard({ flight, reducedMotion, onTrail, onLand }: FlyingCardProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const landedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const finish = () => {
      if (landedRef.current) return
      landedRef.current = true
      onLand(flight)
    }

    if (reducedMotion) {
      finish()
      return
    }

    // Arc: rise out of the chest, curve sideways, slam into the slot.
    const { fromX, fromY, toX, toY, index, power } = flight
    const midX = (fromX + toX) / 2 + (index % 2 === 0 ? -1 : 1) * (28 + (index * 7) % 36) * (power ? 1.6 : 1)
    const apex = Math.max(70, Math.abs(toY - fromY) * 0.45 + (power ? 130 : 46))
    const midY = Math.min(fromY, toY) - apex

    const animation = el.animate(
      [
        {
          transform: `translate(${fromX}px, ${fromY}px) rotate(${power ? 0 : -14}deg) scale(${power ? 0.5 : 0.4})`,
          easing: 'cubic-bezier(0.16, 0.84, 0.44, 1)',
        },
        {
          transform: `translate(${midX}px, ${midY}px) rotate(${power ? 200 : 12}deg) scale(${power ? 0.95 : 0.78})`,
          offset: 0.52,
          easing: 'cubic-bezier(0.5, 0, 0.75, 0.6)',
        },
        {
          transform: `translate(${toX}px, ${toY}px) rotate(${power ? 360 : 0}deg) scale(1)`,
        },
      ],
      { duration: flight.duration, fill: 'forwards' },
    )

    // Comet trail: sample the live position each frame.
    let raf = 0
    let running = true
    const tick = () => {
      if (!running) return
      if (el.isConnected) {
        const rect = el.getBoundingClientRect()
        onTrail(rect.left + rect.width / 2, rect.top + rect.height / 2, power)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    animation.onfinish = () => {
      running = false
      cancelAnimationFrame(raf)
      finish()
    }

    return () => {
      running = false
      cancelAnimationFrame(raf)
      animation.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={ref} className={`dojo-card-flight ${flight.power ? 'is-power-flight' : ''}`} aria-hidden="true">
      <CardDisplay card={flight.card} isFlipped={false} size="sm" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Chest opening ceremony                                             */
/* ------------------------------------------------------------------ */

export function ChestOpeningView({
  cards,
  packPrice,
  onFinish,
  onOpenAnother,
  canOpenAnother = false,
}: ChestOpeningViewProps) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [lidOpen, setLidOpen] = useState(false)
  const [powerFlare, setPowerFlare] = useState(false)
  const [landedCount, setLandedCount] = useState(0)
  const [flights, setFlights] = useState<readonly Flight[]>([])
  const [stageFlashKey, setStageFlashKey] = useState(0)
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  const stageRef = useRef<HTMLDivElement | null>(null)
  const chestRef = useRef<HTMLButtonElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<ParticleEngine | null>(null)
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])
  const timersRef = useRef<number[]>([])

  const anim = DOJO_STORE_CONFIG.animation
  const powerIndex = cards.length - 1
  const powerRevealed = landedCount >= cards.length

  /* Canvas lifecycle */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let engine: ParticleEngine | null = null
    try {
      engine = new ParticleEngine(canvas)
    } catch {
      return
    }
    engineRef.current = engine
    engine.start()
    const ro = new ResizeObserver(() => engine?.resize())
    ro.observe(canvas)
    return () => {
      ro.disconnect()
      engine?.stop()
      engineRef.current = null
    }
  }, [])

  const stageCenterOf = useCallback((el: HTMLElement | null, fallback: { x: number; y: number }) => {
    const stage = stageRef.current
    if (!el || !stage) return fallback
    const s = stage.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 }
  }, [])

  const burstAt = useCallback(
    (el: HTMLElement | null, count: number, palette?: readonly string[], power = 1) => {
      const engine = engineRef.current
      if (!engine) return
      const { x, y } = stageCenterOf(el, { x: 0, y: 0 })
      engine.burst(x, y, count, palette, power)
    },
    [stageCenterOf],
  )

  /* Ambient golden dust while the chest is the star of the show. */
  useEffect(() => {
    if (phase === 'complete') return
    const id = window.setInterval(() => {
      const engine = engineRef.current
      const chest = chestRef.current
      if (!engine || !chest || phase === 'ready') return
      const { x, y } = stageCenterOf(chest, { x: 0, y: 0 })
      engine.ambient(x, y - 10)
    }, 90)
    return () => window.clearInterval(id)
  }, [phase, stageCenterOf])

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) window.clearTimeout(t)
    timersRef.current = []
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  /* Chest click -> break the seal */
  const handleChestClick = useCallback(() => {
    if (phase !== 'ready') return
    setPhase('opening')
    if (anim.enableWebAudio) playChestOpen()

    const chest = chestRef.current

    // Rumble sparks during the wobble.
    for (let i = 0; i < 4; i++) {
      timersRef.current.push(
        window.setTimeout(() => burstAt(chest, 6), (anim.chestWobbleDurationMs / 4) * i),
      )
    }

    timersRef.current.push(
      window.setTimeout(() => {
        setLidOpen(true)
        const stage = stageRef.current
        if (stage) stage.classList.add('is-quaking')
        window.setTimeout(() => stage?.classList.remove('is-quaking'), 520)
        if (chest && engineRef.current) {
          const { x, y } = stageCenterOf(chest, { x: 0, y: 0 })
          engineRef.current.burst(x, y - 30, anim.burstParticleCount, GOLD_PALETTE, 1.35)
          engineRef.current.ring(x, y - 30, '#ffd166', 190)
          engineRef.current.ring(x, y - 30, '#fff6d8', 120)
        }
        setStageFlashKey((k) => k + 1)
      }, anim.chestWobbleDurationMs),
    )

    timersRef.current.push(
      window.setTimeout(() => setPhase('launching'), anim.chestWobbleDurationMs + anim.chestLidOpenDurationMs),
    )
  }, [phase, anim, burstAt, stageCenterOf])

  /* Launch sequence: BAM BAM BAM ... then the power card finale. */
  const startFlight = useCallback(
    (index: number, power: boolean) => {
      const chest = chestRef.current
      const stage = stageRef.current
      const slot = slotRefs.current[index]
      const card = cards[index]
      if (!chest || !stage || !slot || !card) return
      requestAnimationFrame(() => {
        const from = stageCenterOf(chest, { x: 0, y: 0 })
        const to = stageCenterOf(slot, from)
        setFlights((prev) => [
          ...prev,
          {
            key: `flight-${index}-${Date.now()}`,
            index,
            card,
            fromX: from.x,
            fromY: from.y - 26,
            toX: to.x,
            toY: to.y,
            duration: reducedMotion ? 1 : power ? anim.powerCardFlightMs : anim.cardFlightMs,
            power,
          },
        ])
        if (anim.enableWebAudio) playCardLaunch()
      })
    },
    [anim, cards, reducedMotion, stageCenterOf],
  )

  const handleLand = useCallback(
    (flight: Flight) => {
      setFlights((prev) => prev.filter((f) => f.key !== flight.key))
      setLandedCount((count) => Math.max(count, flight.index + 1))
      const slot = slotRefs.current[flight.index]
      const engine = engineRef.current
      if (slot && engine) {
        const { x, y } = stageCenterOf(slot, { x: 0, y: 0 })
        if (flight.power) {
          engine.burst(x, y, Math.round(anim.burstParticleCount * 0.8), POWER_PALETTE, 1.5)
          engine.ring(x, y, '#fff6d8', 220)
          engine.ring(x, y, '#f0abfc', 150)
          setStageFlashKey((k) => k + 1)
          const stage = stageRef.current
          if (stage) {
            stage.classList.add('is-quaking')
            window.setTimeout(() => stage.classList.remove('is-quaking'), 560)
          }
          if (anim.enableWebAudio) playPowerReveal()
        } else {
          engine.burst(x, y, 16, GOLD_PALETTE, 0.8)
          engine.ring(x, y, '#ffd166', 74)
          if (anim.enableWebAudio) {
            playBam(1 + flight.index * 0.02)
            playCardFlip()
          }
        }
      }
    },
    [anim, stageCenterOf],
  )

  useEffect(() => {
    if (phase !== 'launching') return

    const stagger = reducedMotion ? 60 : anim.normalCardFlipIntervalMs
    const flightMs = reducedMotion ? 1 : anim.cardFlightMs
    const normals = cards.filter((_, i) => i !== powerIndex).length

    for (let i = 0; i < powerIndex; i++) {
      timersRef.current.push(window.setTimeout(() => startFlight(i, false), i * stagger))
    }

    const powerAt =
      normals * stagger + flightMs + (reducedMotion ? 120 : anim.powerCardSuspenseMs)
    timersRef.current.push(
      window.setTimeout(() => {
        setPowerFlare(true)
        const chest = chestRef.current
        if (chest && engineRef.current) {
          const { x, y } = stageCenterOf(chest, { x: 0, y: 0 })
          engineRef.current.burst(x, y - 26, Math.round(anim.burstParticleCount * 0.66), POWER_PALETTE, 1.4)
          engineRef.current.ring(x, y - 26, '#f0abfc', 170)
        }
        if (anim.enableWebAudio) playChestOpen()
        timersRef.current.push(
          window.setTimeout(() => startFlight(powerIndex, true), reducedMotion ? 40 : 340),
        )
      }, powerAt),
    )

    const finaleAt =
      powerAt +
      (reducedMotion ? 80 : 340 + anim.powerCardFlightMs) +
      (reducedMotion ? 200 : 1100)
    timersRef.current.push(window.setTimeout(() => setPhase('complete'), finaleAt))

    return clearTimers
  }, [phase, anim, cards, powerIndex, reducedMotion, startFlight, stageCenterOf, clearTimers])

  /* Celebration drizzle on completion. */
  useEffect(() => {
    if (phase !== 'complete') return
    const engine = engineRef.current
    if (!engine) return
    let drops = 0
    const id = window.setInterval(() => {
      engine.confettiDrop(stageRef.current?.clientWidth ?? 600)
      if (++drops > 26) window.clearInterval(id)
    }, 120)
    return () => window.clearInterval(id)
  }, [phase])

  const revealGridVisible = phase === 'launching' || phase === 'complete'
  const chestInteractive = phase === 'ready'

  return (
    <div className={`dojo-chest-stage phase-${phase}`} data-protected-image="true" ref={stageRef}>
      <canvas ref={canvasRef} className="dojo-chest-canvas" data-protected-image="true" />
      {stageFlashKey > 0 && <div key={stageFlashKey} className="dojo-chest-stage-flash" aria-hidden="true" />}

      {/* The Dojo Vault */}
      <div className={`dojo-chest-scene ${lidOpen ? 'is-open' : ''} ${powerFlare ? 'is-flaring' : ''}`}>
        <div className="dojo-chest-aura" aria-hidden="true" />
        <div className="dojo-chest-beam" aria-hidden="true" />
        <div className="dojo-chest-ground-glow" aria-hidden="true" />
        <button
          type="button"
          ref={chestRef}
          className={`dojo-chest ${phase === 'ready' ? 'is-idle' : ''} ${
            phase === 'opening' && !lidOpen ? 'is-shaking' : ''
          } ${lidOpen ? 'lid-open' : ''}`}
          onClick={handleChestClick}
          disabled={!chestInteractive}
          aria-label={chestInteractive ? 'Open the Dojo Vault' : 'Dojo Vault opening'}
          data-protected-image="true"
        >
          <span className="chest-lid" aria-hidden="true">
            <span className="chest-lid-face">
              <span className="chest-gold-rib rib-left" />
              <span className="chest-gold-rib rib-center" />
              <span className="chest-gold-rib rib-right" />
              <span className="chest-rivet r1" />
              <span className="chest-rivet r2" />
              <span className="chest-rivet r3" />
              <span className="chest-rivet r4" />
              <span className="chest-lid-shine" />
            </span>
            <span className="chest-lid-inner" />
          </span>
          <span className="chest-body" aria-hidden="true">
            <span className="chest-interior">
              <span className="chest-interior-glow" />
            </span>
            <span className="chest-iron-band band-top" />
            <span className="chest-iron-band band-bottom" />
            <span className="chest-corner c-tl" />
            <span className="chest-corner c-tr" />
            <span className="chest-corner c-bl" />
            <span className="chest-corner c-br" />
            <span className="chest-front-plate">
              <span className="chest-lock-plate">
                <svg className="chest-emblem-svg" viewBox="0 0 44 44" width="44" height="44" fill="none">
                  <circle cx="22" cy="22" r="20" stroke="url(#chestGoldRing)" strokeWidth="2.6" />
                  <circle cx="22" cy="12" r="4.6" fill="#e5484d" />
                  <circle cx="13" cy="28" r="4.6" fill="#3aa6dd" />
                  <circle cx="31" cy="28" r="4.6" fill="#37c6cf" />
                  <circle cx="22" cy="22" r="2.8" fill="#ffd166" />
                  <defs>
                    <linearGradient id="chestGoldRing" x1="0" y1="0" x2="44" y2="44">
                      <stop offset="0" stopColor="#ffe9a3" />
                      <stop offset="0.5" stopColor="#d4a643" />
                      <stop offset="1" stopColor="#8c6a24" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="chest-keyhole" />
              </span>
            </span>
            <span className="chest-wood-plank p1" />
            <span className="chest-wood-plank p2" />
          </span>
        </button>
        <div className="dojo-chest-prompt">
          {phase === 'ready' && (
            <>
              <div className="dojo-chest-prompt-main">Break the Seal</div>
              <div className="dojo-chest-prompt-sub">10 Cards Locked Within the Dojo Vault</div>
            </>
          )}
          {phase === 'opening' && <div className="dojo-chest-prompt-opening">The Dojo Vault awakens&hellip;</div>}
          {phase === 'launching' && <div className="dojo-chest-prompt-opening">Cards Revealed&hellip;</div>}
        </div>
      </div>

      {/* Reveal grid */}
      {revealGridVisible && (
        <div className={`dojo-cards-reveal-container ${powerFlare ? 'spotlight-power' : ''}`}>
          <div className="dojo-cards-reveal-header">
            <h3 className="dojo-reveal-title">{phase === 'complete' ? 'Pack Opened!' : 'Revealing Cards'}</h3>
            {powerRevealed && <span className="dojo-power-alert">GUARANTEED POWER CARD UNLOCKED!</span>}
          </div>

          <div className="dojo-cards-grid-5x2">
            {cards.map((c, index) => {
              const landed = index < landedCount
              const isPower = index === powerIndex
              return (
                <div
                  key={c.id}
                  ref={(el) => {
                    slotRefs.current[index] = el
                  }}
                  className={`dojo-card-slot ${isPower ? 'power-slot' : ''} ${
                    isPower && powerRevealed ? 'power-burst' : ''
                  } ${landed ? 'landed' : 'empty'}`}
                >
                  {landed ? (
                    <SlotCard card={c} quantity={c.totalOwned} isNew={c.isNew} />
                  ) : (
                    <span className="dojo-slot-socket" aria-hidden="true">
                      <span className="socket-rune">{isPower ? '★' : '◆'}</span>
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {phase === 'complete' && (
            <div className="dojo-reveal-actions">
              {canOpenAnother && onOpenAnother && (
                <button type="button" className="nx-btn nx-btn-primary dojo-btn-another" onClick={onOpenAnother}>
                  Open Another Pack ({packPrice} Candy)
                </button>
              )}
              <button type="button" className="nx-btn nx-btn-secondary dojo-btn-done" onClick={onFinish}>
                Back to Dojo Store
              </button>
            </div>
          )}
        </div>
      )}

      {/* In-flight cards overlay */}
      <div className="dojo-flights-layer" aria-hidden="true">
        {flights.map((flight) => (
          <FlyingCard
            key={flight.key}
            flight={flight}
            reducedMotion={reducedMotion}
            onTrail={(x, y, power) => {
              const engine = engineRef.current
              const stage = stageRef.current
              if (!engine || !stage) return
              // FlyingCard reports viewport coordinates; convert to the
              // stage-local space the particle canvas draws in.
              const s = stage.getBoundingClientRect()
              engine.trail(x - s.left, y - s.top, power ? '#ffe9a3' : '#ffd166', power)
            }}
            onLand={handleLand}
          />
        ))}
      </div>
    </div>
  )
}
