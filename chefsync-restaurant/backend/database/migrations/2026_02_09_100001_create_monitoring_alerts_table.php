<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monitoring_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id')->index();
            $table->unsignedBigInteger('restaurant_id')->index();
            $table->string('alert_type', 50);
            $table->string('title');
            $table->text('body');
            $table->enum('severity', ['info', 'warning', 'critical'])->default('info');
            $table->json('metadata')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamps();

            $table->index(['restaurant_id', 'is_read', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monitoring_alerts');
    }
};
