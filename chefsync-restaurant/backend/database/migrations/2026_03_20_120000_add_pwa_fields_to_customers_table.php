<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->timestamp('pwa_installed_at')->nullable()->after('total_orders');
            $table->timestamp('last_app_open_at')->nullable()->after('pwa_installed_at');
            $table->timestamp('push_opt_in_at')->nullable()->after('last_app_open_at');
            $table->string('push_permission', 20)->nullable()->after('push_opt_in_at');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn([
                'pwa_installed_at',
                'last_app_open_at',
                'push_opt_in_at',
                'push_permission',
            ]);
        });
    }
};
