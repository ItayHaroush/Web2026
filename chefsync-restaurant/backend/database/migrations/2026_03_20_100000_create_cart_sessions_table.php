<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cart_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id');
            $table->unsignedBigInteger('restaurant_id');
            $table->string('customer_phone', 20)->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->json('cart_data')->nullable();
            $table->string('customer_name', 100)->nullable();
            $table->decimal('total_amount', 10, 2)->default(0);
            $table->timestamp('reminded_at')->nullable();
            $table->unsignedBigInteger('completed_order_id')->nullable();
            $table->timestamps();

            $table->index('tenant_id');
            $table->index('restaurant_id');
            $table->index('updated_at');
            $table->index('reminded_at');
            $table->index(['tenant_id', 'customer_phone']);
            $table->index(['tenant_id', 'customer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cart_sessions');
    }
};
