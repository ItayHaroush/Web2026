<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * שדרוג מסכי תצוגה v2 - הוספת יחס מסך
     */
    public function up(): void
    {
        Schema::table('display_screens', function (Blueprint $table) {
            $table->string('aspect_ratio', 10)->default('16:9')->after('display_type');
        });
    }

    public function down(): void
    {
        Schema::table('display_screens', function (Blueprint $table) {
            $table->dropColumn('aspect_ratio');
        });
    }
};
