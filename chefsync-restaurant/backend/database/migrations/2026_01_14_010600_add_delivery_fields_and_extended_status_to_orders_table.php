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
            $table->enum('delivery_method', ['pickup', 'delivery'])->default('pickup')->after('customer_phone');
            $table->enum('payment_method', ['cash'])->default('cash')->after('delivery_method');
            $table->string('delivery_address')->nullable()->after('payment_method');
            $table->text('delivery_notes')->nullable()->after('delivery_address');
        });

        DB::statement("ALTER TABLE `orders` MODIFY COLUMN `status` ENUM('pending','received','preparing','ready','delivering','delivered','cancelled') DEFAULT 'received'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE `orders` MODIFY COLUMN `status` ENUM('received','preparing','ready','delivered') DEFAULT 'received'");

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['delivery_method', 'payment_method', 'delivery_address', 'delivery_notes']);
        });
    }
};
