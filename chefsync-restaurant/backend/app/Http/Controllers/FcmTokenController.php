<?php

namespace App\Http\Controllers;

use App\Models\FcmToken;
use Illuminate\Http\Request;

class FcmTokenController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'token' => 'required|string',
            'device_label' => 'nullable|string|max:100',
        ]);

        $userId = $request->user()?->id;
        $deviceLabel = $data['device_label'] ?? 'tablet';
        $tenantId = app('tenant_id');

        // Tokens can rotate. If the same device registers again, keep only the latest token
        // to avoid sending the same notification twice to the same physical device.
        $dedupeQuery = FcmToken::query()
            ->where('tenant_id', $tenantId)
            ->where('device_label', $deviceLabel)
            ->where('token', '!=', $data['token']);

        if ($userId) {
            $dedupeQuery->where('user_id', $userId);
        } else {
            $dedupeQuery->whereNull('user_id');
        }

        $dedupeQuery->delete();

        // token ייחודי גלובלית ב-DB; ה-global scope על FcmToken מסתיר שורות מ-tenant אחר
        // ואז updateOrCreate חושב שאין רשומה ומנסה INSERT → 1062 Duplicate entry
        FcmToken::withoutGlobalScopes()->updateOrCreate(
            ['token' => $data['token']],
            [
                'tenant_id' => $tenantId,
                'user_id' => $userId,
                'device_label' => $deviceLabel,
            ]
        );

        return response()->json(['success' => true]);
    }

    public function unregister(Request $request)
    {
        $data = $request->validate([
            'token' => 'required|string',
        ]);

        FcmToken::query()
            ->where('tenant_id', app('tenant_id'))
            ->where('token', $data['token'])
            ->delete();

        return response()->json(['success' => true]);
    }

    /**
     * רישום FCM token עבור סופר אדמין (ללא tenant)
     */
    public function storeSuperAdmin(Request $request)
    {
        $data = $request->validate([
            'token' => 'required|string',
            'device_label' => 'nullable|string|max:100',
        ]);

        $userId = $request->user()->id;
        $deviceLabel = $data['device_label'] ?? 'super_admin';

        // מחיקת טוקנים ישנים מאותו מכשיר
        FcmToken::withoutGlobalScopes()
            ->where('tenant_id', '__super_admin__')
            ->where('user_id', $userId)
            ->where('device_label', $deviceLabel)
            ->where('token', '!=', $data['token'])
            ->delete();

        FcmToken::withoutGlobalScopes()->updateOrCreate(
            ['token' => $data['token']],
            [
                'tenant_id' => '__super_admin__',
                'user_id' => $userId,
                'device_label' => $deviceLabel,
            ]
        );

        return response()->json(['success' => true]);
    }

    /**
     * הסרת FCM token עבור סופר אדמין
     */
    public function unregisterSuperAdmin(Request $request)
    {
        $data = $request->validate([
            'token' => 'required|string',
        ]);

        FcmToken::withoutGlobalScopes()
            ->where('tenant_id', '__super_admin__')
            ->where('token', $data['token'])
            ->delete();

        return response()->json(['success' => true]);
    }
}
