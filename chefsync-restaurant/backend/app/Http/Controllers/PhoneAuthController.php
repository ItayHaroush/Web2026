<?php

namespace App\Http\Controllers;

use App\Models\PhoneVerification;
use App\Services\SmsService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

class PhoneAuthController extends Controller
{
    public function requestCode(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
        ]);
        $phone = $request->phone;
        $now = Carbon::now();
        $code = random_int(100000, 999999);
        $codeHash = Hash::make($code);
        $expiresAt = $now->copy()->addMinutes(5);

        // מחיקה של קודים ישנים לאותו טלפון
        PhoneVerification::where('phone', $phone)->delete();

        $verification = PhoneVerification::create([
            'phone' => $phone,
            'code_hash' => $codeHash,
            'expires_at' => $expiresAt,
            'attempts' => 0,
        ]);

        SmsService::sendVerificationCode($phone, $code);

        return response()->json([
            'success' => true,
            'expires_in' => 300,
        ]);
    }

    public function verifyCode(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
            'code' => 'required|string',
        ]);
        $phone = $request->phone;
        $code = $request->code;
        $now = Carbon::now();

        $verification = PhoneVerification::where('phone', $phone)
            ->orderByDesc('id')
            ->first();

        if (!$verification) {
            return response()->json(['success' => false, 'message' => 'קוד לא נמצא'], 400);
        }
        if ($verification->verified_at) {
            return response()->json(['success' => true, 'verified' => true]);
        }
        if ($verification->expires_at < $now) {
            return response()->json(['success' => false, 'message' => 'פג תוקף הקוד'], 400);
        }
        if ($verification->attempts >= 3) {
            return response()->json(['success' => false, 'message' => 'יותר מדי ניסיונות'], 429);
        }
        $verification->attempts++;
        $verification->save();

        if (!Hash::check($code, $verification->code_hash)) {
            return response()->json(['success' => false, 'message' => 'קוד שגוי'], 400);
        }
        $verification->verified_at = $now;
        $verification->save();
        return response()->json(['success' => true, 'verified' => true]);
    }
}
