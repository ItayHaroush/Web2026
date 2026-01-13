<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'delivery_method')) {
                $table->enum('delivery_method', ['pickup', 'delivery'])->default('pickup')->after('customer_phone');
            }

            if (!Schema::hasColumn('orders', 'payment_method')) {
                $table->enum('payment_method', ['cash'])->default('cash')->after('delivery_method');
            }

            if (!Schema::hasColumn('orders', 'delivery_address')) {
                $table->string('delivery_address')->nullable()->after('payment_method');
            }

            if (!Schema::hasColumn('orders', 'delivery_notes')) {
                $table->text('delivery_notes')->nullable()->after('delivery_address');
            }
        });

        $this->extendStatusEnum();
    }

    public function down(): void
    {
        $this->resetStatusEnum();

        Schema::table('orders', function (Blueprint $table) {
            $columns = ['delivery_method', 'payment_method', 'delivery_address', 'delivery_notes'];
            foreach ($columns as $column) {
                if (Schema::hasColumn('orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    protected function extendStatusEnum(): void
    {
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
                "ALTER TABLE `orders` MODIFY COLUMN `status` ENUM('%s') DEFAULT 'received'",
                implode("','", $enumValues)
            )
        );
    }

    protected function resetStatusEnum(): void
    {
        $enumValues = ['received', 'preparing', 'ready', 'delivered'];

        DB::statement(
            sprintf(
                "ALTER TABLE `orders` MODIFY COLUMN `status` ENUM('%s') DEFAULT 'received'",
                implode("','", $enumValues)
            )
        );
    }
};
