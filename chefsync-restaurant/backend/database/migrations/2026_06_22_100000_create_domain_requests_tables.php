<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('domain_requests', function (Blueprint $table) {
            $table->id();
            $table->string('request_number', 32)->unique();
            $table->foreignId('restaurant_id')->constrained()->cascadeOnDelete();
            $table->string('tenant_id', 64)->index();
            $table->foreignId('requested_by_user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('type', 32); // existing_domain, full_service, change_domain, disconnect_domain
            $table->string('status', 32)->default('awaiting_payment');
            $table->string('payment_status', 32)->default('awaiting_payment');
            $table->decimal('amount', 10, 2)->default(0);
            $table->string('payment_reference')->nullable();

            $table->string('domain_name')->nullable();
            $table->string('domain_name_alt_2')->nullable();
            $table->string('domain_name_alt_3')->nullable();
            $table->string('domain_type', 16)->default('primary'); // primary, redirect, legacy
            $table->string('registrar')->nullable();
            $table->string('business_name')->nullable();

            $table->text('customer_notes')->nullable();
            $table->text('admin_notes')->nullable();
            $table->string('active_domain')->nullable();

            $table->string('vercel_domain_id')->nullable();
            $table->json('dns_records')->nullable();
            $table->string('ssl_status', 32)->nullable();

            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('connected_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();

            $table->timestamps();

            $table->index(['restaurant_id', 'status']);
            $table->index(['status', 'created_at']);
            $table->index('domain_name');
        });

        Schema::create('domain_request_audit_log', function (Blueprint $table) {
            $table->id();
            $table->foreignId('domain_request_id')->constrained('domain_requests')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 64);
            $table->json('payload')->nullable();
            $table->text('note')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['domain_request_id', 'created_at']);
        });

        Schema::create('restaurant_domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('restaurant_id')->constrained()->cascadeOnDelete();
            $table->string('tenant_id', 64)->index();
            $table->string('domain')->unique();
            $table->string('domain_type', 16)->default('primary'); // primary, redirect, legacy
            $table->foreignId('domain_request_id')->nullable()->constrained('domain_requests')->nullOnDelete();
            $table->string('vercel_domain_id')->nullable();
            $table->string('ssl_status', 32)->nullable();
            $table->timestamp('connected_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->softDeletes();
            $table->timestamps();

            $table->index(['restaurant_id', 'is_active']);
            $table->index(['restaurant_id', 'domain_type']);
        });

        Schema::table('restaurants', function (Blueprint $table) {
            $table->string('custom_domain')->nullable()->after('slug');
            $table->timestamp('custom_domain_connected_at')->nullable()->after('custom_domain');
            $table->string('custom_domain_ssl_status', 32)->nullable()->after('custom_domain_connected_at');
        });
    }

    public function down(): void
    {
        Schema::table('restaurants', function (Blueprint $table) {
            $table->dropColumn([
                'custom_domain',
                'custom_domain_connected_at',
                'custom_domain_ssl_status',
            ]);
        });

        Schema::dropIfExists('restaurant_domains');
        Schema::dropIfExists('domain_request_audit_log');
        Schema::dropIfExists('domain_requests');
    }
};
