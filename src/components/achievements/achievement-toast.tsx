import { useEffect, useState, useRef } from 'react'
import { getAchievementBus, type AchievementUnlockNotification } from '../../lib/achievement-bus'
import './achievement-toast.css'

export function AchievementToast() {
  const [current, setCurrent] = useState<AchievementUnlockNotification | null>(null)
  const [visible, setVisible] = useState(false)
  const queueRef = useRef<AchievementUnlockNotification[]>([])
  const isBusyRef = useRef(false)

  useEffect(() => {
    const bus = getAchievementBus()

    const processNext = () => {
      if (queueRef.current.length === 0) {
        isBusyRef.current = false
        setVisible(false)
        setCurrent(null)
        return
      }

      isBusyRef.current = true
      const next = queueRef.current.shift()!
      setCurrent(next)
      // Slight tick before animating up
      setTimeout(() => {
        setVisible(true)
      }, 50)

      // Keep visible for 5 seconds as requested by user, then slide down
      setTimeout(() => {
        setVisible(false)
        // Wait for slide down transition (450ms) before popping next
        setTimeout(() => {
          processNext()
        }, 500)
      }, 5000)
    }

    const unsubscribe = bus.onUnlock((notification) => {
      queueRef.current.push(notification)
      if (!isBusyRef.current) {
        processNext()
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  if (!current) {
    return null
  }

  return (
    <div className="nx-achievement-toast-container" aria-live="polite" role="status">
      <div className="nx-achievement-toast-pill" data-visible={visible ? 'true' : 'false'}>
        <div className="nx-achievement-toast-icon-wrap" aria-hidden="true">
          {current.icon}
        </div>
        <div className="nx-achievement-toast-body">
          <div className="nx-achievement-toast-tag">
            <span>✨</span>
            <span>Achievement Unlocked</span>
          </div>
          <div className="nx-achievement-toast-title">{current.name}</div>
          <div className="nx-achievement-toast-desc">{current.description}</div>
        </div>
        <div className="nx-achievement-toast-badge" aria-hidden="true">
          ✓
        </div>
      </div>
    </div>
  )
}
