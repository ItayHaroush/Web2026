<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('israeli_holidays', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('hebrew_date_info', 100)->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->unsignedSmallInteger('year');
            $table->enum('type', ['full_closure', 'half_day', 'eve', 'info_only'])->default('full_closure');
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index(['year', 'start_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('israeli_holidays');
    }
};
