import sys

with open('public/games/card-jitsu/card_bootstrap.swf', 'rb') as f:
    data = f.read()

# Byte 8..16 is stage RECT
# Byte 21..25 is Tag 9 (SetBackgroundColor, 5 bytes: 2 header + 3 data)
# Byte 26..31 is Tag 12 header (6 bytes: 2 tag code + 4 length)
# Byte 32..32+3339 is action bytes
# Byte 3371..3374 is ShowFrame and EndTag

actions = bytearray(data[32:32+3339])

pc = 0
instructions = []
while pc < len(actions):
    start = pc
    op = actions[pc]
    pc += 1
    if op == 0:
        instructions.append({'op': 0, 'data': b'', 'start': start})
        break
    if op >= 0x80:
        if op in (0x9d, 0x99):
            b1 = actions[pc]
            b2 = actions[pc+1]
            pc += 2
            offset = (b2 << 8) | b1
            if offset >= 32768:
                offset -= 65536
            if start == 1088:
                target = 942
            else:
                target = start + 3 + offset
            instructions.append({'op': op, 'is_branch': True, 'target': target, 'start': start})
        else:
            length = actions[pc] | (actions[pc+1] << 8)
            pc += 2
            payload = actions[pc:pc+length]
            pc += length
            instructions.append({'op': op, 'data': bytearray(payload), 'start': start, 'len': length})
    else:
        instructions.append({'op': op, 'data': b'', 'start': start})

# Find target instruction for each branch
for ins in instructions:
    if ins.get('is_branch'):
        target_ins = next((x for x in instructions if x['start'] == ins['target']), None)
        assert target_ins is not None, f"Target not found for branch at {ins['start']} -> {ins['target']}"
        ins['target_ins'] = target_ins

# Track DefineFunction body ranges
for ins in instructions:
    if ins['op'] == 0x9b:
        p = ins['data']
        idx = p.find(b'\0') + 1
        numParams = p[idx] | (p[idx+1] << 8)
        idx += 2
        for _ in range(numParams):
            idx = p.find(b'\0', idx) + 1
        codeSize = p[idx] | (p[idx+1] << 8)
        body_start = ins['start'] + 3 + len(ins['data'])
        body_end = body_start + codeSize
        first_body = next(x for x in instructions if x['start'] == body_start)
        end_body = next(x for x in instructions if x['start'] == body_end)
        ins['first_body'] = first_body
        ins['end_body'] = end_body
        ins['codeSize_idx'] = idx

# Compute new start addresses
# A branch was 3 bytes, now will be 5 bytes (op + len=2 + offset=2)
new_offset = 0
for ins in instructions:
    ins['new_start'] = new_offset
    if ins.get('is_branch'):
        new_offset += 5
    elif ins['op'] >= 0x80:
        new_offset += 3 + len(ins['data'])
    else:
        new_offset += 1

print(f'New total action length: {new_offset} (was {len(actions)})')

# Now update branch offsets and function codeSizes
for ins in instructions:
    if ins.get('is_branch'):
        target_offset = ins['target_ins']['new_start'] - (ins['new_start'] + 5)
        ins['branch_offset'] = target_offset
    elif ins['op'] == 0x9b:
        new_code_size = ins['end_body']['new_start'] - ins['first_body']['new_start']
        idx = ins['codeSize_idx']
        ins['data'][idx] = new_code_size & 0xff
        ins['data'][idx+1] = (new_code_size >> 8) & 0xff

# Emit new action bytes
new_actions = bytearray()
for ins in instructions:
    new_actions.append(ins['op'])
    if ins.get('is_branch'):
        new_actions.append(2)
        new_actions.append(0)
        off = ins['branch_offset']
        if off < 0:
            off += 65536
        new_actions.append(off & 0xff)
        new_actions.append((off >> 8) & 0xff)
    elif ins['op'] >= 0x80:
        l = len(ins['data'])
        new_actions.append(l & 0xff)
        new_actions.append((l >> 8) & 0xff)
        new_actions.extend(ins['data'])

assert len(new_actions) == new_offset, f'Mismatch: {len(new_actions)} vs {new_offset}'
print('Successfully generated valid AVM1 bytecode!')

# Reconstruct SWF file
# Header: 'FWS', ver 9, length (u32 LE)
# RECT: 760x480 (9 bytes)
rect760x480 = bytes([0x78, 0x00, 0x07, 0x6c, 0x00, 0x00, 0x12, 0xc0, 0x00])
# FrameRate (u16 LE) = 0x1800 (24.0 fps), FrameCount (u16 LE) = 1
swf_header_tail = bytes([0x00, 0x18, 0x01, 0x00])
# Tag 9 (SetBackgroundColor): 0x43, 0x02, 0x15, 0x12, 0x1a
tag9 = data[21:26]
# Tag 12 header: long tag (tag 12 << 6 | 0x3f) = 0x033f, length u32 LE
tag12_len = len(new_actions)
tag12_header = bytes([0x3f, 0x03, tag12_len & 0xff, (tag12_len >> 8) & 0xff, (tag12_len >> 16) & 0xff, (tag12_len >> 24) & 0xff])
# ShowFrame (tag 1, len 0: 0x40, 0x00)
tag1 = bytes([0x40, 0x00])
# EndTag (tag 0, len 0: 0x00, 0x00)
tag0 = bytes([0x00, 0x00])

body = rect760x480 + swf_header_tail + tag9 + tag12_header + new_actions + tag1 + tag0
total_len = 8 + len(body)
header = b'FWS\x09' + bytes([total_len & 0xff, (total_len >> 8) & 0xff, (total_len >> 16) & 0xff, (total_len >> 24) & 0xff])
final_swf = header + body

with open('public/games/card-jitsu/card_bootstrap.swf', 'wb') as f:
    f.write(final_swf)

with open('dist/games/card-jitsu/card_bootstrap.swf', 'wb') as f:
    f.write(final_swf)

print(f'Wrote card_bootstrap.swf: total_len={len(final_swf)}')
