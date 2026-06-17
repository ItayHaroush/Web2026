<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PrintDevice extends Model
{
    /**
     * חלון הזמן (בשניות) שבו אנחנו עדיין מחשיבים את הגשר כמקוון מאז ה-heartbeat האחרון.
     * הסוכן שולח heartbeat כל ~30 שניות; גרייס פיריוד של 90 שניות מאפשר תקלות רשת קצרות.
     */
    public const ONLINE_GRACE_SECONDS = 90;

    /**
     * חלון תוקף לבדיקת מדפסת — אם החיבור נבדק לפני יותר מזמן זה, אנחנו מתעלמים מהדגל.
     */
    public const PRINTER_CHECK_GRACE_SECONDS = 120;

    public const STATUS_ONLINE = 'online';
    public const STATUS_BRIDGE_OFFLINE = 'bridge_offline';
    public const STATUS_PRINTER_OFFLINE = 'printer_offline';
    public const STATUS_DISABLED = 'disabled';

    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'name',
        'role',
        'device_token',
        'printer_ip',
        'printer_port',
        'is_active',
        'codepage_id',
        'last_seen_at',
        'last_error_message',
        'last_error_at',
        'printer_connected',
        'printer_last_check_at',
        'printer_last_error',
        'agent_version',
        'last_successful_print_at',
        'consecutive_failures',
        'last_retry_count',
        'suggested_printer_ip',
        'suggested_printer_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'printer_port' => 'integer',
        'codepage_id' => 'integer',
        'last_seen_at' => 'datetime',
        'last_error_at' => 'datetime',
        'printer_connected' => 'boolean',
        'printer_last_check_at' => 'datetime',
        'last_successful_print_at' => 'datetime',
        'consecutive_failures' => 'integer',
        'last_retry_count' => 'integer',
        'suggested_printer_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $hidden = ['device_token'];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($device) {
            if (empty($device->device_token)) {
                $device->device_token = bin2hex(random_bytes(32));
            }
        });
    }

    protected static function booted()
    {
        static::addGlobalScope('tenant', function ($query) {
            if (app()->has('tenant_id')) {
                $query->where('tenant_id', app('tenant_id'));
            }
        });
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function printJobs(): HasMany
    {
        return $this->hasMany(PrintJob::class, 'device_id');
    }

    /**
     * האם הגשר עצמו מקוון (שלח heartbeat לאחרונה).
     */
    public function getIsConnectedAttribute(): bool
    {
        return $this->last_seen_at
            && $this->last_seen_at->diffInSeconds(now()) < self::ONLINE_GRACE_SECONDS;
    }

    /**
     * האם המדפסת מגיבה לסקירת TCP — תקף רק אם הבדיקה האחרונה עדכנית.
     * מחזיר null אם אין מידע / הבדיקה ישנה (= לא ידוע).
     */
    public function getIsPrinterConnectedAttribute(): ?bool
    {
        if ($this->printer_connected === null) {
            return null;
        }
        if (! $this->printer_last_check_at) {
            return null;
        }
        if ($this->printer_last_check_at->diffInSeconds(now()) > self::PRINTER_CHECK_GRACE_SECONDS) {
            return null;
        }

        return (bool) $this->printer_connected;
    }

    /**
     * סטטוס תלת-מצבי לתצוגה בדשבורד:
     *   disabled        — כובה ידנית
     *   bridge_offline  — האפליקציה לא שולחת heartbeat (🔴)
     *   printer_offline — הגשר מקוון אבל המדפסת לא מגיבה (⚠️)
     *   online          — הכל תקין (🟢)
     */
    public function getConnectionStatusAttribute(): string
    {
        if (! $this->is_active) {
            return self::STATUS_DISABLED;
        }
        if (! $this->is_connected) {
            return self::STATUS_BRIDGE_OFFLINE;
        }
        if ($this->is_printer_connected === false) {
            return self::STATUS_PRINTER_OFFLINE;
        }

        return self::STATUS_ONLINE;
    }
}
