<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monthly_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('restaurant_id')->constrained()->onDelete('cascade');
            $table->string('month', 7); // '2026-02'
            $table->decimal('base_fee', 10, 2)->default(0);
            $table->decimal('commission_fee', 10, 2)->default(0);
            $table->decimal('total_due', 10, 2)->default(0);
            $table->integer('order_count')->default(0);
            $table->decimal('order_revenue', 10, 2)->default(0);
            $table->decimal('commission_percent', 5, 2)->default(0);
            $table->string('billing_model', 20)->default('flat');
            $table->string('currency', 3)->default('ILS');
            $table->enum('status', ['draft', 'pending', 'paid', 'overdue'])->default('draft');
            $table->string('payment_link')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['restaurant_id', 'month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monthly_invoices');
    }
};
