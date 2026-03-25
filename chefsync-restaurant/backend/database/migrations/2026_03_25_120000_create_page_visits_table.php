<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('page_visits', function (Blueprint $table) {
            $table->id();
            $table->string('page_key', 64);
            $table->string('tenant_id', 64)->nullable();
            $table->unsignedBigInteger('restaurant_id')->nullable();
            $table->uuid('visitor_uuid')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('visitor_kind', 32);
            $table->unsignedBigInteger('admin_user_id')->nullable();
            $table->string('path', 512)->nullable();
            $table->string('referrer', 512)->nullable();
            $table->timestamps();

            $table->index(['page_key', 'created_at']);
            $table->index(['tenant_id', 'created_at']);
            $table->index(['visitor_uuid', 'created_at']);
            $table->index(['visitor_kind', 'created_at']);
            $table->index('customer_id');
            $table->index('admin_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('page_visits');
    }
};
