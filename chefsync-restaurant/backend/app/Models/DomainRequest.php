<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DomainRequest extends Model
{
    public const TYPE_EXISTING = 'existing_domain';
    public const TYPE_FULL_SERVICE = 'full_service';
    public const TYPE_CHANGE = 'change_domain';
    public const TYPE_DISCONNECT = 'disconnect_domain';

    public const TYPES = [
        self::TYPE_EXISTING,
        self::TYPE_FULL_SERVICE,
        self::TYPE_CHANGE,
        self::TYPE_DISCONNECT,
    ];

    public const STATUS_AWAITING_PAYMENT = 'awaiting_payment';
    public const STATUS_PENDING = 'pending';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_AWAITING_CUSTOMER = 'awaiting_customer_info';
    public const STATUS_AWAITING_DNS = 'awaiting_dns';
    public const STATUS_SSL_SETUP = 'ssl_setup';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_COMPLETED = 'completed';

    public const BLOCKING_STATUSES = [
        self::STATUS_AWAITING_PAYMENT,
        self::STATUS_PENDING,
        self::STATUS_IN_PROGRESS,
        self::STATUS_AWAITING_CUSTOMER,
        self::STATUS_AWAITING_DNS,
        self::STATUS_SSL_SETUP,
    ];

    public const PAYMENT_AWAITING = 'awaiting_payment';
    public const PAYMENT_PAID = 'paid';
    public const PAYMENT_WAIVED = 'waived';
    public const PAYMENT_INCLUDED = 'included_in_setup';
    public const PAYMENT_REFUNDED = 'refunded';

    public const PAYMENT_STATUSES = [
        self::PAYMENT_AWAITING,
        self::PAYMENT_PAID,
        self::PAYMENT_WAIVED,
        self::PAYMENT_INCLUDED,
        self::PAYMENT_REFUNDED,
    ];

    public const DOMAIN_TYPE_PRIMARY = 'primary';
    public const DOMAIN_TYPE_REDIRECT = 'redirect';
    public const DOMAIN_TYPE_LEGACY = 'legacy';

    protected $fillable = [
        'request_number',
        'restaurant_id',
        'tenant_id',
        'requested_by_user_id',
        'type',
        'status',
        'payment_status',
        'amount',
        'payment_reference',
        'domain_name',
        'domain_name_alt_2',
        'domain_name_alt_3',
        'domain_type',
        'registrar',
        'business_name',
        'customer_notes',
        'admin_notes',
        'active_domain',
        'vercel_domain_id',
        'dns_records',
        'ssl_status',
        'handled_by',
        'connected_at',
        'rejected_at',
        'rejection_reason',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'dns_records' => 'array',
        'connected_at' => 'datetime',
        'rejected_at' => 'datetime',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(DomainRequestAuditLog::class)->orderByDesc('created_at');
    }

    public function isBlocking(): bool
    {
        return in_array($this->status, self::BLOCKING_STATUSES, true);
    }

    public function isPaidOrWaived(): bool
    {
        return in_array($this->payment_status, [
            self::PAYMENT_PAID,
            self::PAYMENT_WAIVED,
            self::PAYMENT_INCLUDED,
        ], true);
    }
}
