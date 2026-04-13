<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->text('ezcount_api_key')->nullable()->after('ezcount_invoices_enabled');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('invoice_pdf_url', 500)->nullable()->after('invoice_generated_at');
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn('ezcount_api_key');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('invoice_pdf_url');
        });
    }
};
