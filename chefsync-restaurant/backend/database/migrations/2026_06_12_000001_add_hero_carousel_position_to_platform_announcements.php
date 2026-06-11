<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE platform_announcements MODIFY COLUMN position ENUM('top_banner', 'popup', 'hero_overlay', 'hero_carousel') NOT NULL DEFAULT 'top_banner'");
    }

    public function down(): void
    {
        DB::table('platform_announcements')
            ->where('position', 'hero_carousel')
            ->update(['position' => 'top_banner']);

        DB::statement("ALTER TABLE platform_announcements MODIFY COLUMN position ENUM('top_banner', 'popup', 'hero_overlay') NOT NULL DEFAULT 'top_banner'");
    }
};
