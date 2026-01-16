<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedSmallInteger('eta_minutes')->nullable()->after('delivery_notes');
            $table->string('eta_note', 255)->nullable()->after('eta_minutes');
            $table->timestamp('eta_updated_at')->nullable()->after('eta_note');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['eta_minutes', 'eta_note', 'eta_updated_at']);
        });
    }
};
