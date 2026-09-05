/**
 * Binary-patches `card_bootstrap.swf` so SHELL.getPlayerHexFromId() resolves
 * the full Dojo Store colour catalogue inside the authentic card.swf engine.
 *
 * MTASC (the compiler used by scripts/build-swfs.mjs) is a Windows-only
 * binary, so the committed SWF is patched in place instead of recompiled.
 * The ActionScript 2 source in src/games/card-jitsu/swf-src/Bootstrap.as is
 * kept in sync and produces the same mapping when MTASC is available.
 *
 * Patch applied to the getPlayerHexFromId switch (AVM1 bytecode):
 *   case 4:  0xCC0000 -> 0x333333  (Black rendered as Red before)
 *   case 15: added ->   0x02A797   (Aqua fell through to the Blue default)
 *   case 16: added ->   0xE2E8F0   (Arctic White fell through to the Blue default)
 *
 * Inserting the two new comparison units + return bodies requires fixing:
 *   - relative If/Jump offsets that span the insertion points,
 *   - enclosing DefineFunction(2) ActionCode length + CodeSize fields,
 *   - the DoInitAction tag length and the SWF header file length.
 *
 * The script is fully deterministic and asserts every byte pattern before
 * touching anything; it exits non-zero if the SWF does not match the expected
 * compiler output.
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const projectRoot = path.resolve(import.meta.dirname, '..')
const swfPath = path.join(projectRoot, 'public', 'games', 'card-jitsu', 'card_bootstrap.swf')

const TAG_DO_INIT_ACTION = 59
const OP_DEFINE_FUNCTION = 0x9b
const OP_DEFINE_FUNCTION2 = 0x8e
const OP_WITH = 0x94
const OP_TRY = 0x8f
const OP_JUMP = 0x99
const OP_IF = 0x9d
const OP_PUSH = 0x96
const OP_RETURN_1B = 0x3e
const OP_EQUALS2_1B = 0x66

const OLD_BODY_VALUES = [
  0x003366, 0x009900, 0xff3399, 0xcc0000, 0xcc0000, 0xff6600, 0xffcc00,
  0x660099, 0x996600, 0xff6666, 0x006600, 0x0099cc, 0x8ae302, 0x8c8c8c,
  0x003366,
]
const NEW_CASES = [
  { id: 15, hex: 0x02a797 }, // Aqua
  { id: 16, hex: 0xe2e8f0 }, // Arctic White
]
const CASE_4_FIX = 0x333333

const fail = (msg) => {
  console.error(`[patch-bootstrap-swf] FAILED: ${msg}`)
  process.exit(1)
}

/* ---------------------------------------------------------------- SWF parse */

function parseRectSize(buf) {
  const nbits = buf[0] >> 3
  const totalBits = 5 + nbits * 4
  return Math.ceil(totalBits / 8)
}

function readU16(buf, p) {
  return buf.readUInt16LE(p)
}
function readI16(buf, p) {
  return buf.readInt16LE(p)
}
function readU32(buf, p) {
  return buf.readUInt32LE(p)
}

function parseTags(buf, tagsStart) {
  const tags = []
  let p = tagsStart
  while (p < buf.length - 1) {
    const codeAndLength = readU16(buf, p)
    const code = codeAndLength >> 6
    let length = codeAndLength & 0x3f
    let headerSize = 2
    if (length === 0x3f) {
      length = readU32(buf, p + 2)
      headerSize = 6
    }
    if (code === 0) break
    tags.push({ code, headerStart: p, headerSize, bodyStart: p + headerSize, length })
    p += headerSize + length
  }
  return tags
}

/* ------------------------------------------------------- AVM1 action parse */
/**
 * Walks an action stream, collecting:
 *  - scoped: actions whose body is itself an action stream (functions, With,
 *    Try blocks), with byte ranges and the position of the field that must
 *    grow when bytes are inserted inside them
 *  - jumps:  every Jump/If with the byte position of its 2-byte offset field
 *
 * Structure notes (matching Ruffle's swf/src/avm1/read.rs):
 *  - ActionDefineFunction(2) param names are NULL-TERMINATED strings.
 *  - The action's Length field covers the header ONLY; the CodeSize bytes of
 *    function code follow AFTER the declared length in the enclosing stream
 *    ("code_length isn't included in the DefineFunction's length").
 */
