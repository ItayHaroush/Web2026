#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
בדיקת Codepages לעברית במדפסת ESC-POS
=========================================
הסקריפט מדפיס את אותו טקסט עברי עם רשימת codepages שונים.
לכל בלוק יודפס מספר ה-codepage + הקידוד שמשמש להמרה.
פשוט הסתכל בנייר ובחר את הבלוק שיוצא קריא ונכון.

שימוש:
    python3 test_hebrew_codepages.py 192.168.0.120 9100
"""

import socket
import sys
import time

# טקסט בדיקה: עברית + אנגלית + ספרות + סימנים
HEBREW_SAMPLE = "שלום עולם - בדיקת עברית 0123 ₪ אבגדהוזחטיכלמנסעפצקרשת"

# רשימת codepages נפוצים לעברית במדפסות ESC-POS
# (קוד ESC-POS, שם encoding ב-Python, תיאור)
CODEPAGES = [
    (0,  "cp437",   "PC437 USA (ברירת מחדל)"),
    (15, "cp862",   "PC862 Hebrew DOS"),
    (16, "cp1252",  "PC1252 Latin-1"),
    (17, "cp866",   "PC866 Cyrillic"),
    (24, "cp1255",  "PC1255 Hebrew Windows"),
    (25, "cp862",   "PC862 (variant 25)"),
    (32, "cp1255",  "Windows-1255 (variant 32)"),
    (33, "cp862",   "Hebrew (variant 33)"),
    (34, "cp1255",  "Hebrew Windows (variant 34)"),
    (35, "cp862",   "Hebrew DOS (variant 35)"),
    (36, "cp1255",  "Hebrew (variant 36)"),
    (37, "cp862",   "Hebrew (variant 37)"),
    (38, "cp1255",  "Hebrew (variant 38)"),
    (39, "cp862",   "Hebrew (variant 39)"),
    (40, "cp1255",  "Hebrew (variant 40)"),
]


def build_test_payload() -> bytes:
    """בונה את כל הבדיקה כ-bytes ESC-POS."""
    out = bytearray()

    # ESC @ - אתחול מדפסת
    out += b"\x1b\x40"

    # כותרת
    out += b"\x1b\x21\x30"  # double height+width
    out += "=== HEBREW CODEPAGE TEST ===\n".encode("ascii", errors="ignore")
    out += b"\x1b\x21\x00"  # נורמלי
    out += b"\n"

    for code, encoding, desc in CODEPAGES:
        # כותרת בלוק (באנגלית כדי שתמיד תהיה קריאה)
        header = f"--- CP {code} | {encoding} | {desc} ---\n"
        out += header.encode("ascii", errors="ignore")

        # ESC t n - בחירת codepage
        out += b"\x1b\x74" + bytes([code])

        # הטקסט בעברית מקודד ב-encoding המתאים
        try:
            out += HEBREW_SAMPLE.encode(encoding, errors="replace")
        except LookupError:
            out += b"(encoding not supported in python)"
        out += b"\n\n"

    # סיום: feed + cut
    out += b"\n\n\n\n"
    out += b"\x1d\x56\x00"  # GS V 0 - full cut

    return bytes(out)


def send_to_printer(host: str, port: int, payload: bytes) -> None:
    print(f"[*] מתחבר ל-{host}:{port} ...")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(10)
        s.connect((host, port))
        print(f"[*] שולח {len(payload)} בייטים ...")
        s.sendall(payload)
        time.sleep(1.5)
    print("[OK] נשלח. בדוק את הנייר וסמן את הבלוק שיוצא תקין.")


def main():
    if len(sys.argv) >= 2:
        host = sys.argv[1]
    else:
        host = "192.168.0.120"
    port = int(sys.argv[2]) if len(sys.argv) >= 3 else 9100

    payload = build_test_payload()
    send_to_printer(host, port, payload)


if __name__ == "__main__":
    main()
