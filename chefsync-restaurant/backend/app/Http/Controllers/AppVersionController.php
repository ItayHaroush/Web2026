<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class AppVersionController extends Controller
{
    /**
     * מחזיר את גרסת האפליקציה האחרונה/המינימלית עבור פלטפורמה.
     * ציבורי — נקרא בהפעלה ע"י אפליקציות הנייטיב כדי להחליט על עדכון.
     */
    public function show(Request $request)
    {
        $platform = $request->query('platform', 'android');
        $cfg = config("appversion.$platform") ?? config('appversion.android');

        return response()->json([
            'success' => true,
            'platform' => $platform,
            'latest_version_code' => (int) $cfg['latest_version_code'],
            'latest_version_name' => $cfg['latest_version_name'],
            'min_version_code' => (int) $cfg['min_version_code'],
            'min_version_name' => $cfg['min_version_name'],
            'update_url' => $cfg['update_url'],
        ]);
    }
}
