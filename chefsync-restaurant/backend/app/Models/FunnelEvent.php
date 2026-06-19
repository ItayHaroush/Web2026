<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * אירוע בודד במשפך ההמרה של הלקוח.
 *
 * @see database/migrations/2026_06_18_100000_create_funnel_events_table.php
 */
class FunnelEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'restaurant_name',
        'session_id',
        'visitor_uuid',
        'customer_id',
        'event_name',
        'funnel_stage',
        'page_key',
        'path',
        'block_reason',
        'error_type',
        'error_message',
        'duration_ms',
        'device',
        'os',
        'browser',
        'is_native',
        'cart_session_id',
        'order_id',
        'amount',
        'payload',
        'ip_address',
        'occurred_at',
        'created_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'is_native' => 'boolean',
        'funnel_stage' => 'integer',
        'duration_ms' => 'integer',
        'amount' => 'decimal:2',
        'occurred_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    /**
     * שלבי המשפך הקנוניים (מסודרים) — לחישוב "השלב הרחוק ביותר" ונשירה.
     */
    public const STAGE_MENU_VIEW = 1;
    public const STAGE_ADD_TO_CART = 2;
    public const STAGE_CART_VIEW = 3;
    public const STAGE_CHECKOUT_STARTED = 4;
    public const STAGE_DETAILS_COMPLETE = 5;
    public const STAGE_DELIVERY_RESOLVED = 6;
    public const STAGE_REVIEW = 7;
    public const STAGE_ORDER_SUBMIT = 8;
    public const STAGE_ORDER_CREATED = 9;
    public const STAGE_PAYMENT_SUCCESS = 10;

    /**
     * תוויות שלבים (עברית) — לדשבורד.
     *
     * @var array<int, string>
     */
    public const STAGE_LABELS = [
        self::STAGE_MENU_VIEW => 'תפריט',
        self::STAGE_ADD_TO_CART => 'הוספה לסל',
        self::STAGE_CART_VIEW => 'צפייה בסל',
        self::STAGE_CHECKOUT_STARTED => 'מעבר לקופה',
        self::STAGE_DETAILS_COMPLETE => 'מילוי פרטים',
        self::STAGE_DELIVERY_RESOLVED => 'משלוח/איסוף',
        self::STAGE_REVIEW => 'סקירה אחרונה',
        self::STAGE_ORDER_SUBMIT => 'שליחת הזמנה',
        self::STAGE_ORDER_CREATED => 'הזמנה נוצרה',
        self::STAGE_PAYMENT_SUCCESS => 'תשלום הושלם',
    ];

    /**
     * שמות אירועים מותרים (Whitelist) — מונע זיהום נתונים.
     *
     * @var list<string>
     */
    public const ALLOWED_EVENTS = [
        'menu_view',
        'item_view',
        'add_to_cart',
        'remove_from_cart',
        'update_qty',
        'cart_view',
        'checkout_started',
        'details_complete',
        'delivery_method_selected',
        'delivery_zone_checked',
        'review_reached',
        'phone_verify_started',
        'phone_verified',
        'order_submit_attempt',
        'order_created',
        'payment_redirect',
        'payment_success',
        'payment_failed',
        'checkout_blocked',
        'js_error',
        'api_error',
    ];

    /**
     * סיבות חסימה מותרות (Whitelist).
     *
     * @var list<string>
     */
    public const ALLOWED_BLOCK_REASONS = [
        'below_minimum',
        'outside_delivery_zone',
        'restaurant_closed',
        'missing_address',
        'invalid_phone',
        'missing_contact',
        'otp_failed',
        'payment_failed',
        'api_error',
        'js_error',
        'other',
    ];

    /**
     * תוויות סיבות חסימה (עברית).
     *
     * @var array<string, string>
     */
    public const BLOCK_REASON_LABELS = [
        'below_minimum' => 'מתחת למינימום הזמנה',
        'outside_delivery_zone' => 'מחוץ לאזור משלוח',
        'restaurant_closed' => 'מסעדה סגורה',
        'missing_address' => 'כתובת משלוח חסרה/לא מלאה',
        'invalid_phone' => 'מספר טלפון לא תקין',
        'missing_contact' => 'חסר שם/טלפון',
        'otp_failed' => 'כשל באימות טלפון (OTP)',
        'payment_failed' => 'תשלום נכשל',
        'api_error' => 'שגיאת שרת (API)',
        'js_error' => 'שגיאת JavaScript',
        'other' => 'אחר',
    ];

    public function scopeForTenant($query, string $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function scopeOfEvent($query, string $eventName)
    {
        return $query->where('event_name', $eventName);
    }
}
