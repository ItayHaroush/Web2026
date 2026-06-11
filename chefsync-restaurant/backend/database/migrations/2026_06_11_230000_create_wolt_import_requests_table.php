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
        Schema::create('wolt_import_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('restaurant_id')->constrained('restaurants')->cascadeOnDelete();
            $table->string('tenant_id');
            $table->string('wolt_url', 500);
            $table->string('slug')->nullable()->comment('Wolt venue slug');
            $table->string('selection_mode', 20)->default('all')->comment('all = ייבוא מלא, selected = פריטים נבחרים');
            $table->json('categories')->nullable()->comment('קטגוריות ופריטים שנבחרו לייבוא');
            $table->json('restaurant_meta')->nullable()->comment('מטא-דאטה של המסעדה מוולט');
            $table->json('summary')->nullable()->comment('סיכום כמויות: קטגוריות/פריטים/תוספות');
            $table->string('status', 20)->default('pending')->comment('pending/approved/rejected');
            $table->timestamp('applied_at')->nullable()->comment('מתי הסופר-אדמין ייבא בפועל');
            $table->timestamps();

            $table->index(['restaurant_id', 'status']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('wolt_import_requests');
    }
};
