<?php

namespace App\Console\Commands;

use App\Models\Restaurant;
use App\Services\HypPaymentService;
use Illuminate\Console\Command;

/**
 * מציג את ה-URL המלא של Pay Page כפי שנשלח ל-HYP, לצורך תמיכה.
 *
 * php artisan hyp:show-paypage 9 [--amount=99]
 */
class HypShowPayPage extends Command
{
    protected $signature = 'hyp:show-paypage {restaurant_id} {--amount=99}';
    protected $description = 'בונה ומדפיס את URL של HYP Pay Page עבור מסעדה (לצורך תמיכת Hyp)';

    public function handle(HypPaymentService $svc): int
    {
        $rid = (int) $this->argument('restaurant_id');
        $amount = (float) $this->option('amount');

        $rest = Restaurant::withoutGlobalScope('tenant')->find($rid);
        if (!$rest) {
            $this->error("Restaurant {$rid} not found");
            return self::FAILURE;
        }

        if (!$svc->isConfigured()) {
            $this->error('HYP B2B not configured');
            return self::FAILURE;
        }

        $backendUrl = rtrim(config('app.url', 'http://localhost:8000'), '/');

        $payParams = [
            'Masof'      => $svc->getMasof(),
            'Amount'     => number_format($amount, 2, '.', ''),
            'Order'      => "sub_{$rid}",
            'Info'       => 'TakeEat - Basic Monthly',
            'Coin'       => $svc->getCoin(),
            'Tash'       => '1',
            'UserId'     => $rest->hypSoftNationalIdDigits(),
            'PageLang'   => 'HEB',
            'UTF8'       => 'True',
            'UTF8out'    => 'True',
            'MoreData'   => 'True',
            'Sign'       => 'True',
            'tmp'        => '5',
            'Fild1'      => (string) $rid,
            'Fild2'      => 'basic',
            'Fild3'      => 'monthly',
            'SuccessUrl' => "{$backendUrl}/api/payments/hyp/subscription/success?rid={$rid}",
            'ErrorUrl'   => "{$backendUrl}/api/payments/hyp/subscription/error?rid={$rid}",
            'ClientName' => $rest->name,
        ];

        $signResult = $svc->getSignature($payParams);
        if (!($signResult['success'] ?? false)) {
            $this->error('Signature failed: ' . ($signResult['error'] ?? 'unknown'));
            return self::FAILURE;
        }

        $payParams['signature'] = $signResult['signature'];
        $payParams['action']    = 'pay';
        $payParams['PassP']     = $svc->getPassp();

        $url = $svc->getBaseUrl() . '?' . http_build_query($payParams);

        $this->line('');
        $this->info('===== HYP Pay Page URL =====');
        $this->line($url);
        $this->info('===== End =====');
        $this->line('');
        $this->line('Restaurant: ' . $rest->name . ' (#' . $rest->id . ')');
        $this->line('Masof: ' . $svc->getMasof());
        $this->line('UserId sent: ' . $rest->hypSoftNationalIdDigits());

        return self::SUCCESS;
    }
}
