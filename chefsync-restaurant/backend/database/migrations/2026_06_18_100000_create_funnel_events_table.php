<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * אירועי משפך (Funnel) — לוג מלא של מסע הלקוח מתפריט ועד תשלום,
 * כולל נקודות נטישה (block_reason) ובדיקות תקינות (js_error / api_error).
 *
 * שלא כמו order_events — שמתחיל רק אחרי שנוצרה הזמנה — כאן נתפס כל
 * מסע, גם של מבקרים אנונימיים שלא הזינו טלפון ולא הגיעו להזמנה.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('funnel_events', function (Blueprint $table) {
            $table->id();

            // זהות
            $table->string('tenant_id')->nullable();
            $table->unsignedBigInteger('restaurant_id')->nullable();
            $table->string('restaurant_name')->nullable();
            $table->uuid('session_id');                 // ביקור בודד (מתאפס אחרי 30 דק' חוסר פעילות)
            $table->uuid('visitor_uuid')->nullable();   // מזהה דפדפן ארוך-טווח
            $table->unsignedBigInteger('customer_id')->nullable();

            // האירוע
            $table->string('event_name', 64);            // add_to_cart / checkout_started / ...
            $table->unsignedTinyInteger('funnel_stage')->default(0); // 1..10 — לחישוב "השלב הרחוק ביותר"
            $table->string('page_key', 64)->nullable();  // menu / cart / ...
            $table->string('path', 512)->nullable();     // הנתיב המלא (חשוב ל-Health Check)

            // סיבת נטישה (התשובה ל"הסיבה מספר 1")
            $table->string('block_reason', 48)->nullable();

            // בדיקות טכניות (Health Check)
            $table->string('error_type', 32)->nullable(); // js_error / unhandled_rejection / api_error
            $table->text('error_message')->nullable();

            // מדידת זמן בכל שלב
            $table->unsignedInteger('duration_ms')->nullable(); // ms מאז האירוע הקודם ב-session

            // זיהוי מכשיר
            $table->string('device', 16)->nullable();    // mobile / tablet / desktop
            $table->string('os', 24)->nullable();        // android / ios / windows / macos / linux
            $table->string('browser', 32)->nullable();   // chrome / safari / firefox / edge / samsung
            $table->boolean('is_native')->default(false);// אפליקציית Capacitor

            // קישורים (ללא FK — כדי לא לחסום אירועים לפני שנוצרה הזמנה/סשן)
            $table->unsignedBigInteger('cart_session_id')->nullable();
            $table->unsignedBigInteger('order_id')->nullable();

            // ערך הסל ברגע האירוע (לניתוח מחיר/נטישה)
            $table->decimal('amount', 10, 2)->nullable();

            // נתונים נוספים חופשיים (item_id, qty, http_status וכו')
            $table->json('payload')->nullable();

            $table->string('ip_address', 45)->nullable();
            $table->timestamp('occurred_at')->nullable(); // שעון הלקוח (למדידת זמן בין שלבים)
            $table->timestamp('created_at')->useCurrent(); // שעון השרת

            $table->index(['tenant_id', 'created_at']);
            $table->index(['tenant_id', 'funnel_stage', 'created_at']);
            $table->index(['tenant_id', 'block_reason']);
            $table->index('session_id');
            $table->index('event_name');
            $table->index('error_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('funnel_events');
    }
};
