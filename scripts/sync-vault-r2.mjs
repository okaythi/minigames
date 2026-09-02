import { execSync } from 'child_process'
import fs from 'fs'

const bucket = 'minigames-assets'
const vaultFiles = [
  'nx_q_determined.dat',
  'nx_q_mad.dat',
  'nx_q_sad.dat',
  'nx_q_smug.dat',
]

for (const file of vaultFiles) {
  const local = `public/assets/vault/${file}`
  const key = `assets/vault/${file}`
  if (fs.existsSync(local)) {
    console.log(`Uploading encrypted vault file: ${local} -> ${key}`)
    execSync(`npx wrangler r2 object put "${bucket}/${key}" --file="${local}" --remote`, { stdio: 'inherit' })
  }
}

// Delete old plain images from R2
const oldKeys = [
  'assets/determined.png',
  'assets/mad.png',
  'assets/sad.png',
  'assets/smug.png',
  'assets/images/ai/determined.png',
  'assets/images/ai/mad.png',
  'assets/images/ai/sad.png',
  'assets/images/ai/smug.png',
]

for (const key of oldKeys) {
  try {
    console.log(`Deleting raw key from R2: ${key}`)
    execSync(`npx wrangler r2 object delete "${bucket}/${key}" --remote`, { stdio: 'inherit' })
  } catch (err) {
    console.warn(`Could not delete ${key}:`, err.message)
  }
}

console.log('R2 encrypted vault update complete.')
