<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PosSession extends Model
{
    protected $fillable = [
        'user_id',
        'restaurant_id',
        'token',
        'expires_at',
        'locked_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'locked_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function isValid(): bool
    {
        return $this->expires_at->isFuture() && is_null($this->locked_at);
    }
}
