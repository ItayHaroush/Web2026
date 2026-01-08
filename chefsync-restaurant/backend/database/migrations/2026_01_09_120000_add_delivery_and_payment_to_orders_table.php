<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('delivery_method', ['pickup', 'delivery'])->default('pickup')->after('customer_phone');
            $table->enum('payment_method', ['cash'])->default('cash')->after('delivery_method');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['delivery_method', 'payment_method']);
        });
    }
};
