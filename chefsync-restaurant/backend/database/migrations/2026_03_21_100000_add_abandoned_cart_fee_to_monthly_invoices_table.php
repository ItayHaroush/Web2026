<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monthly_invoices', function (Blueprint $table) {
            $table->decimal('abandoned_cart_fee', 10, 2)->default(0)->after('commission_fee');
        });
    }

    public function down(): void
    {
        Schema::table('monthly_invoices', function (Blueprint $table) {
            $table->dropColumn('abandoned_cart_fee');
        });
    }
};
