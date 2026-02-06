<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('printers', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id');
            $table->unsignedBigInteger('restaurant_id');
            $table->string('name', 100);
            $table->string('type', 20)->default('network');
            $table->string('ip_address', 45)->nullable();
            $table->integer('port')->default(9100)->nullable();
            $table->string('paper_width', 10)->default('80mm');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('tenant_id', 'idx_printers_tenant');
            $table->index('restaurant_id', 'idx_printers_restaurant');
            $table->foreign('restaurant_id')->references('id')->on('restaurants')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('printers');
    }
};
