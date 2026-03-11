<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_id');
            $table->unsignedBigInteger('restaurant_id');
            $table->string('provider', 50)->default('zcredit');
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('ILS');
            $table->string('status', 30)->default('pending'); // pending, approved, declined, error
            $table->string('transaction_id')->nullable();
            $table->string('approval_code')->nullable();
            $table->string('voucher_number')->nullable();
            $table->json('provider_response')->nullable();
            $table->string('error_message')->nullable();
            $table->timestamps();

            $table->index('order_id');
            $table->index('restaurant_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
