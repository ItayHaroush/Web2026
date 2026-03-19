<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monthly_invoices', function (Blueprint $table) {
            $table->decimal('original_base_fee', 10, 2)->nullable()->after('base_fee');
            $table->decimal('original_abandoned_cart_fee', 10, 2)->nullable()->after('abandoned_cart_fee');
        });
    }

    public function down(): void
    {
        Schema::table('monthly_invoices', function (Blueprint $table) {
            $table->dropColumn(['original_base_fee', 'original_abandoned_cart_fee']);
        });
    }
};
