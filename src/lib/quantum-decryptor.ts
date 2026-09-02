/**
 * Quantum Holographic Decryptor & Anti-Tamper Engine
 *
 * Slices, decrypts, and renders in-memory encrypted assets directly onto sandboxed canvas
 * with zero <img> tags, zero readable URLs in the DOM, and active DevTools detection.
 */

const CIPHER_KEY = new TextEncoder().encode('NIXLABS_QUANTUM_CIPHER_2026_PARANOID_KEY_V9_XOR_OBFUSCATE!')

const bitmapCache = new Map<string, Promise<ImageBitmap>>()

export function decryptBuffer(encrypted: Uint8Array): Uint8Array {
  const decrypted = new Uint8Array(encrypted.length)
  const keyLen = CIPHER_KEY.length
  for (let i = 0; i < encrypted.length; i++) {
    const keyByte = CIPHER_KEY[i % keyLen]!
    const unxor = encrypted[i]! ^ keyByte ^ ((i * 37) & 0xff)
    const original = ((unxor >>> 3) | (unxor << 5)) & 0xff
    decrypted[i] = original
  }
  return decrypted
}

export async function loadEncryptedAsset(vaultPath: string): Promise<ImageBitmap> {
  const cached = bitmapCache.get(vaultPath)
  if (cached) return cached

  const promise = (async () => {
    const res = await fetch(vaultPath)
    if (!res.ok) throw new Error(`Vault load failed: ${res.status}`)
    const encryptedBuf = await res.arrayBuffer()
    const encryptedBytes = new Uint8Array(encryptedBuf)
    const decryptedBytes = decryptBuffer(encryptedBytes)
    const blob = new Blob([decryptedBytes.buffer as ArrayBuffer], { type: 'image/png' })
    const bitmap = await createImageBitmap(blob)
    return bitmap
  })()

  bitmapCache.set(vaultPath, promise)
  return promise
}

/**
 * DevTools Open Detector for paranoid glitch shielding
 */
type DevToolsListener = (isOpen: boolean) => void
const listeners = new Set<DevToolsListener>()
let devtoolsOpen = false

if (typeof window !== 'undefined') {
  let isChecking = false

  const checkDevTools = () => {
    if (isChecking) return
    isChecking = true

    const widthThreshold = window.outerWidth - window.innerWidth > 160
    const heightThreshold = window.outerHeight - window.innerHeight > 160
    const win = window as unknown as { Firebug?: { chrome?: { isInitialized?: boolean } } }
    const orientationMatch = Boolean(win.Firebug?.chrome?.isInitialized)

    const isOpen = Boolean(widthThreshold || heightThreshold || orientationMatch)

    if (isOpen !== devtoolsOpen) {
      devtoolsOpen = isOpen
      for (const listener of listeners) {
        listener(devtoolsOpen)
      }
    }
    isChecking = false
  }

  window.addEventListener('resize', checkDevTools)
  setInterval(checkDevTools, 400)
}

export function subscribeDevTools(listener: DevToolsListener): () => void {
  listeners.add(listener)
  listener(devtoolsOpen)
  return () => {
    listeners.delete(listener)
  }
}
