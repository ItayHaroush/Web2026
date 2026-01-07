<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            // שדות מנוי ותשלום
            $table->enum('subscription_status', ['trial', 'active', 'expired', 'cancelled', 'suspended'])
                ->default('trial')
                ->after('is_override_status');
            
            $table->timestamp('trial_ends_at')->nullable()->after('subscription_status');
            $table->timestamp('subscription_ends_at')->nullable()->after('trial_ends_at');
            
            $table->enum('subscription_plan', ['monthly', 'yearly'])->nullable()->after('subscription_ends_at');
            
            // פרטי תשלום טרנזילה
            $table->string('tranzila_terminal_name')->nullable()->after('subscription_plan');
            $table->string('tranzila_token')->nullable()->after('tranzila_terminal_name');
            $table->string('payment_method_last4')->nullable()->after('tranzila_token');
            $table->string('payment_method_type')->nullable()->after('payment_method_last4'); // Visa, Mastercard, etc.
            
            // מעקב חיובים
            $table->decimal('monthly_price', 10, 2)->default(600.00)->after('payment_method_type');
            $table->decimal('yearly_price', 10, 2)->default(5000.00)->after('monthly_price');
            $table->timestamp('last_payment_at')->nullable()->after('yearly_price');
            $table->timestamp('next_payment_at')->nullable()->after('last_payment_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn([
                'subscription_status',
                'trial_ends_at',
                'subscription_ends_at',
                'subscription_plan',
                'tranzila_terminal_name',
                'tranzila_token',
                'payment_method_last4',
                'payment_method_type',
                'monthly_price',
                'yearly_price',
                'last_payment_at',
                'next_payment_at',
            ]);
        });
    }
};
