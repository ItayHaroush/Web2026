<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            if (!Schema::hasColumn('menu_items', 'wolt_external_id')) {
                $table->string('wolt_external_id')->nullable()->after('tenant_id');
                $table->index(['tenant_id', 'wolt_external_id'], 'menu_items_wolt_external_idx');
            }
        });

        Schema::table('menu_item_addon_groups', function (Blueprint $table) {
            if (!Schema::hasColumn('menu_item_addon_groups', 'wolt_option_group_id')) {
                $table->string('wolt_option_group_id')->nullable()->after('tenant_id');
                $table->index(['tenant_id', 'wolt_option_group_id'], 'menu_item_addon_groups_wolt_opt_grp_idx');
            }
        });

        Schema::table('menu_item_addons', function (Blueprint $table) {
            if (!Schema::hasColumn('menu_item_addons', 'wolt_option_id')) {
                $table->string('wolt_option_id')->nullable()->after('tenant_id');
                $table->index(['tenant_id', 'wolt_option_id'], 'menu_item_addons_wolt_opt_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('menu_item_addons', function (Blueprint $table) {
            if (Schema::hasColumn('menu_item_addons', 'wolt_option_id')) {
                $table->dropIndex('menu_item_addons_wolt_opt_idx');
                $table->dropColumn('wolt_option_id');
            }
        });

        Schema::table('menu_item_addon_groups', function (Blueprint $table) {
            if (Schema::hasColumn('menu_item_addon_groups', 'wolt_option_group_id')) {
                $table->dropIndex('menu_item_addon_groups_wolt_opt_grp_idx');
                $table->dropColumn('wolt_option_group_id');
            }
        });

        Schema::table('menu_items', function (Blueprint $table) {
            if (Schema::hasColumn('menu_items', 'wolt_external_id')) {
                $table->dropIndex('menu_items_wolt_external_idx');
                $table->dropColumn('wolt_external_id');
            }
        });
    }
};
