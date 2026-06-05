<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class City extends Model
{
    protected $fillable = [
        'name',
        'hebrew_name',
        'region',
        'latitude',
        'longitude',
        'source',
        'osm_id',
        'normalized_name',
        'approval_status',
        'reviewed_by_user_id',
        'reviewed_at',
        'review_note',
        'last_verified_at',
        'list_order',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'last_verified_at' => 'datetime',
    ];
}
