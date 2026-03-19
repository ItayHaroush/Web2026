<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE customer_push_tokens MODIFY tenant_id VARCHAR(255) NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE customer_push_tokens ALTER COLUMN tenant_id DROP NOT NULL');
        }
        // sqlite: אין שינוי — נשאר NOT NULL קיים; בסביבות sqlite רישום ללא tenant יישמר עם tenant_id כמחרוזת ריקה (ראו CustomerPwaController)

        Schema::create('customer_restaurant_notification_opt_ins', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('tenant_id');
            $table->boolean('enabled')->default(false);
            $table->timestamps();

            $table->unique(['customer_id', 'tenant_id'], 'cust_rest_notif_opt_uidx');
            $table->index(['tenant_id', 'enabled'], 'cust_rest_notif_tenant_en');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_restaurant_notification_opt_ins');

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement('UPDATE customer_push_tokens SET tenant_id = "" WHERE tenant_id IS NULL');
            DB::statement('ALTER TABLE customer_push_tokens MODIFY tenant_id VARCHAR(255) NOT NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('UPDATE customer_push_tokens SET tenant_id = \'\' WHERE tenant_id IS NULL');
            DB::statement('ALTER TABLE customer_push_tokens ALTER COLUMN tenant_id SET NOT NULL');
        }
    }
};
