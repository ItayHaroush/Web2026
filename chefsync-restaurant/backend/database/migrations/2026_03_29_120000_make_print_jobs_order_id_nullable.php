<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('print_jobs', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
        });

        Schema::table('print_jobs', function (Blueprint $table) {
            $table->unsignedBigInteger('order_id')->nullable()->change();
        });

        Schema::table('print_jobs', function (Blueprint $table) {
            $table->foreign('order_id')->references('id')->on('orders')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('print_jobs', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
        });

        Schema::table('print_jobs', function (Blueprint $table) {
            $table->unsignedBigInteger('order_id')->nullable(false)->change();
        });

        Schema::table('print_jobs', function (Blueprint $table) {
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
        });
    }
};
