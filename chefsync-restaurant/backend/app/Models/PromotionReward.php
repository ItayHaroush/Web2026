<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * דגם PromotionReward - פרס מבצע
 */
class PromotionReward extends Model
{
    protected $fillable = [
        'promotion_id',
        'reward_type',
        'reward_category_id',
        'reward_menu_item_id',
        'reward_value',
        'max_selectable',
    ];

    protected $casts = [
        'reward_value' => 'decimal:2',
        'max_selectable' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }

    public function rewardCategory(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'reward_category_id');
    }

    public function rewardMenuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class, 'reward_menu_item_id');
    }
}
