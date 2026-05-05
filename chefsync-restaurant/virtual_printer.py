#!/usr/bin/env python3
"""
Virtual ESC/POS thermal printer — multi-model, dynamic codepage, optional bitmap mode.

Usage:
  python3 virtual_printer.py                        # port 9100, codepage 10 (ibm862)
  python3 virtual_printer.py 9100                   # explicit port (positional, backward-compat)
  python3 virtual_printer.py --model ace-h2         # ACE H2 preset (codepage 41, ibm862)
  python3 virtual_printer.py --codepage 41          # explicit default codepage
  python3 virtual_printer.py --bitmap               # also save PNG + ESC/POS raster .bin
  python3 virtual_printer.py --model ace-h2 --bitmap --width 576

Bitmap mode requires:  pip3 install Pillow
QR in bitmap mode:     pip3 install 'qrcode[pil]'
"""
import socket
import sys
import os
import datetime
import re
import argparse

# ── Codepage map: ESC t value  →  Python encoding ───────────────────────────
CODEPAGE_MAP = {
    0:  'cp437',    # PC437 USA
    10: 'ibm862',   # PC862 Hebrew  (SNBC, Epson default)
    15: 'ibm862',   # PC862 Hebrew  (Bixolon)
    16: 'cp1255',   # WPC1255 Hebrew Windows
    17: 'cp1255',   # WPC1255 Hebrew Windows (alt)
    41: 'ibm862',   # PC862 Hebrew  (ACE H2 / XPrinter Hebrew)
    54: 'cp1255',   # WPC1255 Hebrew (alternate ref)
}
DEFAULT_CODEPAGE = 10

# ── Printer model presets ────────────────────────────────────────────────────
PRINTER_MODELS = {
    'ace-h2':   {'codepage': 41, 'width_px': 576, 'desc': 'ACE H2 / XPrinter (ibm862 #41)'},
    'xprinter': {'codepage': 41, 'width_px': 576, 'desc': 'XPrinter generic Hebrew'},
    'epson':    {'codepage': 10, 'width_px': 576, 'desc': 'Epson TM-series'},
    'snbc':     {'codepage': 10, 'width_px': 576, 'desc': 'SNBC BTP-S80'},
    'bixolon':  {'codepage': 15, 'width_px': 576, 'desc': 'Bixolon SRP series'},
    'wpc1255':  {'codepage': 16, 'width_px': 576, 'desc': 'WPC1255 Windows Hebrew'},
}

ANSI_RESET = '\033[0m'
ANSI_BOLD  = '\033[1m'
ANSI_ULINE = '\033[4m'
HEBREW_RE  = re.compile(r'[\u0590-\u05FF]')
MARKERS = (
    '{{BIG}}', '{{/BIG}}', '{{CENTER}}', '{{/CENTER}}',
    '{{BOLD}}', '{{/BOLD}}', '{{QR}}', '{{HEADING}}',
    '{{/HEADING}}', '{{CENTER_HW}}', '{{/CENTER_HW}}',
)


# ── ESC/POS parser ───────────────────────────────────────────────────────────