function walkActions(buf, start, end, scoped, jumps) {
  let p = start
  while (p < end) {
    const op = buf[p]
    if (op === 0x00) break // ActionEnd
    if (op >= 0x80) {
      const len = readU16(buf, p + 1)
      const bodyStart = p + 3
      const bodyEnd = bodyStart + len
      if (bodyEnd > end) fail(`action at 0x${p.toString(16)} overruns its parent scope`)
      let actionEnd = bodyEnd
      if (op === OP_JUMP || op === OP_IF) {
        if (len !== 2) fail(`jump at 0x${p.toString(16)} has length ${len}, expected 2`)
        jumps.push({ op, opStart: p, offsetPos: bodyStart, after: bodyEnd })
      } else if (op === OP_DEFINE_FUNCTION || op === OP_DEFINE_FUNCTION2) {
        // Header: name(null-term) numParams u16 [function2: registerCount u8 +
        // flags u16] [per param: register u8 (function2 only) + null-term name]
        // then codeSize u16, then codeSize bytes of code OUTSIDE the length.
        let q = bodyStart
        while (buf[q] !== 0x00) {
          q++
          if (q >= bodyEnd) fail(`DefineFunction at 0x${p.toString(16)} name runs past its body`)
        }
        q++ // past FunctionName
        const numParams = readU16(buf, q)
        q += 2
        if (op === OP_DEFINE_FUNCTION2) {
          q += 1 // RegisterCount
          q += 2 // PreLoadedFlags
        }
        for (let i = 0; i < numParams; i++) {
          if (op === OP_DEFINE_FUNCTION2) q += 1 // per-param register
          while (buf[q] !== 0x00) {
            q++
            if (q >= bodyEnd) fail(`DefineFunction at 0x${p.toString(16)} param ${i} runs past its body`)
          }
          q++
        }
        const codeSizePos = q
        const codeSize = readU16(buf, q)
        const codeStart = q + 2
        const codeEnd = codeStart + codeSize
        if (codeEnd > end) fail(`DefineFunction at 0x${p.toString(16)} code overruns the stream`)
        scoped.push({
          kind: 'function',
          actionStart: p,
          codeSizePos,
          codeStart,
          codeEnd,
        })
        walkActions(buf, codeStart, codeEnd, scoped, jumps)
        actionEnd = codeEnd
      } else if (op === OP_WITH) {
        scoped.push({ kind: 'with', actionStart: p, lenPos: p + 1, codeStart: bodyStart, codeEnd: bodyEnd })
        walkActions(buf, bodyStart, bodyEnd, scoped, jumps)
      } else if (op === OP_TRY) {
        // TrySize/CatchSize/FinallySize bodies follow the variable header.
        const trySize = readU16(buf, bodyStart)
        const catchSize = readU16(buf, bodyStart + 2)
        const finallySize = readU16(buf, bodyStart + 4)
        const catchInRegister = buf[bodyStart + 6]
        let q = bodyStart + 7
        if (catchInRegister === 0) {
          while (buf[q] !== 0x00) q++
          q++
        } else {
          q++
        }
        const tryStart = q
        const catchStart = tryStart + trySize
        const finallyStart = catchStart + catchSize
        for (const [s, e] of [
          [tryStart, tryStart + trySize],
          [catchStart, catchStart + catchSize],
          [finallyStart, finallyStart + finallySize],
        ]) {
          if (s !== e) walkActions(buf, s, e, scoped, jumps)
        }
      }
      p = actionEnd
    } else {
      p += 1
    }
  }
  return { scoped, jumps }
}

/* ------------------------------------------------------------ switch parse */

