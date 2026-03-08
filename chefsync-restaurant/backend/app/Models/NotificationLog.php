<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationLog extends Model
{
    protected $fillable = [
        'channel',
        'type',
        'title',
        'body',
        'sender_id',
        'target_restaurant_ids',
        'tokens_targeted',
        'sent_ok',
        'metadata',
    ];

    protected $casts = [
        'target_restaurant_ids' => 'array',
        'metadata' => 'array',
    ];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
