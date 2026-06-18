<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * נקודת מוצא מדויקת של המסעדה לחישוב משלוח לפי ק"מ.
 * נפרדת מ-latitude/longitude (שמאוכלסים לעיתים ממרכז העיר),
 * כדי שהמרחק ללקוח יחושב מהכתובת המדויקת ולא ממרכז העיר.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->decimal('delivery_origin_lat', 10, 7)->nullable()->after('longitude');
            $table->decimal('delivery_origin_lng', 10, 7)->nullable()->after('delivery_origin_lat');
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn(['delivery_origin_lat', 'delivery_origin_lng']);
        });
    }
};
