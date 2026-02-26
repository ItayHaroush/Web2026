<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Restaurant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * התחברות למערכת
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['פרטי ההתחברות שגויים'],
            ]);
        }

        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['החשבון אינו פעיל. פנה למנהל המערכת.'],
            ]);
        }

        // יצירת טוקן
        $token = $user->createToken('auth-token', [$user->role])->plainTextToken;

        // סופר אדמין לא חייב לשייך למסעדה
        $restaurant = $user->restaurant;

        return response()->json([
            'success' => true,
            'message' => 'התחברת בהצלחה!',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'is_super_admin' => $user->is_super_admin ?? false,
                'restaurant_id' => $user->restaurant_id,
                'restaurant_name' => $restaurant?->name,
                'tenant_id' => $restaurant?->tenant_id,
                'restaurant' => $restaurant,
                'has_access' => $restaurant?->hasAccess() ?? true,
                'subscription_status' => $restaurant?->subscription_status,
            ],
            'token' => $token,
        ]);
    }

    /**
     * התנתקות
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'התנתקת בהצלחה',
        ]);
    }

    /**
     * פרטי משתמש נוכחי
     */
    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'is_super_admin' => $user->is_super_admin ?? false,
                'restaurant_id' => $user->restaurant_id,
                'restaurant' => $user->restaurant,
                'tenant_id' => $user->restaurant->tenant_id ?? null,
                'hourly_rate' => $user->hourly_rate,
                'has_pin' => !is_null($user->pos_pin_hash),
            ],
        ]);
    }

    /**
     * רישום משתמש חדש (רק בעל מסעדה יכול לרשום)
     */
    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:6|confirmed',
            'phone' => 'nullable|string|max:20',
            'role' => 'required|in:manager,employee,delivery',
        ]);

        $currentUser = $request->user();

        // רק בעל המסעדה או מנהל יכולים לרשום עובדים
        if (!$currentUser->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לרשום עובדים',
            ], 403);
        }

        $user = User::create([
            'restaurant_id' => $currentUser->restaurant_id,
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->phone,
            'role' => $request->role,
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'עובד נרשם בהצלחה!',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ],
        ], 201);
    }

    /**
     * עדכון פרטי משתמש
     */
    public function update(Request $request)
    {
        $user = $request->user();

        $rules = [
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|max:255|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|max:20',
            'current_password' => 'required_with:new_password',
            'new_password' => 'sometimes|string|min:6|confirmed',
            'hourly_rate' => 'nullable|numeric|min:0|max:9999',
            'pos_pin' => 'nullable|string|size:4',
        ];
        $request->validate($rules);

        if ($request->has('name')) {
            $user->name = $request->name;
        }

        if ($request->filled('email') && $request->email !== $user->email) {
            $user->email = $request->email;
        }

        if ($request->has('phone')) {
            $user->phone = $request->phone;
        }

        if ($request->filled('new_password')) {
            if (!Hash::check($request->current_password, $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['הסיסמה הנוכחית שגויה'],
                ]);
            }
            $user->password = Hash::make($request->new_password);
        }

        if ($request->has('hourly_rate')) {
            $user->hourly_rate = $request->hourly_rate;
        }

        if ($request->filled('pos_pin')) {
            $user->pos_pin_hash = Hash::make($request->pos_pin);
        }

        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'הפרטים עודכנו בהצלחה!',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'hourly_rate' => $user->hourly_rate,
                'has_pin' => !is_null($user->pos_pin_hash),
            ],
        ]);
    }
}
