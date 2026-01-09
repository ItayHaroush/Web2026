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

        FcmToken::updateOrCreate(
            ['token' => $data['token']],
            [
                'tenant_id' => app('tenant_id'),
                'device_label' => $data['device_label'] ?? 'tablet',
            ]
        );

        return response()->json(['success' => true]);
    }
}
