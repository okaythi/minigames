/**
 * State-of-the-art client-side media and image protection suite.
 *
 * Implements multi-layered protection against image extraction, right-click copying,
 * drag-and-drop extraction, keyboard inspect shortcuts (DevTools, View Source, Save As),
 * selection capture, and unauthorized inspection.
 */

export function initImageProtection(): () => void {
  if (typeof window === 'undefined') return () => {}

  // 1. Context Menu Interception
  const handleContextMenu = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null
    if (!target) return

    // Allow context menu only on explicit text inputs and textareas
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return
    }

    // Always block context menu on images, canvas, game cards, media containers, or body
    e.preventDefault()
    e.stopPropagation()
  }

  // 2. Drag & Drop Interception
  const handleDragStart = (e: DragEvent): void => {
    const target = e.target as HTMLElement | null
    if (!target) return

    if (
      target.tagName === 'IMG' ||
      target.tagName === 'CANVAS' ||
      target.tagName === 'SVG' ||
      target.closest('img, canvas, svg, [data-protected-image], .nx-card-media, .nx-play-stage')
    ) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  // 3. Selection Interception
  const handleSelectStart = (e: Event): void => {
    const target = e.target as HTMLElement | null
    if (!target) return

    if (
      target.tagName === 'IMG' ||
      target.tagName === 'CANVAS' ||
      target.closest('img, canvas, svg, [data-protected-image], .nx-play-left-decorator')
    ) {
      e.preventDefault()
    }
  }

  // 4. Keyboard Shortcut Interception (Inspect Element, DevTools, View Source, Save Page, Print)
  const handleKeyDown = (e: KeyboardEvent): void => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey

    // F12 key (DevTools)
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    // Ctrl+Shift+I / Cmd+Option+I (Inspect)
    // Ctrl+Shift+J / Cmd+Option+J (Console)
    // Ctrl+Shift+C / Cmd+Option+C (Inspect Element selector)
    // Ctrl+Shift+K / Cmd+Option+K (Firefox DevTools)
    // Ctrl+Shift+E / Cmd+Option+E (Network)
    if (
      (ctrlOrCmd && e.shiftKey && (
        e.key === 'I' || e.key === 'i' ||
        e.key === 'J' || e.key === 'j' ||
        e.key === 'C' || e.key === 'c' ||
        e.key === 'K' || e.key === 'k' ||
        e.key === 'E' || e.key === 'e'
      )) ||
      (isMac && e.metaKey && e.altKey && (
        e.key === 'I' || e.key === 'i' ||
        e.key === 'J' || e.key === 'j' ||
        e.key === 'C' || e.key === 'c' ||
        e.key === 'K' || e.key === 'k' ||
        e.key === 'U' || e.key === 'u'
      ))
    ) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    // Ctrl+U / Cmd+U (View Source)
    if (ctrlOrCmd && (e.key === 'U' || e.key === 'u')) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    // Ctrl+S / Cmd+S (Save Webpage / Assets)
    if (ctrlOrCmd && (e.key === 'S' || e.key === 's')) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    // Ctrl+P / Cmd+P (Print Webpage)
    if (ctrlOrCmd && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
  }

  // 5. Copy protection for media elements
  const handleCopy = (e: ClipboardEvent): void => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const anchorNode = selection.anchorNode?.parentElement
    if (anchorNode?.closest('img, canvas, svg, [data-protected-image]')) {
      e.preventDefault()
    }
  }

  // Attach all handlers with capture
  window.addEventListener('contextmenu', handleContextMenu, { capture: true })
  window.addEventListener('dragstart', handleDragStart, { capture: true })
  window.addEventListener('selectstart', handleSelectStart, { capture: true })
  window.addEventListener('keydown', handleKeyDown, { capture: true })
  window.addEventListener('copy', handleCopy, { capture: true })

  return () => {
    window.removeEventListener('contextmenu', handleContextMenu, { capture: true })
    window.removeEventListener('dragstart', handleDragStart, { capture: true })
    window.removeEventListener('selectstart', handleSelectStart, { capture: true })
    window.removeEventListener('keydown', handleKeyDown, { capture: true })
    window.removeEventListener('copy', handleCopy, { capture: true })
  }
}
