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
      // Silently wipe the character image completely when DevTools is opened
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return () => {
        active = false
      }
    }

    const vaultPath = `/assets/vault/nx_q_${stateName}.dat`

    loadEncryptedAsset(vaultPath)
      .then((bitmap) => {
        if (!active || !canvasRef.current) return

        const dpr = Math.min(window.devicePixelRatio || 1, 2)

        canvas.width = bitmap.width * dpr
        canvas.height = bitmap.height * dpr
        canvas.style.width = 'auto'
        canvas.style.height = '100%'

        ctx.save()
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, bitmap.width, bitmap.height)
        ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height)
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
        height: '72%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        data-quantum-shield="active"
        style={{
          display: 'block',
          height: '100%',
          width: 'auto',
          maxWidth: '100%',
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
