<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * אימות דגלים גלובליים Z-Credit (אופציונלי) — פרטי מסוף אמיתיים מוגדרים בממשק המסעדה.
 *
 * @see repository docs/zcredit-pinpad-testing.md
 */
class ZCreditVerifyConfig extends Command
{
    protected $signature = 'zcredit:verify-config';

    protected $description = 'מציג דגלים גלובליים Z-Credit (Mock / בדיקות) — לא מחליף הגדרת מסעדה';

    public function handle(): int
    {
        $mock = (bool) config('services.zcredit.mock');
        $tn = (string) (config('services.zcredit.terminal_number') ?? '');
        $tp = config('services.zcredit.terminal_password');
        $rawPin = (string) (config('services.zcredit.pinpad_id') ?? '');
        $track2 = $rawPin === '' ? '(ריק)' : (preg_match('/^PINPAD/i', $rawPin) ? $rawPin : ('PINPAD' . trim($rawPin)));
        $testMode = (bool) config('services.zcredit.test_mode_enabled');

        $this->info('Z-Credit — דגלים גלובליים (.env)');
        $this->newLine();

        $this->line('○ ZCREDIT_MOCK: ' . ($mock ? 'true (חיובים מדומים בלי HTTP)' : 'false (נדרש מסוף מוגדר במסעדה או ב-.env לכלים)'));
        $this->line('○ ZCREDIT_TEST_MODE (עתידי): ' . ($testMode ? 'true' : 'false'));
        $this->newLine();

        $this->warn('פרטי מסוף לחיובי POS/קיוסק מוגדרים ב־/admin/payment-settings (לכל מסעדה).');
        $this->newLine();

        $this->line('משתני .env אופציונליים (כלים / route בדיקה מקומית):');
        if ($tn === '') {
            $this->line('  ZCREDIT_TERMINAL_NUMBER: (ריק)');
        } else {
            $this->line('  TerminalNumber: ' . $this->maskTerminal($tn));
        }
        if ($tp === null || $tp === '') {
            $this->line('  ZCREDIT_TERMINAL_PASSWORD: (ריק)');
        } else {
            $this->line('  Password: מוגדר (מוסתר)');
        }
        $this->line('  Track2 מחושב מ־PINPAD: ' . $track2);

        $this->newLine();
        $this->info('מדריך: docs/zcredit-pinpad-testing.md');

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
