<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('pos_pin_hash', 60)->nullable()->after('is_active');
            $table->decimal('hourly_rate', 8, 2)->nullable()->after('pos_pin_hash');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['pos_pin_hash', 'hourly_rate']);
        });
    }
};
