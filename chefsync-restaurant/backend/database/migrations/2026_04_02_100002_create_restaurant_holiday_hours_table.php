<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('restaurant_holiday_hours', function (Blueprint $table) {
            $table->id();
            $table->foreignId('restaurant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('holiday_id')->constrained('israeli_holidays')->cascadeOnDelete();
            $table->enum('status', ['open', 'closed', 'special_hours'])->default('closed');
            $table->time('open_time')->nullable();
            $table->time('close_time')->nullable();
            $table->text('note')->nullable();
            $table->dateTime('responded_at')->nullable();
            $table->timestamps();

            $table->unique(['restaurant_id', 'holiday_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('restaurant_holiday_hours');
    }
};
