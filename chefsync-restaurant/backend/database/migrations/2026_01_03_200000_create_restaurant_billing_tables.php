<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('restaurant_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('restaurant_id')->constrained()->onDelete('cascade');
            $table->decimal('monthly_fee', 10, 2)->default(0);
            $table->unsignedTinyInteger('billing_day')->default(1); // day of month (1-28)
            $table->string('currency', 3)->default('ILS');
            $table->enum('status', ['active', 'suspended', 'cancelled'])->default('active');
            $table->decimal('outstanding_amount', 10, 2)->default(0);
            $table->timestamp('next_charge_at')->nullable();
            $table->timestamp('last_paid_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('restaurant_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('restaurant_id')->constrained()->onDelete('cascade');
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('ILS');
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('method')->nullable();
            $table->string('reference')->nullable();
            $table->enum('status', ['paid', 'pending', 'failed'])->default('paid');
            $table->text('failure_reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('restaurant_payments');
        Schema::dropIfExists('restaurant_subscriptions');
    }
};
