<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            // הוספת עמודת is_active
            $table->boolean('is_active')->default(true)->after('description');

            // הוספת עמודת sort_order (אם לא קיימת)
            if (!Schema::hasColumn('categories', 'sort_order')) {
                $table->integer('sort_order')->default(0)->after('is_active');
            }

            // העתקת ערכי display_order ל-sort_order אם קיימים
            if (Schema::hasColumn('categories', 'display_order')) {
                DB::statement('UPDATE categories SET sort_order = display_order WHERE sort_order = 0');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn(['is_active']);

            if (
                Schema::hasColumn('categories', 'sort_order') &&
                Schema::hasColumn('categories', 'display_order')
            ) {
                $table->dropColumn('sort_order');
            }
        });
    }
};
