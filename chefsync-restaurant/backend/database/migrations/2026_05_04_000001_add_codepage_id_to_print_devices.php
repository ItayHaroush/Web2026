<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('print_devices', function (Blueprint $table) {
            // ESC t codepage number sent to printer. Default 10 = PC862 (Hebrew, SNBC/Epson-compatible).
            // For printers that use Arabic at codepage 10, change to the correct Hebrew codepage (e.g. 15, 25).
            $table->unsignedTinyInteger('codepage_id')->default(10)->after('printer_port');
        });
    }

    public function down(): void
    {
        Schema::table('print_devices', function (Blueprint $table) {
            $table->dropColumn('codepage_id');
        });
    }
};
