<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * תיקון: משתמשים שנוצרו ע"י AdminUserSeeder עם role=manager
     * צריכים להיות owner (משתמש ראשון/יחיד במסעדה)
     */
    public function up(): void
    {
        // כל משתמש שכתובתו מסתיימת ב-@admin.com והוא manager -> שנה ל-owner
        DB::table('users')
            ->where('role', 'manager')
            ->where('email', 'like', '%@admin.com')
            ->update(['role' => 'owner']);
    }

    public function down(): void
    {
        // אין rollback - זה תיקון חד-פעמי
    }
};
