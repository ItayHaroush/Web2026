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
            $table->tinyInteger('rating')->nullable()->after('status')->comment('דירוג לקוח: 1-5');
            $table->text('review_text')->nullable()->after('rating')->comment('טקסט ביקורת מהלקוח');
            $table->timestamp('reviewed_at')->nullable()->after('review_text')->comment('מתי הלקוח דירג');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['rating', 'review_text', 'reviewed_at']);
        });
    }
};
