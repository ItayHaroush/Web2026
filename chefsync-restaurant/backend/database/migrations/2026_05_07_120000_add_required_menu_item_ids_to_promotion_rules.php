<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * הוספת עמודת required_menu_item_ids (JSON) ל-promotion_rules
 *
 * מאפשר לבחור מוצרים ספציפיים מתוך הקטגוריה כתנאי המבצע.
 * הפריט הראשון ברשימה משמש כ"עוגן מחיר" לחישוב הפרש שדרוג
 * עבור פריטים אחרים מאותה קטגוריה.
 *
 * NULL/[] => התנהגות קיימת (כל מוצר מהקטגוריה תקף, ללא הפרש).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotion_rules', function (Blueprint $table) {
            $table->json('required_menu_item_ids')->nullable()->after('required_category_id');
        });
    }

    public function down(): void
    {
        Schema::table('promotion_rules', function (Blueprint $table) {
            $table->dropColumn('required_menu_item_ids');
        });
    }
};
