<?php
/**
 * HYP Payment Proxy for Appointed.cloud
 * 1. Gets signature from HYP (from chefsync IP + referer)
 * 2. Redirects browser to HYP payment page (with chefsync as referer)
 */

$secret = "appointed_hyp_bounce_2026";

// ── Mode 1: Sign API call (server-to-server from appointed) ──
if (isset($_GET["mode"]) && $_GET["mode"] === "sign") {
    header("Content-Type: application/json");

    $sig = $_GET["sig"] ?? "";
    $payload = $_GET["payload"] ?? "";

    if (empty($sig) || empty($payload)) {
        http_response_code(400);
        die(json_encode(["error" => "Missing parameters"]));
    }

    if (!hash_equals(hash_hmac("sha256", $payload, $secret), $sig)) {
        http_response_code(403);
        die(json_encode(["error" => "Invalid signature"]));
    }

    $params = json_decode(base64_decode($payload), true);
    if (!$params) {
        http_response_code(400);
        die(json_encode(["error" => "Invalid payload"]));
    }

    // Make the APISign call to HYP from this server
    $hypUrl = "https://pay.hyp.co.il/p/?" . http_build_query($params);
    $ctx = stream_context_create([
        "http" => [
            "header" => "Referer: https://api.chefsync.co.il\r\n",
            "timeout" => 15,
        ],
        "ssl" => ["verify_peer" => true, "verify_peer_name" => true],
    ]);

    $response = @file_get_contents($hypUrl, false, $ctx);
    if ($response === false) {
        http_response_code(502);
        die(json_encode(["error" => "HYP request failed"]));
    }

    echo json_encode(["success" => true, "response" => $response]);
    exit;
}

// ── Mode 2: Browser redirect to HYP payment page ──
$url = $_GET["url"] ?? "";
$hmac = $_GET["sig"] ?? "";

if (empty($url) || empty($hmac)) {
    http_response_code(400);
    die("Missing parameters");
}

if (!hash_equals(hash_hmac("sha256", $url, $secret), $hmac)) {
    http_response_code(403);
    die("Invalid signature");
}

if (strpos($url, "https://pay.hyp.co.il/") !== 0) {
    http_response_code(403);
    die("Invalid redirect target");
}
?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>מעבר לתשלום</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#fff;padding:24px;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);max-width:400px;text-align:center}
.spinner{margin:20px auto;width:32px;height:32px;border-radius:50%;border:3px solid #f3f3f3;border-top-color:#6366f1;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="card">
<h2>ממתין לתשלום מאובטח...</h2>
<div class="spinner"></div>
</div>
<script>setTimeout(function(){window.location.href=<?php echo json_encode($url);?>;},400);</script>
</body>
</html>
