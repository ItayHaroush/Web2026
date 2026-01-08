<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PhoneVerification extends Model
{
    use HasFactory;

    protected $fillable = [
        'phone',
        'code_hash',
        'expires_at',
        'verified_at',
        'attempts',
    ];

    protected $dates = [
        'expires_at',
        'verified_at',
        'created_at',
        'updated_at',
    ];
}
