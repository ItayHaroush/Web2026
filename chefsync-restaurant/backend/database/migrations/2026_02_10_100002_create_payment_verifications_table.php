<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * טבלת לוג לאימות מסופי תשלום (1 ש"ח)
     */
    public function up(): void
    {
        if (!Schema::hasTable('payment_verifications')) {
            Schema::create('payment_verifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('restaurant_id')->constrained()->onDelete('cascade');
                $table->decimal('amount', 10, 2)->default(1.00);
                $table->string('transaction_id')->nullable();
                $table->string('status')->default('pending'); // pending, success, failed
                $table->string('initiated_by'); // auto, owner, super_admin
                $table->text('error_message')->nullable();
                $table->timestamps();

                $table->index('restaurant_id');
                $table->index('status');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_verifications');
    }
};
