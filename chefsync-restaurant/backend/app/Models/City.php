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
    ];
}
