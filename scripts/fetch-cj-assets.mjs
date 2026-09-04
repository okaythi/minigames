import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const CARDS_JSON = path.join(rootDir, 'src/games/card-jitsu/engine/deck/cards.json');
const BASE_OUT = path.join(rootDir, 'public/games/card-jitsu/card');
const ICONS_OUT = path.join(BASE_OUT, 'icons');
const BATTLES_OUT = path.join(BASE_OUT, 'battles');
const AWARD_OUT = path.join(BASE_OUT, 'award');

fs.mkdirSync(ICONS_OUT, { recursive: true });
fs.mkdirSync(BATTLES_OUT, { recursive: true });
fs.mkdirSync(AWARD_OUT, { recursive: true });

const GITHUB_RAW = 'https://raw.githubusercontent.com/anthonywww/cpcontinuned-media/master/public/v2/games/card';
const WAYBACK_ICONS = 'https://web.archive.org/web/20180718041512id_/http://media1.clubpenguin.com/play/v2/games/card/icons';
const WAYBACK_AWARD = 'https://web.archive.org/web/20160105033827id_/http://media1.clubpenguin.com/play/v2/games/card/award/award.swf';
const WAYBACK_BATTLES = 'https://web.archive.org/web/20160526213108id_/http://media1.clubpenguin.com/play/v2/games/card/battles';

function getMd5(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
}

const ambientHash = getMd5(path.join(BATTLES_OUT, 'ambient.swf'));

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchBuffer(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 50) return buf;
      }
    } catch {
      await sleep(300 * (attempt + 1));
    }
  }
  return null;
}

async function run() {
  console.log('=== STEP 1: Fetching authentic Elemental Clash SWFs ===');
  const clashes = [
    'f_attack.swf', 'f_react.swf',
    'w_attack.swf', 'w_react.swf',
    's_attack.swf', 's_react.swf'
  ];

  for (const file of clashes) {
    const dest = path.join(BATTLES_OUT, file);
    const existingHash = getMd5(dest);
    // Replace if missing or if byte-identical to ambient.swf placeholder
    if (!fs.existsSync(dest) || (ambientHash && existingHash === ambientHash)) {
      const buf = await fetchBuffer(${GITHUB_RAW}/battles/);
      if (buf) {
        fs.writeFileSync(dest, buf);
        console.log([SAVED] Elemental Clash:  ( bytes));
      } else {
        console.warn([MISSING] Could not fetch );
      }
    } else {
      console.log([EXISTS] );
    }
  }

  console.log('\n=== STEP 2: Fetching Belt Award SWF ===');
  const awardDest = path.join(AWARD_OUT, 'award.swf');
  if (!fs.existsSync(awardDest) || fs.statSync(awardDest).size < 1000) {
    const buf = await fetchBuffer(WAYBACK_AWARD);
    if (buf) {
      fs.writeFileSync(awardDest, buf);
      console.log([SAVED] Award ceremony: award.swf ( bytes));
    }
  } else {
    console.log('[EXISTS] award.swf');
  }

  console.log('\n=== STEP 3: Fetching Available Power Battle Animations ===');
  // Power animations known in repo (pow_71 to pow_97) + pow_427 from wayback
  for (let id = 71; id <= 97; id++) {
    for (const phase of ['attack', 'react']) {
      const file = pow__.swf;
      const dest = path.join(BATTLES_OUT, file);
      if (!fs.existsSync(dest) || fs.statSync(dest).size < 100) {
        const buf = await fetchBuffer(${GITHUB_RAW}/battles/);
        if (buf) {
          fs.writeFileSync(dest, buf);
          console.log([SAVED] Power animation:  ( bytes));
        }
      }
    }
  }
  for (const phase of ['attack', 'react']) {
    const file = pow_427_.swf;
    const dest = path.join(BATTLES_OUT, file);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 100) {
      const buf = await fetchBuffer(${WAYBACK_BATTLES}/);
      if (buf) {
        fs.writeFileSync(dest, buf);
        console.log([SAVED] Power animation:  ( bytes));
      }
    }
  }

  console.log('\n=== STEP 4: Fetching Card Icons (IDs 1 to 804 from cards.json) ===');
  const cards = JSON.parse(fs.readFileSync(CARDS_JSON, 'utf8'));
  console.log(Total card records: );

  let saved = 0;
  let alreadyPresent = 0;
  let missing = 0;

  // Process in small batches with concurrency limit
  const BATCH_SIZE = 8;
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const chunk = cards.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (card) => {
        const dest = path.join(ICONS_OUT, ${card.id}.swf);
        if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
          alreadyPresent++;
          return;
        }

        // Try GitHub repository mirror first (very fast, reliable)
        let buf = await fetchBuffer(${GITHUB_RAW}/icons/.swf);
        // Fallback to Wayback 2018 crawl
        if (!buf) {
          buf = await fetchBuffer(${WAYBACK_ICONS}/.swf);
        }

        if (buf) {
          fs.writeFileSync(dest, buf);
          saved++;
          if (saved % 25 === 0) {
            console.log(Downloaded  card icons... (Card #));
          }
        } else {
          missing++;
        }
      })
    );
    // Yield briefly to avoid socket congestion
    await sleep(40);
  }

  console.log(\nCard icon sync complete:  saved,  already present,  missing.);
  console.log('Done!');
}

run();
