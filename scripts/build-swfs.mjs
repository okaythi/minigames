import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const mtascPath = path.join(projectRoot, 'node_modules', '.tmp', 'mtasc_repo', 'mtasc.exe')
const std8Path = path.join(projectRoot, 'node_modules', '.tmp', 'mtasc_repo', 'std8')
const stdPath = path.join(projectRoot, 'node_modules', '.tmp', 'mtasc_repo', 'std')
const swfSrcPath = path.join(projectRoot, 'src', 'games', 'card-jitsu', 'swf-src')

if (fs.existsSync(mtascPath)) {
  console.log('[build-swfs] Found MTASC compiler, building SWFs...')

  // 1. Build Bootstrap SWF
  const bootstrapOut = path.join(projectRoot, 'public', 'games', 'card-jitsu', 'card_bootstrap.swf')
  execFileSync(mtascPath, [
    '-swf',
    bootstrapOut,
    '-header',
    '760:480:24',
    '-version',
    '8',
    '-cp',
    std8Path,
    '-cp',
    stdPath,
    '-cp',
    swfSrcPath,
    '-main',
    path.join(swfSrcPath, 'Bootstrap.as'),
  ])
  console.log('[build-swfs] Compiled card_bootstrap.swf successfully.')

  // 2. Build Menu SWF and Award SWF (targeting award Sprite 133 menus)
  const templatePath = path.join(projectRoot, 'public', 'games', 'card-jitsu', 'card', 'award', 'award_template.swf')
  const awardPath = path.join(projectRoot, 'public', 'games', 'card-jitsu', 'card', 'award', 'award.swf')
  const awardIn = fs.existsSync(templatePath) ? templatePath : awardPath

  const menuOut = path.join(projectRoot, 'public', 'games', 'card-jitsu', 'card_menu.swf')
  execFileSync(mtascPath, [
    '-swf',
    awardIn,
    '-out',
    menuOut,
    '-version',
    '8',
    '-keep',
    '-cp',
    std8Path,
    '-cp',
    stdPath,
    '-cp',
    swfSrcPath,
    '-main',
    path.join(swfSrcPath, 'Menu.as'),
  ])
  console.log('[build-swfs] Compiled card_menu.swf successfully.')

  // 3. Build Award SWF with Award.as
  execFileSync(mtascPath, [
    '-swf',
    awardIn,
    '-out',
    awardPath,
    '-version',
    '8',
    '-keep',
    '-cp',
    std8Path,
    '-cp',
    stdPath,
    '-cp',
    swfSrcPath,
    '-main',
    path.join(swfSrcPath, 'Award.as'),
  ])
  console.log('[build-swfs] Compiled award.swf successfully.')
} else {
  console.log('[build-swfs] MTASC not found in node_modules/.tmp, using committed SWF binaries.')
}
