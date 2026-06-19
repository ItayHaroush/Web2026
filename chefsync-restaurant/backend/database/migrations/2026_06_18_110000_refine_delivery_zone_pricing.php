<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // מחיר בסיס לתמחור לפי ק"מ. הנוסחה: בסיס + (תוספת לק"מ × מרחק).
        if (! Schema::hasColumn('delivery_zones', 'per_km_base_fee')) {
            Schema::table('delivery_zones', function (Blueprint $table) {
                $table->decimal('per_km_base_fee', 8, 2)->default(0)->after('per_km_fee');
            });
        }

        // תמחור מדרגות הוסר. ממירים אזורים קיימים ל"מחיר קבוע" לפי המדרגה הזולה ביותר
        // כדי שלא ייווצרו אזורים שגובים 0 לאחר הסרת הלוגיקה.
        if (Schema::hasColumn('delivery_zones', 'tiered_fees')) {
            DB::table('delivery_zones')
                ->where('pricing_type', 'tiered')
                ->get()
                ->each(function ($zone) {
                    $tiers = json_decode($zone->tiered_fees ?? '[]', true);
                    $fee = 0;
                    if (is_array($tiers) && ! empty($tiers)) {
                        $fees = array_filter(
                            array_map(fn ($t) => is_array($t) && isset($t['fee']) ? (float) $t['fee'] : null, $tiers),
                            fn ($v) => $v !== null
                        );
                        $fee = ! empty($fees) ? min($fees) : 0;
                    }

                    DB::table('delivery_zones')
                        ->where('id', $zone->id)
                        ->update([
                            'pricing_type' => 'fixed',
                            'fixed_fee' => $fee,
                        ]);
                });

            Schema::table('delivery_zones', function (Blueprint $table) {
                $table->dropColumn('tiered_fees');
            });
        }
    }

    public function down(): void
    {
        Schema::table('delivery_zones', function (Blueprint $table) {
            if (Schema::hasColumn('delivery_zones', 'per_km_base_fee')) {
                $table->dropColumn('per_km_base_fee');
            }
            if (! Schema::hasColumn('delivery_zones', 'tiered_fees')) {
                $table->json('tiered_fees')->nullable()->after('per_km_fee');
            }
        });
    }
};
