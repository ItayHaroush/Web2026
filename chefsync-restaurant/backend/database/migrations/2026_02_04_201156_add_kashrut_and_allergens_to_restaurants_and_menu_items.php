<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add kashrut and allergen fields to restaurants table
        Schema::table('restaurants', function (Blueprint $table) {
            $table->enum('kashrut_level', ['none', 'kosher', 'mehadrin', 'badatz', 'other'])
                ->default('none')
                ->after('cuisine_type')
                ->comment('רמת כשרות: none=לא כשר, kosher=כשר, mehadrin=מהדרין, badatz=בד"ץ, other=אחר');

            $table->string('kashrut_text', 255)
                ->nullable()
                ->after('kashrut_level')
                ->comment('פרטי כשרות נוספים (למשל: "רבנות נוף הגליל", "בד״ץ עדה חרדית")');

            $table->json('common_allergens')
                ->nullable()
                ->after('kashrut_text')
                ->comment('אלרגנים נפוצים במטבח - JSON array: ["gluten","nuts","eggs",etc]');
        });

        // Add allergen tags to menu_items table
        Schema::table('menu_items', function (Blueprint $table) {
            $table->json('allergen_tags')
                ->nullable()
                ->after('description')
                ->comment('אלרגנים במנה זו - JSON array: ["gluten","nuts","peanuts","eggs","milk","soy","sesame","fish","shellfish"]');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn(['kashrut_level', 'kashrut_text', 'common_allergens']);
        });

        Schema::table('menu_items', function (Blueprint $table) {
            $table->dropColumn('allergen_tags');
        });
    }
};
