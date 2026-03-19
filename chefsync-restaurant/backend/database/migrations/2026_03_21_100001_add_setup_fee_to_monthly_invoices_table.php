<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monthly_invoices', function (Blueprint $table) {
            $table->decimal('setup_fee', 10, 2)->default(0)->after('abandoned_cart_fee');
        });
    }

    public function down(): void
    {
        Schema::table('monthly_invoices', function (Blueprint $table) {
            $table->dropColumn('setup_fee');
        });
    }
};