function parseColorSwitch(actions, streamStart) {
  // The first comparison unit: Push(int32 1); Equals2; If -> body(1)
  const case1 = Buffer.from([0x96, 0x05, 0x00, 0x07, 0x01, 0x00, 0x00, 0x00, 0x66, 0x9d, 0x02, 0x00])
  const chainStart = actions.indexOf(case1, streamStart)
  if (chainStart < 0) fail('could not locate the getPlayerHexFromId comparison chain')
  if (chainStart - streamStart >= 4 && actions[chainStart - 1] !== 0x17) {
    // Sanity only: the chain is preceded by something harmless; not fatal.
  }

  const units = []
  let p = chainStart
  for (let expectedCase = 1; expectedCase <= 14; expectedCase++) {
    const pushLen = readU16(actions, p + 1)
    const pushBody = actions.subarray(p + 3, p + 3 + pushLen)
    const values = []
    let q = 0
    while (q < pushBody.length) {
      const t = pushBody[q]
      q += 1
      if (t === 0x04) {
        values.push({ reg: pushBody[q] })
        q += 1
      } else if (t === 0x07) {
        values.push({ i32: pushBody.readInt32LE(q) })
        q += 4
      } else {
        fail(`unexpected Push type 0x${t.toString(16)} in comparison unit for case ${expectedCase}`)
      }
    }
    const cmp = values[values.length - 1]
    if (cmp.i32 !== expectedCase) {
      fail(`comparison chain out of order: expected case ${expectedCase}, saw ${JSON.stringify(cmp)}`)
    }
    if (expectedCase > 1 && values[0].reg !== 0) {
      fail(`case ${expectedCase} unit does not reload the switch register`)
    }
    const eqPos = p + 3 + pushLen
    if (actions[eqPos] !== OP_EQUALS2_1B) fail(`missing Equals2 in case ${expectedCase} unit`)
    const ifPos = eqPos + 1
    if (actions[ifPos] !== OP_IF) fail(`missing If in case ${expectedCase} unit`)
    const ifLen = readU16(actions, ifPos + 1)
    if (ifLen !== 2) fail(`If length != 2 in case ${expectedCase} unit`)
    units.push({
      caseId: expectedCase,
      unitStart: p,
      afterIf: ifPos + 3 + ifLen,
      offsetPos: ifPos + 3,
      target: ifPos + 3 + ifLen + readI16(actions, ifPos + 3),
    })
    p = ifPos + 3 + ifLen
  }

  // After the chain: an unconditional Jump to the default body.
  if (actions[p] !== OP_JUMP) fail('expected default-body Jump right after the comparison chain')
  const defaultJumpLen = readU16(actions, p + 1)
  if (defaultJumpLen !== 2) fail('default Jump length != 2')
  const defaultJump = {
    offsetPos: p + 3,
    after: p + 5,
    target: p + 5 + readI16(actions, p + 3),
  }

  // Case bodies: Push(int32 hex); <1-byte return>
  const bodies = []
  let b = defaultJump.after
  for (let i = 0; i < OLD_BODY_VALUES.length; i++) {
    if (actions[b] !== OP_PUSH) fail(`expected body #${i} to start with Push`)
    const len = readU16(actions, b + 1)
    if (len !== 5 || actions[b + 3] !== 0x07) fail(`body #${i} Push is not a plain int32`)
    const value = actions.readInt32LE(b + 4)
    if (value !== OLD_BODY_VALUES[i]) {
      fail(`body #${i} is 0x${(value >>> 0).toString(16)}, expected 0x${OLD_BODY_VALUES[i].toString(16)}`)
    }
    if (actions[b + 8] !== OP_RETURN_1B) fail(`body #${i} is not followed by Return`)
    bodies.push({ start: b, value, valuePos: b + 4 })
    b += 9
  }

  for (let i = 0; i < 14; i++) {
    if (units[i].target !== bodies[i].start) {
      fail(`case ${i + 1} If targets 0x${units[i].target.toString(16)} but body sits at 0x${bodies[i].start.toString(16)}`)
    }
  }
  if (defaultJump.target !== bodies[14].start) fail('default Jump does not target the default body')

  return { chainStart, units, defaultJump, bodies, bodiesEnd: b }
}

/* ------------------------------------------------------------------- patch */

const raw = fs.readFileSync(swfPath)
const signature = raw.subarray(0, 3).toString('latin1')
if (signature !== 'CWS') fail(`expected a zlib-compressed CWS SWF, got ${JSON.stringify(signature)}`)

const version = raw[3]
let buf = Buffer.concat([raw.subarray(0, 3), Buffer.from('FWS'), raw.subarray(3, 8), zlib.inflateSync(raw.subarray(8))])
// Rebuild header cleanly: FWS + version + fileLength + payload after original length field.
{
  const inflated = zlib.inflateSync(raw.subarray(8))
  buf = Buffer.alloc(8 + inflated.length)
  buf.write('FWS', 0, 'latin1')
  buf[3] = version
  buf.writeUInt32LE(8 + inflated.length, 4)
  inflated.copy(buf, 8)
}

const rectBytes = parseRectSize(buf.subarray(8))
const tagsStart = 8 + rectBytes + 4 // rect + frame rate + frame count
const tags = parseTags(buf, tagsStart)
const doInit = tags.find((t) => t.code === TAG_DO_INIT_ACTION)
if (!doInit) fail('SWF has no DoInitAction tag')

const spriteId = readU16(buf, doInit.bodyStart)
const streamStart = doInit.bodyStart + 2
const streamEnd = doInit.bodyStart + doInit.length

const parsed = parseColorSwitch(buf, streamStart)
const { units, defaultJump, bodies } = parsed

