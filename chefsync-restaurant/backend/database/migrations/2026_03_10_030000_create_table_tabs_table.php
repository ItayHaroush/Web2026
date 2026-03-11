<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('table_tabs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('restaurant_id');
            $table->string('table_number', 20);
            $table->unsignedBigInteger('order_id')->nullable();
            $table->string('status', 20)->default('open'); // open, closed
            $table->unsignedBigInteger('opened_by');
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['restaurant_id', 'status']);
            $table->index('order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('table_tabs');
    }
};
