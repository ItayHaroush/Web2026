<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_errors', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id')->nullable();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->uuid('correlation_id')->nullable();
            $table->string('error_type'); // exception, payment_failure, timeout, sms_failure, webhook_error
            $table->text('message');
            $table->longText('stack_trace')->nullable();
            $table->json('context')->nullable();
            $table->string('severity')->default('error'); // info, warning, error, critical
            $table->boolean('resolved')->default(false);
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['severity', 'created_at']);
            $table->index('correlation_id');
            $table->index(['resolved', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_errors');
    }
};
