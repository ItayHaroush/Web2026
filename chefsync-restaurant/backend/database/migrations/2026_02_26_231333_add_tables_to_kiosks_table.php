<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kiosks', function (Blueprint $table) {
            $table->json('tables')->nullable()->after('require_name');
        });
    }

    public function down(): void
    {
        Schema::table('kiosks', function (Blueprint $table) {
            $table->dropColumn('tables');
        });
    }
};
