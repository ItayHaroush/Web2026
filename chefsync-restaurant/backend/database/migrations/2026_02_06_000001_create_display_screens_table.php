<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * מסכי תצוגה - יצירת טבלאות
     */
    public function up(): void
    {
        Schema::create('display_screens', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id');
            $table->unsignedBigInteger('restaurant_id');
            $table->string('name');
            $table->uuid('token')->unique();
            $table->enum('display_type', ['static', 'rotating'])->default('static');
            $table->string('design_preset', 50)->default('classic');
            $table->enum('content_mode', ['manual', 'auto_available'])->default('auto_available');
            $table->integer('refresh_interval')->default(30);
            $table->integer('rotation_speed')->default(5);
            $table->boolean('is_active')->default(true);
            $table->boolean('show_branding')->default(true);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->index('tenant_id');
            $table->foreign('restaurant_id')->references('id')->on('restaurants')->onDelete('cascade');
        });

        Schema::create('display_screen_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('display_screen_id');
            $table->unsignedBigInteger('menu_item_id');
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('display_screen_id')->references('id')->on('display_screens')->onDelete('cascade');
            $table->foreign('menu_item_id')->references('id')->on('menu_items')->onDelete('cascade');
            $table->unique(['display_screen_id', 'menu_item_id']);
        });
    }

    /**
     * ביטול המיגרציה
     */
    public function down(): void
    {
        Schema::dropIfExists('display_screen_items');
        Schema::dropIfExists('display_screens');
    }
};