def parse_escpos(data: bytes, default_codepage: int = DEFAULT_CODEPAGE):
    """Parse ESC/POS stream.

    Returns (items, last_codepage) where items is a list of:
      ('line',  style_dict, text)
      ('qr',    url_string)
      ('image', description_string)   ← inbound raster block (GS v 0)
    """
    items = []
    cur = ''
    bold = dh = dw = uline = False
    align = 0   # 0=left, 1=center, 2=right
    current_codepage = default_codepage
    qr_data = None

    def sty():
        return {'bold': bold, 'dh': dh, 'dw': dw, 'uline': uline, 'align': align}

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
            if cmd == 0x40:                                    # ESC @ init
                bold = dh = dw = uline = False
                current_codepage = default_codepage
                i += 2; continue
            if cmd == 0x74 and i + 2 < len(data):             # ESC t n — select codepage
                current_codepage = data[i + 2]
                i += 3; continue
            if cmd == 0x74:  i += 3; continue                  # ESC t (short, malformed)
            if cmd == 0x20:  i += 3; continue                  # ESC SP n
            if cmd == 0x21 and i + 2 < len(data):              # ESC ! n
                n = data[i + 2]
                bold  = bool(n & 0x08)
                dh    = bool(n & 0x10)
                dw    = bool(n & 0x20)
                uline = bool(n & 0x80)
                i += 3; continue
            if cmd == 0x45 and i + 2 < len(data):              # ESC E n
                bold = bool(data[i + 2] & 0x01)
                i += 3; continue
            if cmd == 0x2D and i + 2 < len(data):              # ESC - n
                uline = data[i + 2] in (1, 2)
                i += 3; continue
            if cmd == 0x61 and i + 2 < len(data):              # ESC a n (align)
                align = data[i + 2] & 0x03   # 0=left 1=center 2=right
                i += 3; continue
            i += 2; continue

        # ── GS (0x1D) ──
        if b == 0x1D and i + 1 < len(data):
            cmd = data[i + 1]

            # GS ( k — QR functions
            if cmd == 0x28 and i + 2 < len(data) and data[i + 2] == 0x6B:
                if i + 4 < len(data):
                    pL, pH = data[i + 3], data[i + 4]
                    param_len = pL + (pH << 8)
                    total = 5 + param_len
                    if param_len >= 3 and i + 7 < len(data):
                        if data[i + 5:i + 8] == b'\x31\x50\x30' and param_len >= 4:
                            qr_bytes = data[i + 8: i + 8 + param_len - 3]
                            qr_data = qr_bytes.decode('ascii', errors='replace')
                        elif data[i + 5:i + 8] == b'\x31\x51\x30':
                            if cur: flush()
                            if qr_data:
                                items.append(('qr', qr_data))
                    i += total; continue
                i += 3; continue

            if cmd == 0x56:  flush(); i += 3; continue         # GS V cut
            if cmd == 0x21 and i + 2 < len(data):              # GS ! n
                n = data[i + 2]
                dw = bool(n & 0x0F); dh = bool(n & 0xF0)
                i += 3; continue

            # GS v 0 — raster image block — decode pixel data if Pillow available
            if cmd == 0x76 and i + 2 < len(data) and data[i + 2] == 0x30:
                if i + 7 < len(data):
                    xL, xH = data[i + 4], data[i + 5]
                    yL, yH = data[i + 6], data[i + 7]
                    bytes_per_row = xL + (xH << 8)
                    rows = yL + (yH << 8)
                    total = 8 + bytes_per_row * rows
                    if cur: flush()
                    # Try to decode raw pixel bytes → PIL image (no numpy needed)
                    pixel_bytes = data[i + 8 : i + total]
                    raster_img = None
                    try:
                        from PIL import Image as _PilImage
                        width_px = bytes_per_row * 8
                        img_bytes = bytearray(width_px * rows)
                        for r in range(rows):
                            for b_idx in range(bytes_per_row):
                                byte = pixel_bytes[r * bytes_per_row + b_idx]
                                for bit in range(8):
                                    px = 0 if (byte >> (7 - bit)) & 1 else 255
                                    img_bytes[r * width_px + b_idx * 8 + bit] = px
                        raster_img = _PilImage.frombytes('L', (width_px, rows), bytes(img_bytes))
                    except Exception:
                        raster_img = None
                    label = f'[raster {bytes_per_row * 8}×{rows} px]'
                    items.append(('image', label, raster_img))
                    i += total; continue
                i += 3; continue

            i += 2; continue

        if b == 0x0A: flush(); i += 1; continue                # LF
        if b == 0x0D: i += 1; continue                        # CR

        # Printable byte — decode with current codepage
        enc = CODEPAGE_MAP.get(current_codepage, 'ibm862')
        try:    cur += bytes([b]).decode(enc, errors='replace')
        except: cur += '?'
        i += 1

    if cur: flush()
    return items, current_codepage


# ── Text display helpers ─────────────────────────────────────────────────────

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


# ── Bitmap rendering ─────────────────────────────────────────────────────────

# Candidate font paths — Hebrew-capable fonts, macOS → Linux → Windows
_FONT_PATHS = [
    # Arial Unicode — covers Hebrew AND Latin/digits; best first choice
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    # macOS — ArialHB (Hebrew Bold, may lack Latin)
    '/System/Library/Fonts/ArialHB.ttc',
    # macOS — SF Hebrew
    '/System/Library/Fonts/SFHebrew.ttf',
    '/System/Library/Fonts/SFHebrewRounded.ttf',
    # macOS — Raanana / NewPeninimMT
    '/System/Library/Fonts/Supplemental/Raanana.ttc',
    '/System/Library/Fonts/Supplemental/NewPeninimMT.ttc',
    # macOS — user-installed
    '/Library/Fonts/Arial Hebrew.ttf',
    '/Library/Fonts/Arial Hebrew Bold.ttf',
    # macOS — Latin fallback
    '/System/Library/Fonts/LucidaGrande.ttc',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    # Linux
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/culmus/frank-ruehl-clm-medium.ttf',
    # Windows
    'C:/Windows/Fonts/arialuni.ttf',
    'C:/Windows/Fonts/arial.ttf',
]

