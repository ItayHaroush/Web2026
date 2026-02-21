<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashRegisterShift extends Model
{
    protected $fillable = [
        'restaurant_id',
        'user_id',
        'opened_at',
        'closed_at',
        'opening_balance',
        'closing_balance',
        'expected_balance',
        'notes',
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
        'opening_balance' => 'decimal:2',
        'closing_balance' => 'decimal:2',
        'expected_balance' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function movements()
    {
        return $this->hasMany(CashMovement::class, 'shift_id');
    }

    public function isOpen(): bool
    {
        return is_null($this->closed_at);
    }
}
