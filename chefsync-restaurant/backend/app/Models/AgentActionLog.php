<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentActionLog extends Model
{
    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'user_id',
        'action_id',
        'params',
        'result',
        'status',
    ];

    protected $casts = [
        'params' => 'array',
        'result' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}
