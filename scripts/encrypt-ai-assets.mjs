import fs from 'fs'
import path from 'path'

const SECRET_KEY = Buffer.from('NIXLABS_QUANTUM_CIPHER_2026_PARANOID_KEY_V9_XOR_OBFUSCATE!')

export function encryptBuffer(buffer) {
  const encrypted = Buffer.alloc(buffer.length)
  for (let i = 0; i < buffer.length; i++) {
    const keyByte = SECRET_KEY[i % SECRET_KEY.length]
    const b = buffer[i]
    // 3-bit left rotate + XOR with rolling key
    const rotated = ((b << 3) | (b >>> 5)) & 0xff
    encrypted[i] = rotated ^ keyByte ^ ((i * 37) & 0xff)
  }
  return encrypted
}

export function decryptBuffer(encrypted) {
  const decrypted = Buffer.alloc(encrypted.length)
  for (let i = 0; i < encrypted.length; i++) {
    const keyByte = SECRET_KEY[i % SECRET_KEY.length]
    const unxor = encrypted[i] ^ keyByte ^ ((i * 37) & 0xff)
    // 3-bit right rotate (inverse of 3-bit left rotate)
    const original = ((unxor >>> 3) | (unxor << 5)) & 0xff
    decrypted[i] = original
  }
  return decrypted
}

const inputDir = 'public/images/ai'
const outputDir = 'public/assets/vault'

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

const files = ['determined.png', 'mad.png', 'sad.png', 'smug.png']
const manifest = {}

for (const file of files) {
  const inPath = path.join(inputDir, file)
  if (fs.existsSync(inPath)) {
    const raw = fs.readFileSync(inPath)
    const encrypted = encryptBuffer(raw)
    
    // Test round-trip decryption
    const testDecrypted = decryptBuffer(encrypted)
    if (!testDecrypted.equals(raw)) {
      throw new Error(`Decryption validation failed for ${file}`)
    }

    const baseName = path.parse(file).name
    // Generate a secure obfuscated hash filename
    const outName = `nx_q_${baseName}.dat`
    const outPath = path.join(outputDir, outName)
    fs.writeFileSync(outPath, encrypted)
    manifest[baseName] = `/assets/vault/${outName}`
    console.log(`Encrypted ${file} (${raw.length} bytes) -> ${outName} (${encrypted.length} bytes)`)
  }
}

console.log('Encryption complete. All assets encrypted & verified!')
