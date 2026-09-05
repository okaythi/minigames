import { execSync } from 'child_process'
import fs from 'fs'

const bucket = 'minigames-assets'

const filesToUpload = [
  { file: 'public/images/ai/determined.png', key: 'assets/determined.png' },
  { file: 'public/images/ai/determined.png', key: 'assets/images/ai/determined.png' },
  { file: 'public/images/ai/mad.png', key: 'assets/mad.png' },
  { file: 'public/images/ai/mad.png', key: 'assets/images/ai/mad.png' },
  { file: 'public/images/ai/sad.png', key: 'assets/sad.png' },
  { file: 'public/images/ai/sad.png', key: 'assets/images/ai/sad.png' },
  { file: 'public/images/ai/smug.png', key: 'assets/smug.png' },
  { file: 'public/images/ai/smug.png', key: 'assets/images/ai/smug.png' },
  { file: 'public/apple-touch-icon.png', key: 'assets/apple-touch-icon.png' },
  { file: 'public/favicon.svg', key: 'assets/favicon.svg' },
  { file: 'public/nixlabs-mark.svg', key: 'assets/nixlabs-mark.svg' },
  { file: 'src/games/fl-tron-3/banner.jpg', key: 'assets/fl-tron-3-banner.jpg' },
  { file: 'src/games/fl-tron-3/cover.jpg', key: 'assets/fl-tron-3-cover.jpg' },
  { file: 'src/games/avoid-the-spikes/banner.jpg', key: 'assets/avoid-the-spikes-banner.jpg' },
  { file: 'src/games/avoid-the-spikes/cover.jpg', key: 'assets/avoid-the-spikes-cover.jpg' },
  { file: 'src/games/pong/banner.jpg', key: 'assets/pong-banner.jpg' },
  { file: 'src/games/pong/cover.jpg', key: 'assets/pong-cover.jpg' },
  ...Array.from({ length: 9 }, (_, i) => ({
    file: `public/games/card-jitsu/clothing/icons/${4025 + i}.png`,
    key: `games/card-jitsu/clothing/icons/${4025 + i}.png`,
  })),
  ...Array.from({ length: 9 }, (_, i) => ({
    file: `public/games/card-jitsu/clothing/icons/${4025 + i}.png`,
    key: `clothing/icons/${4025 + i}.png`,
  })),
]

if (fs.existsSync('dist/assets')) {
  for (const item of fs.readdirSync('dist/assets')) {
    if (/\.(png|jpg|jpeg|svg|webp)$/i.test(item)) {
      filesToUpload.push({
        file: `dist/assets/${item}`,
        key: `assets/${item}`,
      })
    }
  }
}

console.log(`Starting upload of ${filesToUpload.length} files to R2 bucket "${bucket}"...`)

for (const { file, key } of filesToUpload) {
  if (fs.existsSync(file)) {
    console.log(`Uploading ${file} -> ${key}`)
    try {
      execSync(`npx wrangler r2 object put "${bucket}/${key}" --file="${file}" --remote`, { stdio: 'inherit' })
    } catch (err) {
      console.error(`Error uploading ${file}:`, err)
    }
  }
}
console.log('Finished uploading all images to R2.')
