<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kiosks', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id');
            $table->unsignedBigInteger('restaurant_id');
            $table->string('name', 100);
            $table->char('token', 36)->unique();
            $table->boolean('is_active')->default(true);

            // Design
            $table->json('design_options')->nullable();

            // Ordering config
            $table->boolean('require_name')->default(false);

            // Connection tracking
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->index('tenant_id', 'idx_kiosks_tenant');
            $table->index('restaurant_id', 'idx_kiosks_restaurant');
            $table->foreign('restaurant_id')->references('id')->on('restaurants')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kiosks');
    }
};