_HEBREW_FONT_KEYWORDS = (
    'ArialHB', 'SFHebrew', 'Arial Hebrew', 'arialuni', 'Arial Unicode',
    'Raanana', 'NewPeninimMT', 'culmus', 'frank',
)


def _find_font(size: int):
    """Return (font, has_hebrew) — TrueType if available, else built-in default."""
    try:
        from PIL import ImageFont
        for path in _FONT_PATHS:
            if os.path.exists(path):
                try:
                    font = ImageFont.truetype(path, size)
                    has_heb = any(k in path for k in _HEBREW_FONT_KEYWORDS)
                    return font, has_heb
                except Exception:
                    continue
        print('   \u26a0\ufe0f  [bitmap] No TrueType font found — Hebrew will show as boxes.')
        return ImageFont.load_default(), False
    except ImportError:
        return None, False


def _measure_text(draw, text: str, font) -> int:
    """Return pixel width of text, compatible with old and new Pillow."""
    try:
        return int(draw.textlength(text, font=font))   # Pillow ≥ 8.0
    except AttributeError:
        pass
    try:
        return font.getsize(text)[0]                   # Pillow < 10
    except Exception:
        return len(text) * 14                          # rough fallback


def _to_escpos_raster(img) -> bytes:
    """Convert a PIL image to ESC/POS GS v 0 raster bytes (mode 0 = normal)."""
    if img.mode != '1':
        img = img.convert('1')
    width, height = img.size
    bytes_per_row = (width + 7) // 8
    xL = bytes_per_row & 0xFF
    xH = (bytes_per_row >> 8) & 0xFF
    yL = height & 0xFF
    yH = (height >> 8) & 0xFF
    # GS v 0 header
    header = bytes([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH])
    pixels = img.load()
    pixel_data = bytearray()
    for y in range(height):
        for bx in range(bytes_per_row):
            byte_val = 0
            for bit in range(8):
                px = bx * 8 + bit
                if px < width:
                    # PIL '1' mode: 0 = black (print dot), 255 = white
                    if pixels[px, y] == 0:
                        byte_val |= (1 << (7 - bit))
            pixel_data.append(byte_val)
    return header + bytes(pixel_data)


# Regex: line is entirely one repeated char (===, ---, ***, ~~~, etc.) possibly with spaces
_DIVIDER_RE = re.compile(r'^([=\-_~*#])(\1|\s){4,}$')


def _divider_style(text: str):
    """Return ('solid'|'dashed'|None, thickness) if text is a full-width divider."""
    t = text.strip()
    if not t:
        return None, 0
    ch = t[0]
    if all(c == ch or c == ' ' for c in t) and len(t) >= 4:
        if ch == '=':
            return 'solid', 3
        if ch == '-':
            return 'dashed', 1
        if ch in ('_', '*', '#', '~'):
            return 'solid', 2
    return None, 0


