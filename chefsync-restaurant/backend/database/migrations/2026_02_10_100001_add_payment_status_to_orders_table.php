<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * שדות מעקב תשלום בהזמנות + המרת payment_method מ-enum ל-string
     */
    public function up(): void
    {
        // שלב 1: הוסף שדות תשלום חדשים
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'payment_status')) {
                $table->string('payment_status')->default('not_required')->after('payment_method');
            }
            if (!Schema::hasColumn('orders', 'payment_transaction_id')) {
                $table->string('payment_transaction_id')->nullable()->after('payment_status');
            }
            if (!Schema::hasColumn('orders', 'payment_amount')) {
                $table->decimal('payment_amount', 10, 2)->nullable()->after('payment_transaction_id');
            }
            if (!Schema::hasColumn('orders', 'paid_at')) {
                $table->timestamp('paid_at')->nullable()->after('payment_amount');
            }
            if (!Schema::hasColumn('orders', 'marked_paid_by')) {
                $table->string('marked_paid_by')->nullable()->after('paid_at');
            }
            if (!Schema::hasColumn('orders', 'marked_paid_at')) {
                $table->timestamp('marked_paid_at')->nullable()->after('marked_paid_by');
            }
        });

        // שלב 2: המרת payment_method מ-enum ל-string (בתוך transaction)
        // בדוק אם כבר בוצע (אם payment_method_new לא קיים ו-payment_method הוא עדיין enum)
        $columnType = DB::selectOne("SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'payment_method'");
        if ($columnType && $columnType->DATA_TYPE === 'enum') {
            DB::transaction(function () {
                // הוסף עמודה חדשה string
                Schema::table('orders', function (Blueprint $table) {
                    $table->string('payment_method_new')->default('cash')->after('payment_method');
                });

                // העתק נתונים קיימים
                DB::statement("UPDATE orders SET payment_method_new = payment_method");

                // מחק עמודה ישנה (enum)
                Schema::table('orders', function (Blueprint $table) {
                    $table->dropColumn('payment_method');
                });

                // שנה שם עמודה חדשה
                Schema::table('orders', function (Blueprint $table) {
                    $table->renameColumn('payment_method_new', 'payment_method');
                });
            });
        }

        // שלב 3: הוסף אינדקסים (רק אם לא קיימים)
        Schema::table('orders', function (Blueprint $table) {
            $paymentMethodIndex = DB::select("SHOW INDEX FROM orders WHERE Key_name = 'orders_payment_method_index'");
            if (empty($paymentMethodIndex)) {
                $table->index('payment_method');
            }
            $paymentStatusIndex = DB::select("SHOW INDEX FROM orders WHERE Key_name = 'orders_payment_status_index'");
            if (empty($paymentStatusIndex)) {
                $table->index('payment_status');
            }
        });
    }

    public function down(): void
    {
        // הסר אינדקסים
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['payment_method']);
            $table->dropIndex(['payment_status']);
        });

        // החזר payment_method ל-enum (כל הערכים הקיימים הם 'cash')
        DB::transaction(function () {
            Schema::table('orders', function (Blueprint $table) {
                $table->string('payment_method_backup')->default('cash')->after('payment_method');
            });

            DB::statement("UPDATE orders SET payment_method_backup = 'cash'");

            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('payment_method');
            });

            Schema::table('orders', function (Blueprint $table) {
                $table->renameColumn('payment_method_backup', 'payment_method');
            });
        });

        // הסר שדות תשלום
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'payment_status',
                'payment_transaction_id',
                'payment_amount',
                'paid_at',
                'marked_paid_by',
                'marked_paid_at',
            ]);
        });
    }
};
