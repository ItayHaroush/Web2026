<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('print_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id');
            $table->unsignedBigInteger('restaurant_id');
            $table->unsignedBigInteger('printer_id');
            $table->unsignedBigInteger('order_id');
            $table->string('status', 20)->default('pending');
            $table->json('payload')->nullable();
            $table->text('error_message')->nullable();
            $table->integer('attempts')->default(0);
            $table->timestamps();

            $table->index('tenant_id', 'idx_print_jobs_tenant');
            $table->index('restaurant_id', 'idx_print_jobs_restaurant');
            $table->index(['printer_id', 'status'], 'idx_print_jobs_printer_status');
            $table->foreign('restaurant_id')->references('id')->on('restaurants')->onDelete('cascade');
            $table->foreign('printer_id')->references('id')->on('printers')->onDelete('cascade');
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('print_jobs');
    }
};
