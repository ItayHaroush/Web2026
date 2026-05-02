<?php

/**
 * חד-פעמי: שולף את התשובה הגולמית של getTransList להבנת מבנה.
 * הרצה: php artisan tinker  ואז  require 'scripts/hyp-raw-translist.php';
 */

$base = rtrim(config('payment.hyp.base_url', 'https://pay.hyp.co.il/p/'), '/') . '/';
$masof = config('payment.hyp.masof');
$passp = config('payment.hyp.passp');
$referer = config('payment.hyp.referer_url', 'https://api.chefsync.co.il');

$query = [
    'action'   => 'getTransList',
    'Masof'    => $masof,
    'PassP'    => $passp,
    'FromDate' => '01/01/2025',
    'ToDate'   => date('d/m/Y'),
    'UTF8'     => 'True',
    'UTF8out'  => 'True',
];

echo "URL: {$base}?" . http_build_query($query) . PHP_EOL;
echo str_repeat('=', 80) . PHP_EOL;

$response = \Illuminate\Support\Facades\Http::timeout(30)
    ->withHeaders(['Referer' => $referer])
    ->get($base, $query);

echo 'HTTP status: ' . $response->status() . PHP_EOL;
echo 'Body length: ' . strlen($response->body()) . PHP_EOL;
echo str_repeat('-', 80) . PHP_EOL;
echo 'RAW BODY:' . PHP_EOL;
echo $response->body() . PHP_EOL;
echo str_repeat('-', 80) . PHP_EOL;
