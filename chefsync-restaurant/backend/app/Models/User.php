<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * User Model - משתמשים במערכת
 * 
 * Roles:
 * - owner: בעל המסעדה - גישה מלאה
 * - manager: מנהל - יכול לנהל תפריט, הזמנות, עובדים
 * - employee: עובד - צפייה והזמנות בלבד
 * - delivery: שליח - ניהול משלוחים בלבד
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'restaurant_id',
        'name',
        'email',
        'phone',
        'password',
        'role',
        'is_active',
        'is_super_admin',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'is_active' => 'boolean',
        'is_super_admin' => 'boolean',
    ];

    /**
     * המסעדה של המשתמש
     */
    public function restaurant()
    {
        return $this->belongsTo(Restaurant::class);
    }

    /**
     * בדיקת תפקיד
     */
    public function isSuperAdmin(): bool
    {
        return $this->is_super_admin === true;
    }

    public function isOwner(): bool
    {
        return $this->role === 'owner';
    }

    public function isManager(): bool
    {
        return in_array($this->role, ['owner', 'manager']);
    }

    public function isEmployee(): bool
    {
        return in_array($this->role, ['owner', 'manager', 'employee']);
    }

    public function isDelivery(): bool
    {
        return $this->role === 'delivery';
    }

    /**
     * בדיקה אם יש הרשאה
     */
    public function hasPermission(string $permission): bool
    {
        $permissions = [
            'owner' => ['all'],
            'manager' => ['menu', 'orders', 'employees', 'reports'],
            'employee' => ['orders', 'view_menu'],
            'delivery' => ['deliveries'],
        ];

        $rolePermissions = $permissions[$this->role] ?? [];

        return in_array('all', $rolePermissions) || in_array($permission, $rolePermissions);
    }
}
