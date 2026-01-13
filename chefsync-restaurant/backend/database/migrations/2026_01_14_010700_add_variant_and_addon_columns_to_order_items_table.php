<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('variant_id')
                ->nullable()
                ->after('menu_item_id')
                ->constrained('menu_item_variants')
                ->nullOnDelete();
            $table->string('variant_name')->nullable()->after('variant_id');
            $table->decimal('variant_price_delta', 8, 2)->default(0)->after('variant_name');
            $table->json('addons')->nullable()->after('variant_price_delta');
            $table->decimal('addons_total', 8, 2)->default(0)->after('addons');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign(['variant_id']);
            $table->dropColumn([
                'variant_id',
                'variant_name',
                'variant_price_delta',
                'addons',
                'addons_total',
            ]);
        });
    }
};
