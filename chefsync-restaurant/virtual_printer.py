#!/usr/bin/env python3
"""
Virtual ESC/POS thermal printer — simulates SNBC BTP-S80 on port 9100.
Decodes CP862 Hebrew, renders formatting (bold, double-height, underline)
via ANSI codes, extracts QR payloads, and re-reverses RTL text so Hebrew
reads naturally in the terminal.
"""
import socket
import sys
import datetime
import re

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9100

ANSI_RESET  = '\033[0m'
ANSI_BOLD   = '\033[1m'
ANSI_ULINE  = '\033[4m'
HEBREW_RE   = re.compile(r'[\u0590-\u05FF]')
MARKER_BIG  = '{{BIG}}'
MARKER_NOBIG = '{{/BIG}}'
MARKERS = (
    '{{BIG}}',
    '{{/BIG}}',
    '{{CENTER}}',
    '{{/CENTER}}',
    '{{BOLD}}',
    '{{/BOLD}}',
    '{{QR}}',
    '{{HEADING}}',
    '{{/HEADING}}',
    '{{CENTER_HW}}',
    '{{/CENTER_HW}}',
)


def parse_escpos(data: bytes):
    """Parse ESC/POS stream into display items: ('line', style, text) or ('qr', url)."""
    items = []
    cur = ''
    bold = dh = dw = uline = False
    qr_data = None

    def sty():
        return {'bold': bold, 'dh': dh, 'dw': dw, 'uline': uline}

    def flush():
        nonlocal cur
        items.append(('line', sty(), cur))
        cur = ''

    i = 0
    while i < len(data):
        b = data[i]

        # ── ESC (0x1B) ──
        if b == 0x1B and i + 1 < len(data):
            cmd = data[i + 1]
            if cmd == 0x40:                              # ESC @ init
                bold = dh = dw = uline = False
                i += 2; continue
            if cmd == 0x74:  i += 3; continue            # ESC t n
            if cmd == 0x20:  i += 3; continue            # ESC SP n
            if cmd == 0x21 and i + 2 < len(data):        # ESC ! n
                n = data[i + 2]
                bold  = bool(n & 0x08)
                dh    = bool(n & 0x10)
                dw    = bool(n & 0x20)
                uline = bool(n & 0x80)
                i += 3; continue
            if cmd == 0x45 and i + 2 < len(data):        # ESC E n
                bold = bool(data[i + 2] & 0x01)
                i += 3; continue
            if cmd == 0x2D and i + 2 < len(data):        # ESC - n
                uline = data[i + 2] in (1, 2)
                i += 3; continue
            if cmd == 0x61:  i += 3; continue             # ESC a n
            i += 2; continue

        # ── GS (0x1D) ──
        if b == 0x1D and i + 1 < len(data):
            cmd = data[i + 1]

            # GS ( k  — QR functions
            if cmd == 0x28 and i + 2 < len(data) and data[i + 2] == 0x6B:
                if i + 4 < len(data):
                    pL, pH = data[i + 3], data[i + 4]
                    param_len = pL + (pH << 8)
                    total = 5 + param_len
                    if param_len >= 3 and i + 7 < len(data):
                        # Function 80 — Store QR data (31 50 30 <data>)
                        if data[i + 5:i + 8] == b'\x31\x50\x30' and param_len >= 4:
                            qr_bytes = data[i + 8: i + 8 + param_len - 3]
                            qr_data = qr_bytes.decode('ascii', errors='replace')
                        # Function 81 — Print stored QR data (31 51 30)
                        elif data[i + 5:i + 8] == b'\x31\x51\x30':
                            if cur:
                                flush()
                            if qr_data:
                                items.append(('qr', qr_data))
                    i += total; continue
                i += 3; continue

            if cmd == 0x56:  flush(); i += 3; continue   # GS V cut
            if cmd == 0x21 and i + 2 < len(data):        # GS ! n
                n = data[i + 2]
                dw = bool(n & 0x0F); dh = bool(n & 0xF0)
                i += 3; continue
            i += 2; continue

        if b == 0x0A: flush(); i += 1; continue          # LF
        if b == 0x0D: i += 1; continue                   # CR

        # Printable — CP862
        try:    cur += bytes([b]).decode('ibm862')
        except: cur += '?'
        i += 1

    if cur: flush()
    if qr_data and not any(item[0] == 'qr' and item[1] == qr_data for item in items):
        items.append(('qr', qr_data))
    return items


def re_reverse(line: str) -> str:
    """Undo the RTL reversal that PrinterBridge applies for the LTR printer."""
    if not line.strip() or not HEBREW_RE.search(line):
        return line
    stripped = line.lstrip(' ')
    pad = len(line) - len(stripped)
    words = stripped.split(' ')
    words.reverse()
    out = []
    for w in words:
        out.append(w[::-1] if HEBREW_RE.search(w) else w)
    return ' ' * pad + ' '.join(out)


def ansi_wrap(style, text, width=42):
    """Pad text to width and wrap with ANSI bold/underline if needed."""
    vis = text[:width].ljust(width)
    pre = ''
    if style.get('bold') or style.get('dh'):
        pre += ANSI_BOLD
    if style.get('uline'):
        pre += ANSI_ULINE
    return f"{pre}{vis}{ANSI_RESET}" if pre else vis


def is_marker_only_line(line: str) -> bool:
    remaining = line.strip()
    if not remaining:
        return False

    while remaining:
        for marker in MARKERS:
            if remaining.startswith(marker):
                remaining = remaining[len(marker):].lstrip()
                break
        else:
            return False

    return True


def main():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(('0.0.0.0', PORT))
    sock.listen(1)

    print(f"\U0001f5a8\ufe0f  Virtual BTP-S80 printer listening on port {PORT}")
    print(f"   {ANSI_BOLD}bold = double-height{ANSI_RESET}  {ANSI_ULINE}underline{ANSI_RESET}  QR \u2192 [QR: url]")
    print("   Press Ctrl+C to stop\n")

    try:
        while True:
            conn, addr = sock.accept()
            data = b''
            while True:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                data += chunk
            conn.close()

            now = datetime.datetime.now().strftime("%H:%M:%S")
            items = parse_escpos(data)

            print(f"\n\U0001f4c4 [{now}] Print job received ({len(data)} bytes)")
            print("\u250c" + "\u2500" * 44 + "\u2510")

            for item in items:
                if item[0] == 'line':
                    _, style, text = item
                    # Skip marker-only lines (text fallback)
                    if is_marker_only_line(text):
                        continue
                    rendered = ansi_wrap(style, re_reverse(text))
                    print(f"\u2502 {rendered} \u2502")

                elif item[0] == 'qr':
                    label = f"[QR: {item[1]}]"
                    print(f"\u2502 {label[:42].center(42)} \u2502")

            print("\u2514" + "\u2500" * 44 + "\u2518")
            print("\u2702\ufe0f  --- cut ---\n")

    except KeyboardInterrupt:
        print(f"\n\U0001f6d1 Virtual printer stopped.")
    finally:
        sock.close()


if __name__ == '__main__':
    main()
