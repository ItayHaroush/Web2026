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
        Schema::create('ai_usage_logs', function (Blueprint $table) {
            $table->id();

            // Multi-tenant tracking
            $table->string('tenant_id');
            $table->unsignedBigInteger('restaurant_id');
            $table->unsignedBigInteger('user_id')->nullable(); // Admin who triggered

            // Feature tracking
            $table->string('feature'); // description_generator, menu_recommendations, etc.
            $table->string('action'); // generate, regenerate, recommend

            // Cost & Performance
            $table->integer('credits_used')->default(1);
            $table->integer('tokens_used')->nullable();
            $table->integer('response_time_ms')->nullable(); // Latency

            // Cache tracking
            $table->boolean('cached')->default(false);
            $table->string('cache_key')->nullable();

            // Request/Response data (for debugging)
            $table->text('prompt')->nullable(); // Store if detailed logging enabled
            $table->text('response')->nullable();
            $table->json('metadata')->nullable(); // Additional context (menu_item_id, etc.)

            // Status
            $table->enum('status', ['success', 'error', 'timeout'])->default('success');
            $table->text('error_message')->nullable();

            $table->timestamps();

            // Indexes for fast queries
            $table->index(['tenant_id', 'created_at']);
            $table->index(['restaurant_id', 'feature']);
            $table->index(['user_id']);
            $table->index(['status']);

            // Foreign keys
            $table->foreign('restaurant_id')->references('id')->on('restaurants')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_usage_logs');
    }
};
