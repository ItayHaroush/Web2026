<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('pos_access')->default(false)->after('pos_pin_hash');
        });

        // מתן גישה לקופה לכל הבעלים והמנהלים הקיימים
        DB::table('users')
            ->whereIn('role', ['owner', 'manager'])
            ->update(['pos_access' => true]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('pos_access');
        });
    }
};
