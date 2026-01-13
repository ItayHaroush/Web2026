<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('restaurant_addons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('addon_group_id')->constrained('restaurant_addon_groups')->onDelete('cascade');
            $table->foreignId('restaurant_id')->constrained()->onDelete('cascade');
            $table->string('tenant_id')->index();
            $table->string('name');
            $table->decimal('price_delta', 8, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['addon_group_id', 'restaurant_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('restaurant_addons');
    }
};
