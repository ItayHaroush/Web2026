<?php

/**
 * Helper חד-פעמי: מציג עסקאות מ-HYP getTransList עבור הצמדה של ת״ז לטוקן.
 *
 * הרצה:
 *   cd backend && php artisan tinker scripts/hyp-list-transactions.php
 * או:
 *   cd backend && php scripts/hyp-list-transactions.php   (אם יש bootstrap)
 *
 * הדרך הפשוטה ביותר היא להריץ דרך artisan:
 *   php artisan tinker
 *   >>> require 'scripts/hyp-list-transactions.php';
 */

$svc = app(\App\Services\HypPaymentService::class);

$from = '01/01/2025';
$to = date('d/m/Y');

$res = $svc->getTransList($from, $to);

echo "Range: {$from} → {$to}" . PHP_EOL;
echo 'Success: ' . ($res['success'] ? 'true' : 'false') . PHP_EOL;
echo 'Error: ' . ($res['error'] ?? 'none') . PHP_EOL;
echo 'Total transactions: ' . count($res['transactions']) . PHP_EOL;
echo str_repeat('-', 80) . PHP_EOL;

foreach ($res['transactions'] as $t) {
    $line = sprintf(
        'Id=%-12s L4=%-6s UserId=%-12s CCode=%-3s Amount=%-8s Fild1=%s',
        $t['Id'] ?? '',
        $t['L4digit'] ?? '',
        $t['UserId'] ?? '',
        $t['CCode'] ?? '',
        $t['Amount'] ?? '',
        $t['Fild1'] ?? ''
    );
    echo $line . PHP_EOL;
}
