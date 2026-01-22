<?php

/**
 * סקריפט בדיקה לאזורי משלוח - מעגל ופוליגון
 */

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "🧪 בדיקת אזורי משלוח\n";
echo str_repeat("=", 60) . "\n\n";

function calculateDistanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $earthRadius = 6371;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
    return round($earthRadius * $c, 2);
}

function isPointInPolygon(float $lat, float $lng, array $polygon): bool
{
    if (count($polygon) < 3) return false;

    $inside = false;
    $j = count($polygon) - 1;
    for ($i = 0; $i < count($polygon); $i++) {
        $lngI = (float) ($polygon[$i]['lng'] ?? 0);
        $latI = (float) ($polygon[$i]['lat'] ?? 0);
        $lngJ = (float) ($polygon[$j]['lng'] ?? 0);
        $latJ = (float) ($polygon[$j]['lat'] ?? 0);

        $intersect = (($latI > $lat) !== ($latJ > $lat))
            && ($lng < ($lngJ - $lngI) * ($lat - $latI) / (($latJ - $latI) ?: 1e-9) + $lngI);

        if ($intersect) $inside = !$inside;
        $j = $i;
    }
    return $inside;
}

// בדיקות פוליגון
$rectanglePolygon = [
    ['lat' => 32.62, 'lng' => 35.28],
    ['lat' => 32.62, 'lng' => 35.30],
    ['lat' => 32.60, 'lng' => 35.30],
    ['lat' => 32.60, 'lng' => 35.28],
];

$polygonTests = [
    ['name' => 'מרכז המלבן', 'lat' => 32.61, 'lng' => 35.29, 'expected' => true],
    ['name' => 'מחוץ לשמאל', 'lat' => 32.61, 'lng' => 35.279, 'expected' => false],
    ['name' => 'מחוץ לימין', 'lat' => 32.61, 'lng' => 35.305, 'expected' => false],
    ['name' => 'מחוץ למעלה', 'lat' => 32.621, 'lng' => 35.29, 'expected' => false],
    ['name' => 'מחוץ למטה', 'lat' => 32.595, 'lng' => 35.29, 'expected' => false],
];

echo "🟦 בדיקות פוליגון (מלבן):\n";
echo str_repeat("-", 60) . "\n";

$passed = 0;
$failed = 0;

foreach ($polygonTests as $test) {
    $isInside = isPointInPolygon($test['lat'], $test['lng'], $rectanglePolygon);
    $success = $isInside === $test['expected'];

    $icon = $success ? '✅' : '❌';
    $result = $isInside ? 'INSIDE' : 'OUTSIDE';
    $expect = $test['expected'] ? 'INSIDE' : 'OUTSIDE';

    echo sprintf("%s %-25s | תוצאה: %-7s | צפוי: %-7s\n", $icon, $test['name'], $result, $expect);

    $success ? $passed++ : $failed++;
}

echo "\n" . str_repeat("=", 60) . "\n";
echo sprintf("📊 סיכום: %d/%d עברו ✅\n", $passed, $passed + $failed);

exit($failed === 0 ? 0 : 1);
