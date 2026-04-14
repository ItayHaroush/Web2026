<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->boolean('require_clock_location')->default(false)->after('max_employees');
            $table->unsignedInteger('clock_radius_meters')->default(200)->nullable()->after('require_clock_location');
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn(['require_clock_location', 'clock_radius_meters']);
        });
    }
};
