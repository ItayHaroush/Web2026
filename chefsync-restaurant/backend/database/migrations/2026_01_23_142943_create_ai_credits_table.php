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
        Schema::create('ai_credits', function (Blueprint $table) {
            $table->id();

            // Multi-tenant
            $table->string('tenant_id')->unique();
            $table->unsignedBigInteger('restaurant_id')->unique();

            // Credits tracking
            $table->enum('tier', ['free', 'basic', 'pro', 'enterprise'])->default('free');
            $table->integer('monthly_limit'); // Based on tier
            $table->integer('credits_used')->default(0); // This month
            $table->integer('credits_remaining'); // Calculated

            // Billing period
            $table->date('billing_cycle_start');
            $table->date('billing_cycle_end');
            $table->timestamp('last_reset_at')->nullable();

            // Rate limiting (prevent abuse)
            $table->integer('requests_this_minute')->default(0);
            $table->timestamp('minute_window_start')->nullable();

            // Statistics (all-time)
            $table->integer('total_credits_used')->default(0);
            $table->integer('total_requests')->default(0);

            $table->timestamps();

            // Indexes
            $table->index(['tenant_id']);
            $table->index(['restaurant_id']);
            $table->index(['tier']);

            // Foreign key
            $table->foreign('restaurant_id')->references('id')->on('restaurants')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_credits');
    }
};
