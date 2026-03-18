<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('phone', 15)->unique();
            $table->string('name');
            $table->string('email')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('email_verification_token', 64)->nullable();
            $table->string('google_id')->nullable()->unique();
            $table->string('pin_hash')->nullable();
            $table->string('default_delivery_address')->nullable();
            $table->decimal('default_delivery_lat', 10, 7)->nullable();
            $table->decimal('default_delivery_lng', 10, 7)->nullable();
            $table->string('default_delivery_notes', 500)->nullable();
            $table->string('preferred_payment_method')->nullable();
            $table->boolean('is_registered')->default(false);
            $table->timestamp('last_order_at')->nullable();
            $table->unsignedInteger('total_orders')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
