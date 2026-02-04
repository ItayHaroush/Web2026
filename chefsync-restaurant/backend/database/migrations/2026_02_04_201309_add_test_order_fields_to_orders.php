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
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('is_test')
                ->default(false)
                ->after('status')
                ->index()
                ->comment('האם הזמנה לדוגמה/בדיקה (לא נספרת במטריקות ולא שולחת התראות)');

            $table->string('test_note', 255)
                ->nullable()
                ->after('is_test')
                ->comment('הערה להזמנת בדיקה (למשל: "בדיקת מסעדן", "preview mode")');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['is_test', 'test_note']);
        });
    }
};
