<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('restaurants', 'zcredit_terminal_number')) {
            Schema::table('restaurants', function (Blueprint $table) {
                $table->string('zcredit_terminal_number')->nullable();
                $table->text('zcredit_terminal_password')->nullable();
                $table->string('zcredit_pinpad_id')->nullable();
            });
        }

        if (!Schema::hasTable('payment_terminals')) {
            Schema::create('payment_terminals', function (Blueprint $table) {
                $table->id();
                $table->foreignId('restaurant_id')->constrained()->cascadeOnDelete();
                $table->string('name', 120);
                $table->string('zcredit_terminal_number')->nullable();
                $table->text('zcredit_terminal_password')->nullable();
                $table->string('zcredit_pinpad_id')->nullable();
                $table->timestamps();

                $table->index('restaurant_id');
            });
        }

        if (!Schema::hasColumn('restaurants', 'default_payment_terminal_id')) {
            Schema::table('restaurants', function (Blueprint $table) {
                $table->foreignId('default_payment_terminal_id')
                    ->nullable()
                    ->constrained('payment_terminals')
                    ->nullOnDelete();
            });
        }

        if (!Schema::hasColumn('kiosks', 'payment_terminal_id')) {
            Schema::table('kiosks', function (Blueprint $table) {
                $table->foreignId('payment_terminal_id')
                    ->nullable()
                    ->constrained('payment_terminals')
                    ->nullOnDelete();
            });
        }

        if (!Schema::hasColumn('pos_sessions', 'payment_terminal_id')) {
            Schema::table('pos_sessions', function (Blueprint $table) {
                $table->foreignId('payment_terminal_id')
                    ->nullable()
                    ->constrained('payment_terminals')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('pos_sessions', 'payment_terminal_id')) {
            Schema::table('pos_sessions', function (Blueprint $table) {
                $table->dropConstrainedForeignId('payment_terminal_id');
            });
        }

        if (Schema::hasColumn('kiosks', 'payment_terminal_id')) {
            Schema::table('kiosks', function (Blueprint $table) {
                $table->dropConstrainedForeignId('payment_terminal_id');
            });
        }

        if (Schema::hasColumn('restaurants', 'default_payment_terminal_id')) {
            Schema::table('restaurants', function (Blueprint $table) {
                $table->dropConstrainedForeignId('default_payment_terminal_id');
            });
        }

        Schema::dropIfExists('payment_terminals');

        if (Schema::hasColumn('restaurants', 'zcredit_terminal_number')) {
            Schema::table('restaurants', function (Blueprint $table) {
                $table->dropColumn(['zcredit_terminal_number', 'zcredit_terminal_password', 'zcredit_pinpad_id']);
            });
        }
    }
};