/* ------------------------------------------------------------------ plan */
// All offsets below are in the ORIGINAL action stream coordinates.
const insertUnitsAt = defaultJump.after - 5 // right before the default-body Jump
const insertBodiesAt = bodies[14].start + 9 // right after the default body

const unitBytes = (caseId, ifOffset) =>
  Buffer.from([
    0x96, 0x07, 0x00, // Push len 7
    0x04, 0x00, // register 0 (the switch value)
    0x07, caseId & 0xff, (caseId >> 8) & 0xff, 0x00, 0x00, // int32 caseId
    0x66, // Equals2
    0x9d, 0x02, 0x00, // If
    ...[ifOffset & 0xff, (ifOffset >> 8) & 0xff],
  ])
const bodyBytes = (hex) =>
  Buffer.from([0x96, 0x05, 0x00, 0x07, hex & 0xff, (hex >> 8) & 0xff, (hex >> 16) & 0xff, (hex >> 24) & 0xff, 0x3e])

const unitsBlobLength = NEW_CASES.length * unitBytes(1, 0).length
const bodiesBlobLength = NEW_CASES.length * bodyBytes(0).length

const insertions = [
  { at: insertUnitsAt, size: unitsBlobLength },
  { at: insertBodiesAt, size: bodiesBlobLength },
]
const shiftOf = (x) => insertions.reduce((acc, ins) => (ins.at <= x ? acc + ins.size : acc), 0)

// New comparison units live at [insertUnitsAt, insertUnitsAt + unitsBlobLength).
// Their If instructions need absolute targets (in NEW coordinates).
const newUnitIfOffsets = NEW_CASES.map((c, idx) => {
  const unitSize = unitBytes(1, 0).length
  const unitStart = insertUnitsAt + idx * unitSize
  const ifPos = unitStart + 11 // Push header(3) + operands(7) + Equals2(1)
  const afterIf = ifPos + 5
  const bodyStartNew = insertBodiesAt + unitsBlobLength + idx * bodyBytes(0).length
  return { caseId: c.id, ifOffsetPos: ifPos + 3, offset: bodyStartNew - afterIf, afterIf, bodyStartNew }
})

/* --------------------------------------------------------------- rebuild */
let out = Buffer.from(buf) // writable copy

// 1. Fix case 4 body value: Black must stop rendering as Red.
out.writeInt32LE(CASE_4_FIX, bodies[3].valuePos)

// 2. Fix existing Jump/If offsets that span insertion points. The relative
//    offset is anchored at the instruction itself, so the source-side shift
//    must be measured at the opcode's first byte (an insertion at exactly the
//    "after" address would otherwise be double-counted).
const jumps = []
const scoped = []
walkActions(out, streamStart, streamEnd, scoped, jumps)
for (const j of jumps) {
  const target = j.after + readI16(out, j.offsetPos)
  const delta = shiftOf(target) - shiftOf(j.opStart)
  if (delta !== 0) out.writeInt16LE(readI16(out, j.offsetPos) + delta, j.offsetPos)
}

// 3. Grow enclosing scopes. DefineFunction(2) length fields cover the header
//    only, so their CodeSize absorbs insertions made inside the function code.
//    The two new case bodies are appended at the very end of the function's
//    code (right after the default body's Return), which is only reachable
//    via the injected If comparisons - so `<= codeEnd` is intentional: the
//    Return opcodes in those bodies must execute inside the function frame.
//    With/Try length fields cover their whole body and grow directly.
for (const s of scoped) {
  const growth = insertions.reduce(
    (acc, ins) =>
      s.codeStart <= ins.at && (s.kind === 'function' ? ins.at <= s.codeEnd : ins.at < s.codeEnd)
        ? acc + ins.size
        : acc,
    0,
  )
  if (growth > 0) {
    if (s.kind === 'function') {
      out.writeUInt16LE(readU16(out, s.codeSizePos) + growth, s.codeSizePos)
    } else {
      out.writeUInt16LE(readU16(out, s.lenPos) + growth, s.lenPos)
    }
  }
}

// 4. Apply insertions from the end so earlier offsets stay valid.
const buildUnitsBlob = () => {
  const parts = newUnitIfOffsets.map((u) => unitBytes(u.caseId, u.offset))
  return Buffer.concat(parts)
}
const buildBodiesBlob = () => Buffer.concat(NEW_CASES.map((c) => bodyBytes(c.hex)))

