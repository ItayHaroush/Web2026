<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * B2C אשראי: הזמנה נוצרת עם status=awaiting_payment לפני תשלום HYP.
 * חייב להופיע ב-ENUM (אחרת MySQL: 1265 Data truncated for column 'status').
 */
return new class extends Migration
{
    public function up(): void
    {
        $enumValues = [
            'awaiting_payment',
            'pending',
            'received',
            'preparing',
            'ready',
            'delivering',
            'delivered',
            'cancelled',
        ];

        DB::statement(
            sprintf(
                "ALTER TABLE `orders` MODIFY COLUMN `status` ENUM('%s') NOT NULL DEFAULT 'received'",
                implode("','", $enumValues)
            )
        );
    }

    public function down(): void
    {
        DB::table('orders')
            ->where('status', 'awaiting_payment')
            ->update(['status' => 'pending']);

        $enumValues = [
            'pending',
            'received',
            'preparing',
            'ready',
            'delivering',
            'delivered',
            'cancelled',
        ];

        DB::statement(
            sprintf(
                "ALTER TABLE `orders` MODIFY COLUMN `status` ENUM('%s') NOT NULL DEFAULT 'received'",
                implode("','", $enumValues)
            )
        );
    }
};
