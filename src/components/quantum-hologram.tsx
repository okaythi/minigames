import { useEffect, useRef, useState } from 'react'
import { loadEncryptedAsset, subscribeDevTools } from '../lib/quantum-decryptor'

interface QuantumHologramProps {
  readonly stateName: 'determined' | 'mad' | 'sad' | 'smug'
}

export function QuantumHologram({ stateName }: QuantumHologramProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isGlitching, setIsGlitching] = useState(false)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    return subscribeDevTools((isOpen) => {
      setIsGlitching(isOpen)
    })
  }, [])

  useEffect(() => {
    let active = true
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    if (!ctx) return

    // Taint canvas methods against console data scraping
    try {
      canvas.toDataURL = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
      canvas.toBlob = (cb) => {
        if (cb) cb(new Blob([], { type: 'image/png' }))
      }
    } catch {
      // Ignore if sealed
    }

    if (isGlitching) {
      // Active Glitch Matrix when DevTools is opened
      let frame = 0
      const renderGlitch = () => {
        if (!active) return
        frame++
        const w = canvas.width
        const h = canvas.height
        ctx.clearRect(0, 0, w, h)

        // Draw animated noise and glitch scanlines
        ctx.fillStyle = 'rgba(255, 60, 0, 0.15)'
        ctx.fillRect(0, 0, w, h)

        ctx.fillStyle = 'rgba(255, 120, 0, 0.4)'
        for (let y = 0; y < h; y += 8) {
          if (Math.random() > 0.4) {
            ctx.fillRect(0, y, w, 3)
          }
        }

        ctx.fillStyle = '#ff3c00'
        ctx.font = 'bold 12px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('⚠ DEVTOOLS DETECTED', w / 2, h / 2 - 15)
        ctx.fillStyle = '#ffaa00'
        ctx.font = '10px monospace'
        ctx.fillText('[QUANTUM SHIELD ACTIVE]', w / 2, h / 2 + 5)
        ctx.fillText('[ASSET VAULT LOCKED]', w / 2, h / 2 + 22)

        animFrameRef.current = requestAnimationFrame(renderGlitch)
      }
      renderGlitch()
      return () => {
        active = false
        if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current)
      }
    }

    const vaultPath = `/assets/vault/nx_q_${stateName}.dat`

    loadEncryptedAsset(vaultPath)
      .then((bitmap) => {
        if (!active || !canvasRef.current) return

        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const displayWidth = 220
        const displayHeight = (displayWidth * bitmap.height) / bitmap.width

        canvas.width = displayWidth * dpr
        canvas.height = displayHeight * dpr
        canvas.style.width = '100%'
        canvas.style.height = 'auto'

        ctx.save()
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, displayWidth, displayHeight)
        ctx.drawImage(bitmap, 0, 0, displayWidth, displayHeight)
        ctx.restore()
      })
      .catch((err) => {
        console.error('Failed to materialize encrypted hologram:', err)
      })

    return () => {
      active = false
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current)
    }
  }, [stateName, isGlitching])

  return (
    <div
      className="nx-quantum-shield-container"
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: '100%',
        maxHeight: '60%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        data-quantum-shield="active"
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          maxHeight: '100%',
          objectFit: 'contain',
          objectPosition: 'bottom right',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
      {/* Invisible decoy shield layer in front of the canvas */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          background: 'transparent',
          pointerEvents: 'auto',
          cursor: 'default',
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDragStart={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      />
    </div>
  )
}
