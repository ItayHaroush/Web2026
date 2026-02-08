<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_rules', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id')->index();
            $table->string('target_type', 30)->default('base');
            $table->unsignedBigInteger('target_id');
            $table->enum('scope_type', ['category', 'item']);
            $table->unsignedBigInteger('scope_id');
            $table->decimal('price_delta', 8, 2)->default(0);
            $table->timestamps();

            $table->unique(['target_type', 'target_id', 'scope_type', 'scope_id'], 'price_rules_unique');
            $table->index(['tenant_id', 'target_type', 'scope_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_rules');
    }
};
