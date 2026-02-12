<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotion_rewards', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('promotion_id');
            $table->enum('reward_type', ['free_item', 'discount_percent', 'discount_fixed', 'fixed_price']);
            $table->unsignedBigInteger('reward_category_id')->nullable();
            $table->decimal('reward_value', 8, 2)->nullable();
            $table->integer('max_selectable')->default(1);
            $table->timestamps();

            $table->foreign('promotion_id')->references('id')->on('promotions')->onDelete('cascade');
            $table->foreign('reward_category_id')->references('id')->on('categories')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_rewards');
    }
};
