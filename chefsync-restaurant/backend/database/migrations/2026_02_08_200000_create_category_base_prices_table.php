<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('category_base_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->onDelete('cascade');
            $table->foreignId('restaurant_variant_id')->constrained('restaurant_variants')->onDelete('cascade');
            $table->string('tenant_id')->index();
            $table->decimal('price_delta', 8, 2)->default(0);
            $table->timestamps();

            $table->unique(['category_id', 'restaurant_variant_id'], 'cat_base_unique');
            $table->index(['tenant_id', 'category_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('category_base_prices');
    }
};
