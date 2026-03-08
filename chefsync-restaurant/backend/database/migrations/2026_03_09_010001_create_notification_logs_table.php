<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_logs', function (Blueprint $table) {
            $table->id();
            $table->string('channel')->default('push'); // push, email, sms
            $table->string('type'); // broadcast, daily_report, order_alert, system
            $table->string('title');
            $table->text('body')->nullable();
            $table->unsignedBigInteger('sender_id')->nullable(); // user who sent
            $table->json('target_restaurant_ids')->nullable();
            $table->unsignedInteger('tokens_targeted')->default(0);
            $table->unsignedInteger('sent_ok')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('type');
            $table->index('sender_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_logs');
    }
};
