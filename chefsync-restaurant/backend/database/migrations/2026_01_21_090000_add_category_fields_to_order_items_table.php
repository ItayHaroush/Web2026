<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('order_items', 'category_id')) {
                $table->unsignedBigInteger('category_id')->nullable()->after('menu_item_id');
                $table->index('category_id');
            }
            if (!Schema::hasColumn('order_items', 'category_name')) {
                $table->string('category_name')->nullable()->after('category_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'category_name')) {
                $table->dropColumn('category_name');
            }
            if (Schema::hasColumn('order_items', 'category_id')) {
                $table->dropIndex(['category_id']);
                $table->dropColumn('category_id');
            }
        });
    }
};
