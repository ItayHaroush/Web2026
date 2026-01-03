<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->string('city')->nullable()->after('address');
            $table->string('logo_url')->nullable()->after('description');
            $table->decimal('latitude', 10, 7)->nullable()->after('city');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->string('cuisine_type')->nullable()->after('logo_url'); // סוג מטבח
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn(['city', 'logo_url', 'latitude', 'longitude', 'cuisine_type']);
        });
    }
};
