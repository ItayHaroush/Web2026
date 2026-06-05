<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('cities', function (Blueprint $table) {
            $table->string('source')->nullable()->after('longitude');
            $table->string('osm_id')->nullable()->after('source');
            $table->timestamp('last_verified_at')->nullable()->after('osm_id');
            $table->string('normalized_name')->nullable()->after('last_verified_at');

            $table->index('normalized_name');
            $table->index('osm_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cities', function (Blueprint $table) {
            $table->dropIndex(['normalized_name']);
            $table->dropIndex(['osm_id']);

            $table->dropColumn([
                'source',
                'osm_id',
                'last_verified_at',
                'normalized_name',
            ]);
        });
    }
};
