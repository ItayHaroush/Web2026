<?php
/**
 * סקריפט בדיקת מדפסת — שולח ESC/POS ישירות דרך TCP socket
 * שימוש: php scripts/test-printer.php [ip] [port]
 * ברירת מחדל: 192.168.0.120:9100
 */

$ip      = $argv[1] ?? '192.168.0.120';
$port    = (int) ($argv[2] ?? 9100);
$timeout = 5;

echo "=== בדיקת מדפסת רשת ===\n";
echo "IP:   $ip\n";
echo "Port: $port\n\n";

// --- שלב 1: ping (TCP connect) ---
echo "[1] בודק חיבור TCP...\n";
$sock = @fsockopen($ip, $port, $errno, $errstr, $timeout);
if (!$sock) {
    echo "    FAIL: לא ניתן להתחבר — $errstr (errno $errno)\n";
    exit(1);
}
echo "    OK: חיבור הצליח\n\n";

stream_set_timeout($sock, $timeout);
stream_set_blocking($sock, false);

// --- שלב 2: בנה ESC/POS ---
$ESC = "\x1B";
$GS  = "\x1D";

// אתחול
$data  = $ESC . "\x40";                   // ESC @ — init
$data .= $ESC . "\x74\x0A";              // ESC t 10 — CP862 (עברית, SNBC BTP-S80)

// הדפסת טקסט אנגלי פשוט (ללא encoding עברי — לבדיקה בסיסית)
$data .= $ESC . "!" . "\x00";            // ESC ! 0 — מצב רגיל
$data .= "TEST PRINT - TakeEat Server\n";
$data .= "IP: $ip  Port: $port\n";
$data .= date("d/m/Y H:i:s") . "\n";
$data .= str_repeat("-", 32) . "\n";
$data .= "Hello from PHP fsockopen\n";
$data .= str_repeat("=", 32) . "\n";
$data .= "\n\n\n";

// חיתוך דף
$data .= $GS . "\x56\x00";              // GS V 0 — Full cut

// --- שלב 3: שלח ---
echo "[2] שולח נתוני ESC/POS (" . strlen($data) . " bytes)...\n";

$sent = @fwrite($sock, $data);
fflush($sock);
fclose($sock);

if ($sent === false) {
    echo "    FAIL: fwrite נכשל\n";
    exit(1);
}

echo "    OK: נשלחו $sent bytes\n\n";
echo "=== בדיקה הסתיימה — בדוק אם המדפסת הדפיסה ===\n";
