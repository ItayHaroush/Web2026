<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * הוספת סטטוס בריאות לגשרי הדפסה — מאפשר לדשבורד להבחין בין שלוש מצבים:
 *   • 🟢 גשר מקוון + מדפסת מגיבה
 *   • ⚠️  גשר מקוון + מדפסת לא מגיבה (IP שגוי / מנותקת מהחשמל)
 *   • 🔴 גשר אופליין (אפליקציה לא רצה / מחשב כבוי / רשת)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('print_devices', function (Blueprint $table) {
            $table->boolean('printer_connected')->nullable()->after('printer_port');
            $table->timestamp('printer_last_check_at')->nullable()->after('printer_connected');
            $table->string('printer_last_error', 500)->nullable()->after('printer_last_check_at');
            $table->string('agent_version', 32)->nullable()->after('printer_last_error');
        });
    }

    public function down(): void
    {
        Schema::table('print_devices', function (Blueprint $table) {
            $table->dropColumn([
                'printer_connected',
                'printer_last_check_at',
                'printer_last_error',
                'agent_version',
            ]);
        });
    }
};
