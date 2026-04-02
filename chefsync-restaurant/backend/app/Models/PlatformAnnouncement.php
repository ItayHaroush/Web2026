<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

/**
 * הודעות כלליות לפלטפורמה — מנוהל ע"י סופר אדמין
 */
class PlatformAnnouncement extends Model
{
    protected $fillable = [
        'title',
        'body',
        'image_url',
        'link_url',
        'start_at',
        'end_at',
        'is_active',
        'position',
        'priority',
        'created_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'priority' => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * סינון הודעות פעילות לפי תאריך ו-is_active
     */
    public function scopeActive($query)
    {
        $now = now();
        return $query->where('is_active', true)
            ->where('start_at', '<=', $now)
            ->where('end_at', '>=', $now);
    }

    /**
     * URL מלא לתמונה
     */
    public function getImageUrlAttribute($value)
    {
        if (!$value) return null;
        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            return $value;
        }
        $relative = str_starts_with($value, '/storage') ? $value : Storage::url($value);
        return URL::to($relative);
    }
}
