import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const iconsDir = path.join(rootDir, 'public/games/card-jitsu/card/icons')

const GITHUB_RAW = 'https://raw.githubusercontent.com/anthonywww/cpcontinuned-media/master/public/v2/games/card/icons'

// 1. Fetch missing icons from anthonywww
const githubMissing = ['148.swf', '171.swf', '175.swf', '184.swf', '272.swf', '390.swf', '494.swf']

// 2. Fetch missing icons from Wayback CDX
const waybackMissing = [
  { id: 585, timestamp: '20160110164925', original: 'http://media1.clubpenguin.com/play/v2/games/card/icons/585.swf' },
  { id: 645, timestamp: '20160110163256', original: 'http://media1.clubpenguin.com/play/v2/games/card/icons/645.swf' },
  { id: 675, timestamp: '20151001025012', original: 'http://media1.clubpenguin.com/play/v2/games/card/icons/675.swf' },
  { id: 697, timestamp: '20151001025153', original: 'http://media1.clubpenguin.com/play/v2/games/card/icons/697.swf' },
  { id: 745, timestamp: '20151001073950', original: 'http://media1.clubpenguin.com/play/v2/games/card/icons/745.swf' },
  { id: 804, timestamp: '20130513001459', original: 'http://media1.clubpenguin.com/play/v2/games/card/icons/804.swf' },
]

async function fetchBuffer(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } })
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > 50) return buf
    }
  } catch (err) {
    console.warn(`Fetch error for ${url}:`, err.message)
  }
  return null
}

async function main() {
  console.log('=== FETCHING CONFIRMED MISSING ICONS ===')
  for (const file of githubMissing) {
    const dest = path.join(iconsDir, file)
    if (!fs.existsSync(dest)) {
      const buf = await fetchBuffer(`${GITHUB_RAW}/${file}`)
      if (buf) {
        fs.writeFileSync(dest, buf)
        console.log(`[SAVED GitHub] ${file} (${buf.length} bytes)`)
      } else {
        console.warn(`[FAILED GitHub] ${file}`)
      }
    }
  }

  for (const item of waybackMissing) {
    const file = `${item.id}.swf`
    const dest = path.join(iconsDir, file)
    if (!fs.existsSync(dest)) {
      const waybackUrl = `https://web.archive.org/web/${item.timestamp}id_/${item.original}`
      const buf = await fetchBuffer(waybackUrl)
      if (buf) {
        fs.writeFileSync(dest, buf)
        console.log(`[SAVED Wayback] ${file} (${buf.length} bytes)`)
      } else {
        console.warn(`[FAILED Wayback] ${file}`)
      }
    }
  }
  console.log('Finished fetching confirmed missing icons.')
}

main().catch(console.error)
