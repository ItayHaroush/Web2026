<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->boolean('show_menu_banner')->default(true)->after('stackable');
            $table->boolean('show_entry_popup')->default(true)->after('show_menu_banner');
        });

        Schema::table('promotion_rewards', function (Blueprint $table) {
            $table->string('discount_scope', 32)->default('whole_cart')->after('max_selectable');
            $table->json('discount_menu_item_ids')->nullable()->after('discount_scope');
        });
    }

    public function down(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->dropColumn(['show_menu_banner', 'show_entry_popup']);
        });

        Schema::table('promotion_rewards', function (Blueprint $table) {
            $table->dropColumn(['discount_scope', 'discount_menu_item_ids']);
        });
    }
};
