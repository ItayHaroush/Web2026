<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (!Schema::hasColumn('order_items', 'variant_id')) {
                $table->foreignId('variant_id')
                    ->nullable()
                    ->after('menu_item_id')
                    ->constrained('menu_item_variants')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('order_items', 'variant_name')) {
                $table->string('variant_name')->nullable()->after('variant_id');
            }

            if (!Schema::hasColumn('order_items', 'variant_price_delta')) {
                $table->decimal('variant_price_delta', 8, 2)->default(0)->after('variant_name');
            }

            if (!Schema::hasColumn('order_items', 'addons')) {
                $table->json('addons')->nullable()->after('variant_price_delta');
            }

            if (!Schema::hasColumn('order_items', 'addons_total')) {
                $table->decimal('addons_total', 8, 2)->default(0)->after('addons');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'variant_id')) {
                $table->dropForeign(['variant_id']);
            }

            foreach (['variant_id', 'variant_name', 'variant_price_delta', 'addons', 'addons_total'] as $column) {
                if (Schema::hasColumn('order_items', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
