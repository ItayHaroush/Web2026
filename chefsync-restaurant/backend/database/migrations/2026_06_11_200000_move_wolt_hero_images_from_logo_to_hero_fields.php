<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * ייבוא וולט שמר בעבר את תמונת ההירו של המסעדה בשדה logo_url.
 * מעבירים תמונות וולט (CDN של wolt.com) לשדות ההירו ומנקים את הלוגו,
 * כדי שכרטיסיות המסעדה יציגו הירו ולא "לוגו" שגוי.
 */
return new class extends Migration
{
    public function up(): void
    {
        $rows = DB::table('restaurants')
            ->whereNotNull('logo_url')
            ->where('logo_url', 'LIKE', '%wolt.com%')
            ->get(['id', 'logo_url', 'menu_hero_background_url', 'share_hero_background_url']);

        foreach ($rows as $row) {
            $updates = ['logo_url' => null];

            if (empty($row->menu_hero_background_url)) {
                $updates['menu_hero_background_url'] = $row->logo_url;
            }

            if (empty($row->share_hero_background_url)) {
                $updates['share_hero_background_url'] = $row->logo_url;
            }

            DB::table('restaurants')->where('id', $row->id)->update($updates);
        }
    }

    public function down(): void
    {
        // שחזור: אם אין לוגו אבל יש הירו של וולט — נחזיר אותו ללוגו (התנהגות ישנה).
        DB::table('restaurants')
            ->whereNull('logo_url')
            ->whereNotNull('menu_hero_background_url')
            ->where('menu_hero_background_url', 'LIKE', '%wolt.com%')
            ->update(['logo_url' => DB::raw('menu_hero_background_url')]);
    }
};
