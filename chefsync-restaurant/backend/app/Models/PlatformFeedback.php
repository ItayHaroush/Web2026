<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * משוב פלטפורמה ממשתמשי קצה (לקוחות רשומים) — נצפה ע"י סופר אדמין
 */
class PlatformFeedback extends Model
{
    protected $table = 'platform_feedback';

    public const CATEGORIES = ['general', 'bug', 'idea', 'complaint', 'praise'];
    public const STATUSES = ['new', 'in_review', 'resolved'];

    protected $fillable = [
        'customer_id',
        'category',
        'rating',
        'message',
        'page_url',
        'status',
        'admin_notes',
        'handled_by',
        'handled_at',
    ];

    protected $casts = [
        'rating' => 'integer',
        'handled_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }
}
