<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerPushToken extends Model
{
    protected $fillable = [
        'customer_id',
        'tenant_id',
        'token',
        'device_label',
        'platform',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
