<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurant_subscriptions', function (Blueprint $table) {
            $table->enum('plan_type', ['monthly', 'annual'])->default('monthly')->after('restaurant_id');
        });
    }

    public function down(): void
    {
        Schema::table('restaurant_subscriptions', function (Blueprint $table) {
            $table->dropColumn('plan_type');
        });
    }
};
