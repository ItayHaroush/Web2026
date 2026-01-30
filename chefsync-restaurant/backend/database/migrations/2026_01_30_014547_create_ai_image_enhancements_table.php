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
        Schema::create('ai_image_enhancements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('restaurant_id')->constrained()->onDelete('cascade');
            $table->foreignId('menu_item_id')->nullable()->constrained()->onDelete('set null');

            // התמונה המקורית
            $table->string('original_path');

            // אופציות שנבחרו
            $table->string('background')->nullable()->comment('marble/wood/clean');
            $table->string('angle')->nullable()->comment('top/side/hands');

            // וריאציות שנוצרו (JSON של paths)
            $table->json('variations')->nullable();

            // הבחירה הסופית
            $table->string('selected_path')->nullable();
            $table->integer('selected_index')->nullable();

            // מטא-דאטה
            $table->enum('status', ['processing', 'ready', 'failed'])->default('processing');
            $table->string('ai_provider')->default('stability'); // stability/openai
            $table->integer('cost_credits')->default(3);
            $table->text('error_message')->nullable();

            $table->timestamps();

            $table->index(['restaurant_id', 'created_at']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_image_enhancements');
    }
};
