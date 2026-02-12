<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id')->index();
            $table->unsignedBigInteger('restaurant_id');
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->dateTime('start_at')->nullable();
            $table->dateTime('end_at')->nullable();
            $table->time('active_hours_start')->nullable();
            $table->time('active_hours_end')->nullable();
            $table->json('active_days')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('priority')->default(0);
            $table->boolean('auto_apply')->default(true);
            $table->boolean('gift_required')->default(false);
            $table->boolean('stackable')->default(false);
            $table->timestamps();

            $table->index(['tenant_id', 'is_active']);
            $table->foreign('restaurant_id')->references('id')->on('restaurants')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotions');
    }
};
