<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('restaurant_subscriptions', function (Blueprint $table) {
            $table->string('billing_model', 20)->default('flat')->after('plan_type');
            $table->decimal('base_fee', 10, 2)->default(0)->after('billing_model');
            $table->decimal('commission_percent', 5, 2)->default(0)->after('base_fee');
        });
    }

    public function down(): void
    {
        Schema::table('restaurant_subscriptions', function (Blueprint $table) {
            $table->dropColumn(['billing_model', 'base_fee', 'commission_percent']);
        });
    }
};
