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
        Schema::create('platform_feedback', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('category', 30)->default('general')->comment('קטגוריה: general/bug/idea/complaint/praise');
            $table->tinyInteger('rating')->nullable()->comment('דירוג כללי: 1-5');
            $table->text('message')->comment('תוכן המשוב');
            $table->string('page_url', 500)->nullable()->comment('מאיזה עמוד נשלח');
            $table->string('status', 20)->default('new')->comment('סטטוס טיפול: new/in_review/resolved');
            $table->text('admin_notes')->nullable()->comment('הערות פנימיות של סופר אדמין');
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete()->comment('מי טיפל');
            $table->timestamp('handled_at')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('platform_feedback');
    }
};