const before = Buffer.from(out)
const head2 = before.subarray(0, insertBodiesAt)
const tail2 = before.subarray(insertBodiesAt)
out = Buffer.concat([head2, buildBodiesBlob(), tail2])
const head1 = out.subarray(0, insertUnitsAt)
const tail1 = out.subarray(insertUnitsAt)
out = Buffer.concat([head1, buildUnitsBlob(), tail1])

// 5. DoInitAction tag length + SWF file length.
const totalGrowth = unitsBlobLength + bodiesBlobLength
out.writeUInt32LE(out.length, 4)
if ((readU16(out, doInit.headerStart) & 0x3f) !== 0x3f) {
  fail('DoInitAction tag uses short lengths; expected the extended form')
}
out.writeUInt32LE(doInit.length + totalGrowth, doInit.headerStart + 2)

/* -------------------------------------------------------------- verify */
function verify(swf) {
  const rect = parseRectSize(swf.subarray(8))
  const t = parseTags(swf, 8 + rect + 4).find((x) => x.code === TAG_DO_INIT_ACTION)
  const start = t.bodyStart + 2
  const end = t.bodyStart + t.length
  // Walk the extended chain (16 units now, incl. the injected ones).
  const expected = new Map([
    [1, 0x003366], [2, 0x009900], [3, 0xff3399], [4, 0x333333], [5, 0xcc0000],
    [6, 0xff6600], [7, 0xffcc00], [8, 0x660099], [9, 0x996600], [10, 0xff6666],
    [11, 0x006600], [12, 0x0099cc], [13, 0x8ae302], [14, 0x8c8c8c],
    [15, 0x02a797], [16, 0xe2e8f0],
  ])

  // Original 14 units + injected 2 units form a contiguous 16-case chain;
  // re-walk it from scratch to validate every link. The chain starts where
  // the original case-1 comparison unit was (nothing before it moved).
  const case1Probe = Buffer.from([0x96, 0x05, 0x00, 0x07, 0x01, 0x00, 0x00, 0x00, 0x66, 0x9d, 0x02, 0x00])
  const chainStart = swf.indexOf(case1Probe, start)
  if (chainStart < 0) fail('verify: could not re-locate the comparison chain')
  let p = chainStart
  for (let caseId = 1; caseId <= 16; caseId++) {
    const pushLen = readU16(swf, p + 1)
    const body = swf.subarray(p + 3, p + 3 + pushLen)
    const k = body.readInt32LE(body.length - 4)
    if (k !== caseId) fail(`verify: chain case ${caseId} found ${k}`)
    const eqPos = p + 3 + pushLen
    if (swf[eqPos] !== OP_EQUALS2_1B) fail(`verify: missing Equals2 at case ${caseId}`)
    const ifPos = eqPos + 1
    if (swf[ifPos] !== OP_IF) fail(`verify: missing If at case ${caseId}`)
    const target = ifPos + 5 + readI16(swf, ifPos + 3)
    if (swf[target] !== OP_PUSH) fail(`verify: case ${caseId} If target is not a Push body`)
    const value = swf.readInt32LE(target + 4)
    if (value !== expected.get(caseId)) {
      fail(`verify: case ${caseId} returns 0x${(value >>> 0).toString(16)}, expected 0x${expected.get(caseId).toString(16)}`)
    }
    if (swf[target + 8] !== OP_RETURN_1B) fail(`verify: case ${caseId} body lacks Return`)
    p = ifPos + 5
  }
  if (swf[p] !== OP_JUMP) fail('verify: missing default Jump after extended chain')
  const defTarget = p + 5 + readI16(swf, p + 3)
  const defValue = swf.readInt32LE(defTarget + 4)
  if (defValue !== 0x003366) fail('verify: default body value changed unexpectedly')
  return true
}

verify(out)

/* ------------------------------------------------------------------ save */
const compressed = zlib.deflateSync(out.subarray(8), { level: 9 })
const result = Buffer.alloc(8 + compressed.length)
result.write('CWS', 0, 'latin1')
result[3] = version
result.writeUInt32LE(out.length, 4)
compressed.copy(result, 8)

fs.writeFileSync(swfPath, result)
console.log('[patch-bootstrap-swf] Patched getPlayerHexFromId:')
console.log('  case 4  -> 0x333333 (Black, was rendering Red)')
console.log('  case 15 -> 0x02A797 (Aqua, was falling through to Blue)')
console.log('  case 16 -> 0xE2E8F0 (Arctic White, was falling through to Blue)')
console.log(`[patch-bootstrap-swf] ${swfPath} rewritten (${result.length} bytes, sprite ${spriteId}).`)
