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
        Schema::table('restaurants', function (Blueprint $table) {
            // הוספת tier - basic (450₪) או pro (600₪)
            $table->enum('tier', ['basic', 'pro'])
                ->default('pro')
                ->after('subscription_plan');

            // קרדיטים חודשיים של AI - 0 ל-basic, 500 ל-pro
            $table->integer('ai_credits_monthly')
                ->default(0)
                ->after('tier');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn(['tier', 'ai_credits_monthly']);
        });
    }
};
