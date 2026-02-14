<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('policy_versions', function (Blueprint $table) {
            $table->id();
            $table->string('policy_type'); // terms_of_service, privacy_policy, data_retention, cookie_banner
            $table->longText('content');
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_published')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['policy_type', 'version']);
            $table->index(['policy_type', 'is_published']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('policy_versions');
    }
};
