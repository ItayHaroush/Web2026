<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_action_logs', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id')->index();
            $table->unsignedBigInteger('restaurant_id')->index();
            $table->unsignedBigInteger('user_id');
            $table->string('action_id', 100);
            $table->json('params');
            $table->json('result')->nullable();
            $table->enum('status', ['success', 'failed', 'error'])->default('success');
            $table->timestamps();

            $table->index(['restaurant_id', 'created_at']);
            $table->index(['action_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_action_logs');
    }
};
