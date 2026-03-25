<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PageVisit extends Model
{
    public const KIND_ANONYMOUS = 'anonymous';

    public const KIND_CUSTOMER_GUEST = 'customer_guest';

    public const KIND_CUSTOMER_REGISTERED = 'customer_registered';

    public const KIND_ADMIN = 'admin';

    protected $fillable = [
        'page_key',
        'tenant_id',
        'restaurant_id',
        'restaurant_name',
        'visitor_uuid',
        'customer_id',
        'visitor_kind',
        'visitor_display_hint',
        'admin_user_id',
        'path',
        'referrer',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function adminUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }
}
