<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotion_rewards', function (Blueprint $table) {
            $table->unsignedBigInteger('reward_menu_item_id')->nullable()->after('reward_category_id');
            $table->foreign('reward_menu_item_id')->references('id')->on('menu_items')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('promotion_rewards', function (Blueprint $table) {
            $table->dropForeign(['reward_menu_item_id']);
            $table->dropColumn('reward_menu_item_id');
        });
    }
};
