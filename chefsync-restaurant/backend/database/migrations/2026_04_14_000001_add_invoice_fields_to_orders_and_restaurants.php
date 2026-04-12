<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // שדות חשבונית על הזמנות
        Schema::table('orders', function (Blueprint $table) {
            $table->string('invoice_number')->nullable()->after('payment_amount');
            $table->timestamp('invoice_generated_at')->nullable()->after('invoice_number');
        });

        // טוגל הפעלת חשבוניות למסעדה
        Schema::table('restaurants', function (Blueprint $table) {
            $table->boolean('ezcount_invoices_enabled')->default(false)->after('hyp_terminal_verified_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['invoice_number', 'invoice_generated_at']);
        });

        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn('ezcount_invoices_enabled');
        });
    }
};
