#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
יוצר קובץ בינארי hebrew_test.bin עם כל ה-codepages.
אחרי הרצה - שלח למדפסת:
    nc 192.168.0.120 9100 < hebrew_test.bin
או:
    cat hebrew_test.bin | nc -w1 192.168.0.120 9100
"""
import os

TEXT = "שלום עולם"

# (codepage ESC-POS, encoding ב-Python)
CODEPAGES = [
    (0,  "cp437"),
    (7,  "cp1252"),
    (15, "cp862"),
    (16, "cp1252"),
    (17, "cp866"),
    (24, "cp1255"),
    (25, "cp862"),
    (28, "cp1255"),
    (29, "cp1255"),
    (30, "cp862"),
    (31, "cp862"),
    (32, "cp1255"),
    (33, "cp862"),
    (34, "cp1255"),
    (35, "cp862"),
    (36, "cp1255"),
    (37, "cp862"),
    (38, "cp1255"),
    (39, "cp862"),
    (40, "cp1255"),
    (41, "cp1255"),
    (42, "cp862"),
    (43, "cp1255"),
    (44, "cp862"),
    (45, "cp1255"),
    (46, "cp862"),
    (47, "cp1255"),
]

out = bytearray()
out += b"\x1b\x40"  # ESC @ init

out += b"=== HEBREW CODEPAGE TEST ===\n\n"

for code, enc in CODEPAGES:
    label = f"CP {code:>3} ({enc}): ".encode("ascii", errors="ignore")
    out += label
    out += b"\x1b\x74" + bytes([code])  # ESC t n
    try:
        out += TEXT.encode(enc, errors="replace")
    except LookupError:
        out += b"(no python encoder)"
    out += b"\n"

out += b"\n\n\n\n"
out += b"\x1d\x56\x00"  # cut

path = os.path.join(os.path.dirname(__file__), "hebrew_test.bin")
with open(path, "wb") as f:
    f.write(out)

print(f"[OK] נוצר: {path} ({len(out)} bytes)")
print("שלח עם:")
print(f"   nc -w1 192.168.0.120 9100 < {path}")
