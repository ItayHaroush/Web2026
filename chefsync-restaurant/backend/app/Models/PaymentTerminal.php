<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PaymentTerminal extends Model
{
    protected $fillable = [
        'restaurant_id',
        'name',
        'zcredit_terminal_number',
        'zcredit_terminal_password',
        'zcredit_pinpad_id',
    ];

    protected $hidden = [
        'zcredit_terminal_password',
    ];

    protected $casts = [
        'zcredit_terminal_password' => 'encrypted',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function kiosks(): HasMany
    {
        return $this->hasMany(Kiosk::class, 'payment_terminal_id');
    }

    public function posSessions(): HasMany
    {
        return $this->hasMany(PosSession::class, 'payment_terminal_id');
    }
}
