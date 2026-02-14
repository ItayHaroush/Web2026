<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PolicyVersion extends Model
{
    protected $fillable = [
        'policy_type',
        'content',
        'version',
        'is_published',
        'published_at',
        'created_by',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'published_at' => 'datetime',
        'version' => 'integer',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }

    public function scopeOfType($query, string $type)
    {
        return $query->where('policy_type', $type);
    }

    /**
     * Get the latest published version for a policy type
     */
    public static function getPublished(string $type): ?self
    {
        return static::ofType($type)
            ->published()
            ->orderByDesc('version')
            ->first();
    }
}
