<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_events', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id');
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('event_type'); // order_created, payment_pending, payment_success, payment_failed, webhook_received, status_changed, gift_applied, promotion_applied, order_cancelled, manual_edit, retry_payment
            $table->string('actor_type'); // system, customer, admin, webhook
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('old_status')->nullable();
            $table->string('new_status')->nullable();
            $table->json('payload')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->uuid('correlation_id')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('order_id');
            $table->index(['tenant_id', 'created_at']);
            $table->index('correlation_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_events');
    }
};
