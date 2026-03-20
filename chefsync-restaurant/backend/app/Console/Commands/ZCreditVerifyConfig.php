<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * אימות הגדרות Z-Credit לפני בדיקות PinPad — ללא קריאת רשת וללא חיוב.
 *
 * @see repository docs/zcredit-pinpad-testing.md
 */
class ZCreditVerifyConfig extends Command
{
    protected $signature = 'zcredit:verify-config';

    protected $description = 'בודק שמשתני ZCREDIT_* מוגדרים ומציג Track2 מחושב (מסוכים)';

    public function handle(): int
    {
        $tn = (string) config('services.zcredit.terminal_number');
        $tp = config('services.zcredit.terminal_password');
        $rawPin = (string) config('services.zcredit.pinpad_id', '11002');
        $track2 = preg_match('/^PINPAD/i', $rawPin) ? $rawPin : ('PINPAD' . trim($rawPin));
        $testMode = (bool) config('services.zcredit.test_mode_enabled');

        $this->info('Z-Credit — אימות קונפיגורציה (ללא HTTP)');
        $this->newLine();

        $issues = 0;

        if ($tn === '') {
            $this->warn('✗ ZCREDIT_TERMINAL_NUMBER ריק');
            $issues++;
        } else {
            $this->line('✓ TerminalNumber: ' . $this->maskTerminal($tn));
        }

        if ($tp === null || $tp === '') {
            $this->warn('✗ ZCREDIT_TERMINAL_PASSWORD ריק');
            $issues++;
        } else {
            $this->line('✓ Password: מוגדר (מוסתר)');
        }

        $this->line('✓ Track2 (מחושב ל־PinPad): ' . $track2);
        $this->line('  (מקור ZCREDIT_PINPAD_ID: ' . ($rawPin !== '' ? $rawPin : '(ריק)') . ')');

        $this->line('○ ZCREDIT_TEST_MODE (עתידי): ' . ($testMode ? 'true' : 'false'));

        $this->newLine();
        if ($issues > 0) {
            $this->error('יש לתקן .env לפי docs/zcredit-pinpad-testing.md');

            return 1;
        }

        $this->info('מוכן לבדיקת PinPad דרך POS — ודא שהמכשיר מחובר לפי Z-Credit.');

        return 0;
    }

    private function maskTerminal(string $terminal): string
    {
        $len = strlen($terminal);
        if ($len <= 4) {
            return str_repeat('*', $len);
        }

        return substr($terminal, 0, 2) . str_repeat('*', $len - 4) . substr($terminal, -2);
    }
}
