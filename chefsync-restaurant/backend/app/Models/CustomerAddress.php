<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerAddress extends Model
{
    protected $fillable = [
        'customer_id',
        'label',
        'street',
        'house_number',
        'apartment',
        'floor',
        'entrance',
        'city',
        'lat',
        'lng',
        'notes',
        'is_default',
    ];

    protected $casts = [
        'lat' => 'float',
        'lng' => 'float',
        'is_default' => 'boolean',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * כתובת מלאה כ-string
     */
    public function getFullAddressAttribute(): string
    {
        $parts = [$this->street, $this->house_number];
        if ($this->apartment) {
            $parts[] = "דירה {$this->apartment}";
        }
        $address = implode(' ', $parts);
        return "{$address}, {$this->city}";
    }
}
