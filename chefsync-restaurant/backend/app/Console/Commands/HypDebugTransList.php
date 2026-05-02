<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * חד-פעמי: בודק תשובת getTransList גולמית מ-HYP B2B כדי לאתר UserId שהוצמדו לטוקן.
 * הרצה: php artisan hyp:debug-translist [--from=01/01/2025] [--to=DD/MM/YYYY] [--last4=8328]
 */
class HypDebugTransList extends Command
{
    protected $signature = 'hyp:debug-translist
                            {--from=01/01/2025 : תאריך התחלה DD/MM/YYYY}
                            {--to= : תאריך סיום DD/MM/YYYY (ברירת מחדל: היום)}
                            {--last4= : סינון לפי 4 ספרות אחרונות של כרטיס}';

    protected $description = 'מציג את תשובת getTransList הגולמית מ-HYP B2B עם ניתוח לכל עסקה';

    public function handle(): int
    {
        $base = rtrim(config('payment.hyp.base_url', 'https://pay.hyp.co.il/p/'), '/') . '/';
        $masof = config('payment.hyp.masof');
        $passp = config('payment.hyp.passp');
        $referer = config('payment.hyp.referer_url', 'https://api.chefsync.co.il');

        if (empty($masof) || empty($passp)) {
            $this->error('HYP B2B לא מוגדר (חסר masof / passp)');
            return self::FAILURE;
        }

        $from = $this->option('from');
        $to = $this->option('to') ?: date('d/m/Y');
        $last4 = $this->option('last4');

        $query = [
            'action'   => 'getTransList',
            'Masof'    => $masof,
            'PassP'    => $passp,
            'FromDate' => $from,
            'ToDate'   => $to,
            'UTF8'     => 'True',
            'UTF8out'  => 'True',
        ];

        $this->info("Range: {$from} → {$to}");
        $this->info("Masof: {$masof}");
        $this->line('');

        $response = Http::timeout(30)
            ->withHeaders(['Referer' => $referer])
            ->get($base, $query);

        $body = $response->body();

        $this->line('HTTP status: ' . $response->status());
        $this->line('Body length: ' . strlen($body));
        $this->line(str_repeat('=', 80));
        $this->line('RAW BODY:');
        $this->line($body);
        $this->line(str_repeat('=', 80));

        // ניתוח שורות
        $lines = array_values(array_filter(array_map('trim', explode("\n", $body))));
        $this->info('Lines (split by \\n): ' . count($lines));

        // אם הכל בשורה אחת, ננסה גם & כמפריד עסקאות (ספק מסוף)
        if (count($lines) <= 1 && !empty($body)) {
            $this->warn('Only 1 line returned — trying to parse as single query string...');
            $parsed = [];
            parse_str($body, $parsed);
            $this->line('Parsed keys: ' . implode(', ', array_keys($parsed)));
        }

        $this->line(str_repeat('-', 80));
        foreach ($lines as $i => $line) {
            $parsed = [];
            parse_str($line, $parsed);

            $l4 = $parsed['L4digit'] ?? '';
            if ($last4 && $l4 !== $last4) {
                continue;
            }

            $this->line(sprintf(
                '[%d] Id=%s L4=%s UserId=%s CCode=%s Amount=%s Fild1=%s',
                $i,
                $parsed['Id'] ?? '?',
                $l4,
                $parsed['UserId'] ?? '?',
                $parsed['CCode'] ?? '?',
                $parsed['Amount'] ?? '?',
                $parsed['Fild1'] ?? ''
            ));
        }

        return self::SUCCESS;
    }
}
