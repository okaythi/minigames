import sys
import struct

def parse_data(data):
    sig = data[:3].decode('ascii', errors='replace')
    ver = data[3]
    flen = struct.unpack('<I', data[4:8])[0]
    
    # Read bits
    # rect starts at byte 8
    rect_bytes = data[8:]
    bit_pos = 0
    def read_ubits(n):
        nonlocal bit_pos
        val = 0
        for _ in range(n):
            byte_idx = bit_pos // 8
            bit_idx = 7 - (bit_pos % 8)
            bit = (rect_bytes[byte_idx] >> bit_idx) & 1
            val = (val << 1) | bit
            bit_pos += 1
        return val

    def read_sbits(n):
        val = read_ubits(n)
        if val & (1 << (n - 1)):
            val -= (1 << n)
        return val

    nbits = read_ubits(5)
    xmin = read_sbits(nbits)
    xmax = read_sbits(nbits)
    ymin = read_sbits(nbits)
    ymax = read_sbits(nbits)

    return f'{sig} v {ver} nbits {nbits} stage {xmax//20} x {ymax//20}'

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] != '-':
        with open(sys.argv[1], 'rb') as f:
            data = f.read()
    else:
        data = sys.stdin.buffer.read()
    print(parse_data(data))
