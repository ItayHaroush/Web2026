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
        $phone = $this->normalizePhone($request->phone);
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

        $sent = SmsService::sendVerificationCode($phone, $code);
        if (!$sent) {
            $verification->delete();
            return response()->json([
                'success' => false,
                'message' => 'שליחת SMS נכשלה, נסה שוב מאוחר יותר',
            ], 502);
        }

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
        $phone = $this->normalizePhone($request->phone);
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

    private function normalizePhone(string $raw): string
    {
        $phone = preg_replace('/\s+/', '', $raw);
        // אם מתחיל ב-0 (ישראל), החלף ל-+972 ללא האפס
        if (str_starts_with($phone, '0')) {
            return '+972' . substr($phone, 1);
        }
        // אם כבר כולל +, החזר כפי שהוא
        return $phone;
    }
}
