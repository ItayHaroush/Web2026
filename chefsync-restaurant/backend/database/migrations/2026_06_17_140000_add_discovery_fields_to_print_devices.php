<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('print_devices', function (Blueprint $table) {
            // Auto Recovery: IP החדש שזוהה בסריקה אוטומטית לאחר כשלים רצופים (הצעת מעבר)
            $table->string('suggested_printer_ip', 45)->nullable()->after('printer_port');
            $table->timestamp('suggested_printer_at')->nullable()->after('suggested_printer_ip');
        });
    }

    public function down(): void
    {
        Schema::table('print_devices', function (Blueprint $table) {
            $table->dropColumn(['suggested_printer_ip', 'suggested_printer_at']);
        });
    }
};
