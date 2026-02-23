<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('print_devices', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id');
            $table->unsignedBigInteger('restaurant_id');
            $table->string('name', 100);
            $table->string('role', 20)->default('kitchen');
            $table->string('device_token', 64)->unique();
            $table->string('printer_ip', 45)->nullable();
            $table->integer('printer_port')->default(9100);
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_seen_at')->nullable();
            $table->text('last_error_message')->nullable();
            $table->timestamp('last_error_at')->nullable();
            $table->timestamps();

            $table->index('tenant_id', 'idx_print_devices_tenant');
            $table->index(['restaurant_id', 'role'], 'idx_print_devices_restaurant_role');
            $table->foreign('restaurant_id')->references('id')->on('restaurants')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('print_devices');
    }
};
