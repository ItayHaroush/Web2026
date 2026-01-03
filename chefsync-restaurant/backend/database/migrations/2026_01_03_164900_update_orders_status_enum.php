<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // שינוי עמודת status מ-ENUM ל-VARCHAR כדי לתמוך בכל הסטטוסים
        DB::statement("ALTER TABLE orders MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'received'");
    }

    public function down(): void
    {
        // חזרה ל-ENUM המקורי
        DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM('received', 'preparing', 'ready', 'delivered') NOT NULL DEFAULT 'received'");
    }
};
