<?php

namespace App\Http\Controllers;

use App\Models\EmailMarketingSuppression;
use Illuminate\Http\Request;

class EmailMarketingUnsubscribeController extends Controller
{
    /**
     * GET/POST — ביטול קבלת מיילים שיווקיים (RFC 8058 one-click POST נתמך כשהחתימה ב-query).
     */
    public function unsubscribe(Request $request)
    {
        if (! $request->hasValidSignature()) {
            abort(403, 'קישור לא תקף או שפג תוקפו.');
        }

        $email = strtolower(trim((string) $request->query('email', '')));
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            abort(400, 'כתובת אימייל לא תקינה.');
        }

        EmailMarketingSuppression::suppress($email);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'הוסרת מרשימת התפוצה השיווקית.',
            ]);
        }

        return response()->view('email.marketing-unsubscribed', [
            'email' => $email,
        ]);
    }
}
