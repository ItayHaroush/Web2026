<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('promotion_discount', 10, 2)->default(0)->after('total_amount');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->unsignedBigInteger('promotion_id')->nullable()->after('price_at_order');
            $table->boolean('is_gift')->default(false)->after('promotion_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('promotion_discount');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['promotion_id', 'is_gift']);
        });
    }
};
