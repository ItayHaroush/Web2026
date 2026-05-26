<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * שדות ביטול לסשני POS — מאפשר "החלפה חכמה":
 *   • כאשר אותו משתמש מתחבר ממכשיר אחר, הסשן הקודם מסומן revoked
 *     במקום להימחק. ה-middleware יזהה את ההבדל ויחזיר הודעה ברורה
 *     ("הסשן הוחלף ממכשיר אחר") במקום 401 שקט שמרגיש כמו ניתוק אקראי.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_sessions', function (Blueprint $table) {
            if (!Schema::hasColumn('pos_sessions', 'revoked_at')) {
                $table->timestamp('revoked_at')->nullable()->after('locked_at');
            }
            if (!Schema::hasColumn('pos_sessions', 'revoked_reason')) {
                $table->string('revoked_reason', 64)->nullable()->after('revoked_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pos_sessions', function (Blueprint $table) {
            if (Schema::hasColumn('pos_sessions', 'revoked_reason')) {
                $table->dropColumn('revoked_reason');
            }
            if (Schema::hasColumn('pos_sessions', 'revoked_at')) {
                $table->dropColumn('revoked_at');
            }
        });
    }
};
