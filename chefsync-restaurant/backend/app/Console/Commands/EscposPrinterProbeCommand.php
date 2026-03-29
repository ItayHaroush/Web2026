<?php

namespace App\Console\Commands;

use App\Services\Printing\ThermalHebrewEscPosEncoder;
use Illuminate\Console\Command;

/**
 * בדיקת ESC/POS על המדפסת — אותה המרת RTL+CP862 כמו NetworkPrinterAdapter (ברירת מחדל).
 */
class EscposPrinterProbeCommand extends Command
{
    protected $signature = 'printer:escpos-probe
                            {ip : כתובת IP של המדפסת}
                            {--port=9100 : פורט TCP}
                            {--cp=10 : ערך n אחרי ESC t (עשרוני, למשל 10 ל־BTP-S80)}
                            {--text=שלום עולם : טקסט UTF-8 לבדיקה}
                            {--no-rtl : בלי הכנת RTL (כמו php -r גולמי — יוצא הפוך על רוב המדפסות)}
                            {--no-cut : בלי GS V 0 בסוף}';

    protected $description = 'שולח ESC @ + ESC t n + טקסט (CP862) למדפסת תרמית — לבדיקת טבלה/קידוד';

    public function handle(): int
    {
        $ip = (string) $this->argument('ip');
        $port = (int) $this->option('port');
        $cp = max(0, min(255, (int) $this->option('cp')));
        $text = (string) $this->option('text');
        $applyRtl = ! $this->option('no-rtl');

        $encoder = new ThermalHebrewEscPosEncoder;
        $body = $encoder->encodeUtf8ToCp862($text, $applyRtl);

        $bin = "\x1B\x40\x1B\x74".chr($cp).$body."\n\n";
        if (! $this->option('no-cut')) {
            $bin .= "\x1D\x56\x00";
        }

        $fp = @fsockopen($ip, $port, $errno, $errstr, 8);
        if (! $fp) {
            $this->error("Connection failed: {$errstr} ({$errno})");

            return self::FAILURE;
        }

        fwrite($fp, $bin);
        fclose($fp);

        $this->info('Sent '.strlen($bin).' bytes (rtl='.($applyRtl ? 'on' : 'off').", cp={$cp}).");

        return self::SUCCESS;
    }
}
