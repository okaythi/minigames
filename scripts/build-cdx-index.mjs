import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outputPath = path.join(rootDir, 'scripts/card-media-index.json')

const subdomains = [
  'media1',
  'media2',
  'media3',
  'media4',
  'media5',
  'media6',
  'media7',
  'media',
  'cdn',
  'play',
]

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchSubdomain(sub) {
  const url = `https://web.archive.org/cdx/search/cdx?url=${sub}.clubpenguin.com/play/v2/games/card/*&output=json&fl=original,timestamp,statuscode,mimetype,length&filter=statuscode:200&collapse=urlkey`
  console.log(`[CDX] Querying ${sub}.clubpenguin.com...`)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers })
      if (!res.ok) {
        console.warn(`[CDX] ${sub} returned HTTP ${res.status} (attempt ${attempt}/3)`)
        await sleep(1000 * attempt)
        continue
      }
      const data = await res.json()
      if (Array.isArray(data) && data.length > 1) {
        // First row is header: ["original","timestamp","statuscode","mimetype","length"]
        const rows = data.slice(1)
        console.log(`[CDX] ${sub}: found ${rows.length} 200 OK records`)
        return rows.map(([original, timestamp, statuscode, mimetype, length]) => ({
          subdomain: sub,
          original,
          timestamp,
          statuscode: Number(statuscode),
          mimetype,
          length: Number(length),
        }))
      }
      console.log(`[CDX] ${sub}: no entries`)
      return []
    } catch (err) {
      console.warn(`[CDX] ${sub} error: ${err.message} (attempt ${attempt}/3)`)
      await sleep(1000 * attempt)
    }
  }
  return []
}

async function main() {
  console.log('=== WAYBACK CDX MEDIA INDEX COMPILER ===')
  const allRecords = new Map()

  for (const sub of subdomains) {
    const records = await fetchSubdomain(sub)
    for (const rec of records) {
      // Key by the normalized path: e.g. /play/v2/games/card/icons/1.swf
      try {
        const u = new URL(rec.original)
        const normPath = u.pathname.toLowerCase()
        if (!allRecords.has(normPath)) {
          allRecords.set(normPath, rec)
        }
      } catch {
        allRecords.set(rec.original, rec)
      }
    }
    await sleep(300)
  }

  const result = Array.from(allRecords.values())
  console.log(`\nTotal unique card media paths indexed: ${result.length}`)

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8')
  console.log(`Saved index to ${outputPath}`)

  // Breakdown
  const icons = result.filter((r) => r.original.includes('/icons/'))
  const battles = result.filter((r) => r.original.includes('/battles/'))
  const award = result.filter((r) => r.original.includes('/award/'))
  console.log(`- Card Icons: ${icons.length}`)
  console.log(`- Battle Animations: ${battles.length}`)
  console.log(`- Award assets: ${award.length}`)
}

main().catch(console.error)