def render_bitmap(items, width_px: int = 576, out_dir: str = '.'):
    """Render receipt items to a PNG image and an ESC/POS raster .bin file.

    Returns (png_path, raster_bytes) or (None, None) if Pillow is missing.
    """
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return None, None

    NORMAL_SIZE = 28
    BIG_SIZE    = 44
    LH_NORMAL   = 36
    LH_BIG      = 54
    PAD_X       = 16
    PAD_Y       = 16

    font_normal, _ = _find_font(NORMAL_SIZE)
    font_big,    _ = _find_font(BIG_SIZE)

    LH_DIVIDER_SOLID  = 14   # height reserved for === divider
    LH_DIVIDER_DASHED = 10   # height reserved for --- divider

    # ── First pass: calculate total canvas height ────────────────────────────
    total_h = PAD_Y
    for item in items:
        if item[0] == 'line':
            _, style, text = item
            if not text.strip():
                total_h += LH_NORMAL // 2
                continue
            div_kind, _ = _divider_style(text)
            if div_kind == 'solid':
                total_h += LH_DIVIDER_SOLID
                continue
            if div_kind == 'dashed':
                total_h += LH_DIVIDER_DASHED
                continue
            if style.get('dh') or style.get('dw'):
                total_h += LH_BIG
            else:
                total_h += LH_NORMAL
        elif item[0] == 'qr':
            total_h += width_px // 3 + 10
        elif item[0] == 'image':
            total_h += LH_NORMAL
    total_h += PAD_Y

    # ── Create white canvas (grayscale for PNG viewing) ──────────────────────
    img  = Image.new('L', (width_px, total_h), color=255)
    draw = ImageDraw.Draw(img)

    y = PAD_Y
    for item in items:
        if item[0] == 'line':
            _, style, text = item
            if is_marker_only_line(text):
                continue
            if not text.strip():
                y += LH_NORMAL // 2
                continue

            # ── Divider lines: draw as full-width rule ────────────────────────
            div_kind, thickness = _divider_style(text)
            if div_kind == 'solid':
                mid = y + LH_DIVIDER_SOLID // 2
                draw.rectangle([0, mid - thickness, width_px, mid + thickness], fill=0)
                y += LH_DIVIDER_SOLID
                continue
            if div_kind == 'dashed':
                mid = y + LH_DIVIDER_DASHED // 2
                seg, gap = 18, 6
                x0 = 0
                while x0 < width_px:
                    draw.rectangle([x0, mid, min(x0 + seg, width_px), mid + thickness], fill=0)
                    x0 += seg + gap
                y += LH_DIVIDER_DASHED
                continue

            # For bitmap: use raw text (NOT re_reversed).
            # PrinterBridge already reversed chars+word-order for LTR ESC/POS output,
            # so the raw decoded text is in correct visual display order for PIL (LTR).
            # re_reverse would produce logical Hebrew which PIL can't bidi-render.
            display = text.strip()
            is_big  = bool(style.get('dh') or style.get('dw'))
            font    = font_big    if is_big else font_normal
            lh      = LH_BIG     if is_big else LH_NORMAL
            esc_align = style.get('align', 0)   # 0=left 1=center 2=right
            is_hebrew = bool(HEBREW_RE.search(display))

            tw = _measure_text(draw, display, font)
            if esc_align == 1:                           # center (ESC a 1)
                x = max(PAD_X, (width_px - tw) // 2)
            elif esc_align == 2 or is_hebrew:            # right-align: explicit or Hebrew
                x = max(PAD_X, width_px - PAD_X - tw)
            else:                                        # left
                x = PAD_X
            draw.text((x, y), display, font=font, fill=0)
            y += lh

        elif item[0] == 'qr':
            qr_url  = item[1]
            qr_size = width_px // 3
            try:
                import qrcode
                qr = qrcode.QRCode(box_size=4, border=2)
                qr.add_data(qr_url)
                qr.make(fit=True)
                qr_img = qr.make_image(fill_color='black', back_color='white').convert('L')
                qr_img = qr_img.resize((qr_size, qr_size))
                img.paste(qr_img, ((width_px - qr_size) // 2, y))
            except ImportError:
                draw.rectangle([PAD_X, y, width_px - PAD_X, y + qr_size], outline=0, width=2)
                lbl = f'[QR: {qr_url[:35]}]'
                tw  = _measure_text(draw, lbl, font_normal)
                draw.text(((width_px - tw) // 2, y + qr_size // 2 - NORMAL_SIZE // 2),
                          lbl, font=font_normal, fill=0)
            y += qr_size + 10

        elif item[0] == 'image':
            draw.text((PAD_X, y), item[1], font=font_normal, fill=128)
            y += LH_NORMAL

    # ── Crop to actual content ───────────────────────────────────────────────
    img = img.crop((0, 0, width_px, min(y + PAD_Y, total_h)))

    # ── Save PNG ─────────────────────────────────────────────────────────────
    ts       = datetime.datetime.now().strftime('%H%M%S')
    png_path = os.path.join(out_dir, f'receipt_{ts}.png')
    img.save(png_path)

    # ── Generate ESC/POS GS v 0 raster bytes ─────────────────────────────────
    raster_bytes = _to_escpos_raster(img)

    # ── Save raw raster .bin (ready to send to a real printer) ───────────────
    bin_path = png_path.replace('.png', '_raster.bin')
    with open(bin_path, 'wb') as f:
        f.write(raster_bytes)

    return png_path, raster_bytes


# ── Main server ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Virtual ESC/POS thermal printer (multi-model, dynamic codepage, bitmap)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='Printer models:\n' + '\n'.join(
            f"  {k:<10}  cp{v['codepage']}  {v['desc']}"
            for k, v in PRINTER_MODELS.items()
        ),
    )
    parser.add_argument('port',       nargs='?', type=int, default=9100,
                        help='TCP port to listen on (default: 9100)')
    parser.add_argument('--model',    choices=PRINTER_MODELS.keys(), default=None,
                        help='Printer model preset (sets default codepage & paper width)')
    parser.add_argument('--codepage', type=int, default=None,
                        help=f'Default codepage ID — overrides --model '
                             f'(known: {sorted(CODEPAGE_MAP.keys())})')
    parser.add_argument('--bitmap',   action='store_true',
                        help='Render each job as PNG + ESC/POS raster .bin (requires Pillow)')
    parser.add_argument('--width',    type=int, default=None,
                        help='Paper width in pixels for bitmap mode (default: 576)')
    args = parser.parse_args()

    # ── Resolve effective settings ───────────────────────────────────────────
    model_cfg    = PRINTER_MODELS.get(args.model, {}) if args.model else {}
    eff_codepage = (args.codepage if args.codepage is not None
                    else model_cfg.get('codepage', DEFAULT_CODEPAGE))
    eff_width    = (args.width if args.width is not None
                    else model_cfg.get('width_px', 576))
    enc_name     = CODEPAGE_MAP.get(eff_codepage, 'ibm862 (unknown)')

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(('0.0.0.0', args.port))
    sock.listen(1)

    model_tag  = f'  model={args.model}' if args.model else ''
    bitmap_tag = '  \U0001f5bc\ufe0f bitmap=ON' if args.bitmap else ''
    print(f'\U0001f5a8\ufe0f  Virtual printer  port={args.port}'
          f'  cp{eff_codepage}={enc_name}{model_tag}{bitmap_tag}')
    if args.bitmap:
        print(f'   PNG + raster .bin → current directory  ({eff_width}px wide paper)')
    print(f'   {ANSI_BOLD}bold=double-height{ANSI_RESET}  '
          f'{ANSI_ULINE}underline{ANSI_RESET}  QR→[QR: url]')
    print('   Press Ctrl+C to stop\n')

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

            now = datetime.datetime.now().strftime('%H:%M:%S')
            items, detected_cp = parse_escpos(data, default_codepage=eff_codepage)
            cp_info = (f'cp{detected_cp}={CODEPAGE_MAP.get(detected_cp, "?")}' if detected_cp != eff_codepage
                       else f'cp{eff_codepage}={enc_name}')
            print(f'\n\U0001f4c4 [{now}]  {len(data)} bytes  codepage={cp_info}')
            print('\u250c' + '\u2500' * 44 + '\u2510')

            for item in items:
                if item[0] == 'line':
                    _, style, text = item
                    if is_marker_only_line(text):
                        continue
                    rendered = ansi_wrap(style, re_reverse(text))
                    print(f'\u2502 {rendered} \u2502')
                elif item[0] == 'qr':
                    label = f'[QR: {item[1]}]'
                    print(f'\u2502 {label[:42].center(42)} \u2502')
                elif item[0] == 'image':
                    label = item[1]
                    print(f'\u2502 {label[:42].center(42)} \u2502')

            print('\u2514' + '\u2500' * 44 + '\u2518')
            print('\u2702\ufe0f  --- cut ---')

            # Always save PNG when inbound GS v 0 raster was received (bitmap template)
            raster_items = [it for it in items if it[0] == 'image' and len(it) >= 3 and it[2] is not None]
            if raster_items:
                try:
                    ts = datetime.datetime.now().strftime('%H%M%S')
                    png_path = f'./receipt_{ts}.png'
                    raster_img = raster_items[0][2]
                    raster_img.save(png_path)
                    print(f'\U0001f5bc\ufe0f  {png_path}  ({raster_img.width}×{raster_img.height} px — decoded from received raster)')
                    if sys.platform == 'darwin':
                        os.system(f'open "{png_path}"')
                    elif sys.platform.startswith('linux'):
                        os.system(f'xdg-open "{png_path}" &')
                except Exception as e:
                    print(f'   [bitmap] Failed to save decoded raster: {e}')
            elif args.bitmap:
                # No raw raster received — render from text items (classic/enhanced path)
                png_path, raster = render_bitmap(items, width_px=eff_width)
                if png_path:
                    kb = len(raster) / 1024 if raster else 0
                    print(f'\U0001f5bc\ufe0f  {png_path}  ({kb:.1f} KB raster)')
                    if sys.platform == 'darwin':
                        os.system(f'open "{png_path}"')
                    elif sys.platform.startswith('linux'):
                        os.system(f'xdg-open "{png_path}" &')
                else:
                    print('   [bitmap] Pillow not installed — run: pip install Pillow')
            print()

    except KeyboardInterrupt:
        print('\n\U0001f6d1 Virtual printer stopped.')
    finally:
        sock.close()


if __name__ == '__main__':
    main()
