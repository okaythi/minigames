import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const colorsDir = path.join(rootDir, 'public/games/card-jitsu/assets/colors')
const packsDir = path.join(rootDir, 'public/games/card-jitsu/assets/card-packs')
const elementsDir = path.join(rootDir, 'public/games/card-jitsu/assets/elements')

fs.mkdirSync(colorsDir, { recursive: true })
fs.mkdirSync(packsDir, { recursive: true })
fs.mkdirSync(elementsDir, { recursive: true })

const COLOR_ASSETS = [
  { id: 1, name: 'blue', url: 'https://static.wikia.nocookie.net/clubpenguin/images/9/97/Blue_inventory.PNG/revision/latest' },
  { id: 2, name: 'green', url: 'https://static.wikia.nocookie.net/clubpenguin/images/f/fc/Green_icon.png/revision/latest' },
  { id: 3, name: 'pink', url: 'https://static.wikia.nocookie.net/clubpenguin/images/8/86/Pink_icon.png/revision/latest' },
  { id: 4, name: 'black', url: 'https://static.wikia.nocookie.net/clubpenguin/images/7/71/Black.png/revision/latest' },
  { id: 5, name: 'red', url: 'https://static.wikia.nocookie.net/clubpenguin/images/2/2d/Red_Color.png/revision/latest' },
  { id: 6, name: 'orange', url: 'https://static.wikia.nocookie.net/clubpenguin/images/8/85/Orange_icon.png/revision/latest' },
  { id: 7, name: 'yellow', url: 'https://static.wikia.nocookie.net/clubpenguin/images/f/fa/Yellow_icon.png/revision/latest' },
  { id: 8, name: 'dark-purple', url: 'https://static.wikia.nocookie.net/clubpenguin/images/d/d9/Dark_Purple_icon.png/revision/latest' },
  { id: 9, name: 'brown', url: 'https://static.wikia.nocookie.net/clubpenguin/images/0/06/Brown.png/revision/latest' },
  { id: 10, name: 'peach', url: 'https://static.wikia.nocookie.net/clubpenguin/images/b/be/Peach_icon.png/revision/latest' },
  { id: 11, name: 'dark-green', url: 'https://static.wikia.nocookie.net/clubpenguin/images/1/13/Dark_green_inventory.PNG/revision/latest' },
  { id: 12, name: 'light-blue', url: 'https://static.wikia.nocookie.net/clubpenguin/images/8/88/Light_Blue_icon.png/revision/latest' },
  { id: 13, name: 'lime-green', url: 'https://static.wikia.nocookie.net/clubpenguin/images/7/75/Lime_Green_Color.PNG/revision/latest' },
  { id: 14, name: 'sensei-gray', url: 'https://static.wikia.nocookie.net/clubpenguin/images/0/03/Gray_icon.png/revision/latest' },
  { id: 15, name: 'aqua', url: 'https://static.wikia.nocookie.net/clubpenguin/images/6/6d/Aqua2.PNG/revision/latest' },
  { id: 16, name: 'arctic-white', url: 'https://static.wikia.nocookie.net/clubpenguin/images/d/da/Clothing_16_icon.png/revision/latest' },
]

const PACK_ASSETS = [
  { name: 'booster-pack', url: 'https://static.wikia.nocookie.net/clubpenguin/images/d/d9/StarterDeck.png/revision/latest' },
  { name: 'fire-pack', url: 'https://static.wikia.nocookie.net/clubpenguin/images/5/56/FireBoosterDeck.png/revision/latest' },
  { name: 'water-pack', url: 'https://static.wikia.nocookie.net/clubpenguin/images/5/58/Water_Booster_Deck.PNG/revision/latest' },
  { name: 'snow-pack', url: 'https://static.wikia.nocookie.net/clubpenguin/images/b/b6/Clothing_Icons_8011.png/revision/latest' },
]

const ELEMENT_ASSETS = [
  { name: 'fire', url: 'https://static.wikia.nocookie.net/clubpenguin/images/1/1c/Fire_Pin.PNG/revision/latest' },
  { name: 'water', url: 'https://static.wikia.nocookie.net/clubpenguin/images/c/c4/Water_Pin.png/revision/latest' },
  { name: 'snow', url: 'https://static.wikia.nocookie.net/clubpenguin/images/3/3c/Snow_Flakes_Pin.png/revision/latest' },
]

async function downloadFile(url, destPath) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 100) {
    console.log(`[Cache] Already exists: ${destPath}`)
    return true
  }
  console.log(`[Download] Fetching ${url} -> ${destPath}...`)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/png,image/*,*/*',
      },
    })
    if (!res.ok) {
      console.warn(`[Failed] HTTP ${res.status} for ${url}`)
      return false
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(destPath, buffer)
    console.log(`[Success] Saved ${destPath} (${buffer.length} bytes)`)
    return true
  } catch (err) {
    console.error(`[Error] Failed to download ${url}:`, err.message)
    return false
  }
}

async function main() {
  const uploadToR2 = process.argv.includes('--upload')

  console.log('--- Step 1: Downloading Colors ---')
  for (const item of COLOR_ASSETS) {
    const dest = path.join(colorsDir, `${item.id}.png`)
    await downloadFile(item.url, dest)
  }

  console.log('\n--- Step 2: Downloading Pack Icons ---')
  for (const item of PACK_ASSETS) {
    const dest = path.join(packsDir, `${item.name}.png`)
    await downloadFile(item.url, dest)
  }

  console.log('\n--- Step 3: Downloading Element Pins ---')
  for (const item of ELEMENT_ASSETS) {
    const dest = path.join(elementsDir, `${item.name}.png`)
    await downloadFile(item.url, dest)
  }

  if (uploadToR2) {
    console.log('\n--- Step 4: Uploading to Cloudflare R2 (minigames-assets) ---')
    for (const item of COLOR_ASSETS) {
      const localFile = path.join(colorsDir, `${item.id}.png`)
      if (fs.existsSync(localFile)) {
        try {
          console.log(`Uploading colors/${item.id}.png to R2...`)
          execSync(`npx wrangler r2 object put minigames-assets/"colors/${item.id}.png" --file="${localFile}" --remote`, {
            stdio: 'inherit',
          })
        } catch (err) {
          console.warn(`[Wrangler R2 Warning] Could not upload colors/${item.id}.png:`, err.message)
        }
      }
    }

    for (const item of PACK_ASSETS) {
      const localFile = path.join(packsDir, `${item.name}.png`)
      if (fs.existsSync(localFile)) {
        try {
          console.log(`Uploading card-packs/${item.name}.png to R2...`)
          execSync(`npx wrangler r2 object put minigames-assets/"card-packs/${item.name}.png" --file="${localFile}" --remote`, {
            stdio: 'inherit',
          })
        } catch (err) {
          console.warn(`[Wrangler R2 Warning] Could not upload card-packs/${item.name}.png:`, err.message)
        }
      }
    }

    for (const item of ELEMENT_ASSETS) {
      const localFile = path.join(elementsDir, `${item.name}.png`)
      if (fs.existsSync(localFile)) {
        try {
          console.log(`Uploading elements/${item.name}.png to R2...`)
          execSync(`npx wrangler r2 object put minigames-assets/"elements/${item.name}.png" --file="${localFile}" --remote`, {
            stdio: 'inherit',
          })
        } catch (err) {
          console.warn(`[Wrangler R2 Warning] Could not upload elements/${item.name}.png:`, err.message)
        }
      }
    }
  }

  console.log('\n[Done] All assets ready!')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
