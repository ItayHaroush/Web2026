<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_push_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('tenant_id')->index();
            $table->string('token')->unique();
            $table->string('device_label')->nullable();
            $table->string('platform', 50)->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'tenant_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_push_tokens');
    }
};
