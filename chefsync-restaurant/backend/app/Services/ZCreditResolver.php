<?php

namespace App\Services;

use App\Models\Kiosk;
use App\Models\Order;
use App\Models\PaymentTerminal;
use App\Models\PosSession;
use App\Models\Restaurant;

/**
 * בוחר מופע ZCredit לפי הקשר: קיוסק / סשן POS / מסוף ברירת מחדל / שדות מסעדה / .env
 */
class ZCreditResolver
{
    public function forOrder(Order $order, ?PosSession $posSession = null): ZCreditService
    {
        $restaurant = Restaurant::withoutGlobalScopes()->find($order->restaurant_id);
        if (!$restaurant) {
            return app(ZCreditService::class);
        }

        if ($order->kiosk_id) {
            $kiosk = Kiosk::withoutGlobalScopes()
                ->where('restaurant_id', $restaurant->id)
                ->find($order->kiosk_id);
            if ($kiosk && $kiosk->payment_terminal_id) {
                $terminal = PaymentTerminal::where('restaurant_id', $restaurant->id)
                    ->find($kiosk->payment_terminal_id);
                if ($terminal) {
                    return ZCreditService::forPaymentTerminal($terminal);
                }
            }
        }

        return $this->forRestaurantContext($restaurant, $posSession);
    }

    public function forRestaurantContext(Restaurant $restaurant, ?PosSession $posSession = null): ZCreditService
    {
        if ($posSession && $posSession->payment_terminal_id) {
            $terminal = PaymentTerminal::where('restaurant_id', $restaurant->id)
                ->find($posSession->payment_terminal_id);
            if ($terminal) {
                return ZCreditService::forPaymentTerminal($terminal);
            }
        }

        if ($restaurant->default_payment_terminal_id) {
            $terminal = PaymentTerminal::where('restaurant_id', $restaurant->id)
                ->find($restaurant->default_payment_terminal_id);
            if ($terminal) {
                return ZCreditService::forPaymentTerminal($terminal);
            }
        }

        return ZCreditService::forRestaurant($restaurant);
    }
}
