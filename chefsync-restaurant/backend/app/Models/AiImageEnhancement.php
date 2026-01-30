<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * מודל לניהול שיפורי תמונות AI
 * כל רשומה מייצגת תהליך אחד של העלאה → וריאציות → בחירה
 */
class AiImageEnhancement extends Model
{
    protected $fillable = [
        'restaurant_id',
        'menu_item_id',
        'original_path',
        'background',
        'angle',
        'variations',
        'selected_path',
        'selected_index',
        'status',
        'ai_provider',
        'cost_credits',
        'error_message',
    ];

    protected $casts = [
        'variations' => 'array',
        'selected_index' => 'integer',
        'cost_credits' => 'integer',
    ];

    /**
     * מסעדה שהתמונה שייכת לה
     */
    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    /**
     * מנה שהתמונה משויכת אליה (אופציונלי)
     */
    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class);
    }

    /**
     * האם התהליך הושלם בהצלחה
     */
    public function isReady(): bool
    {
        return $this->status === 'ready';
    }

    /**
     * האם התהליך נכשל
     */
    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    /**
     * מחזיר את כל נתיבי הווריאציות עם URLs מלאים
     */
    public function getVariationUrls(): array
    {
        if (!$this->variations) {
            return [];
        }

        return array_map(function ($path) {
            return [
                'url' => asset("storage/{$path}"),
                'path' => $path,
            ];
        }, $this->variations);
    }

    /**
     * מחזיר את ה-URL של התמונה הנבחרת
     */
    public function getSelectedUrl(): ?string
    {
        return $this->selected_path ? asset("storage/{$this->selected_path}") : null;
    }
}
