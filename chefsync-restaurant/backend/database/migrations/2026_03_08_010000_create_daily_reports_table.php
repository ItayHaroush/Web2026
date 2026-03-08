<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_reports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('restaurant_id');
            $table->string('tenant_id');
            $table->date('date');
            $table->unsignedInteger('total_orders')->default(0);
            $table->decimal('total_revenue', 10, 2)->default(0);
            $table->unsignedInteger('pickup_orders')->default(0);
            $table->unsignedInteger('delivery_orders')->default(0);
            $table->decimal('cash_total', 10, 2)->default(0);
            $table->decimal('credit_total', 10, 2)->default(0);
            $table->unsignedInteger('cancelled_orders')->default(0);
            $table->decimal('cancelled_total', 10, 2)->default(0);
            $table->decimal('avg_order_value', 10, 2)->default(0);
            $table->longText('report_json')->nullable();
            $table->timestamps();

            $table->unique(['restaurant_id', 'date']);
            $table->index('date');
            $table->index('tenant_id');

            $table->foreign('restaurant_id')->references('id')->on('restaurants')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_reports');
    }
};
