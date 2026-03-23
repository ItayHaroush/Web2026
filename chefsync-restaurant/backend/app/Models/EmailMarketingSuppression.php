<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailMarketingSuppression extends Model
{
    protected $fillable = [
        'email',
    ];

    public static function isSuppressed(string $email): bool
    {
        $normalized = strtolower(trim($email));

        return self::query()->where('email', $normalized)->exists();
    }

    public static function suppress(string $email): void
    {
        $normalized = strtolower(trim($email));
        self::query()->firstOrCreate(['email' => $normalized]);
    }
}
