<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->text('share_incentive_text')->nullable()->after('description');
            $table->unsignedSmallInteger('delivery_time_minutes')->nullable()->after('has_delivery');
            $table->string('delivery_time_note', 255)->nullable()->after('delivery_time_minutes');
            $table->unsignedSmallInteger('pickup_time_minutes')->nullable()->after('has_pickup');
            $table->string('pickup_time_note', 255)->nullable()->after('pickup_time_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn([
                'share_incentive_text',
                'delivery_time_minutes',
                'delivery_time_note',
                'pickup_time_minutes',
                'pickup_time_note',
            ]);
        });
    }
};
