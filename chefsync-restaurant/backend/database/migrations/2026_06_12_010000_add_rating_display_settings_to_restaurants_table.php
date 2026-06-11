<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->boolean('show_rating_on_home')->default(false)->after('allow_future_orders')->comment('הצגת ממוצע דירוג בדף הבית');
            $table->boolean('show_rating_on_menu')->default(false)->after('show_rating_on_home')->comment('הצגת ממוצע דירוג בתפריט המסעדה');
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn(['show_rating_on_home', 'show_rating_on_menu']);
        });
    }
};
