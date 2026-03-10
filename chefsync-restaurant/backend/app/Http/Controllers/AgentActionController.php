<?php

namespace App\Http\Controllers;

use App\Models\AgentActionLog;
use App\Models\FcmToken;
use App\Models\MonitoringAlert;
use App\Services\AgentActionService;
use App\Services\FcmService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AgentActionController extends Controller
{
    /**
     * Execute a confirmed agent action
     */
    public function execute(Request $request): JsonResponse
    {
        $request->validate([
            'action_id' => 'required|string|max:100',
            'params'    => 'required|array',
        ]);

        $user = $request->user();
        $actionId = $request->input('action_id');
        $params = $request->input('params');
        $tenantId = app('tenant_id');

        $service = new AgentActionService();

        // Validate the action
        $validation = $service->validateAction($actionId, $params, $user);
        if (!$validation['valid']) {
            return response()->json([
                'success' => false,
                'message' => $validation['error'],
            ], 422);
        }

        try {
            // Execute the action
            $result = $service->executeAction($actionId, $params, $user);

            // Log to audit trail
            AgentActionLog::create([
                'tenant_id'     => $tenantId,
                'restaurant_id' => $user->restaurant_id,
                'user_id'       => $user->id,
                'action_id'     => $actionId,
                'params'        => $params,
                'result'        => $result,
                'status'        => ($result['success'] ?? false) ? 'success' : 'failed',
            ]);

            return response()->json([
                'success' => $result['success'] ?? false,
                'message' => $result['message'] ?? 'הפעולה בוצעה',
                'data'    => $result,
            ]);
        } catch (\Exception $e) {
            Log::error('Agent action execution failed', [
                'action_id' => $actionId,
                'user_id'   => $user->id,
                'error'     => $e->getMessage(),
            ]);

            AgentActionLog::create([
                'tenant_id'     => $tenantId,
                'restaurant_id' => $user->restaurant_id,
                'user_id'       => $user->id,
                'action_id'     => $actionId,
                'params'        => $params,
                'result'        => ['error' => $e->getMessage()],
                'status'        => 'error',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'שגיאה בביצוע הפעולה: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get unread monitoring alerts
     */
    public function getAlerts(Request $request): JsonResponse
    {
        $user = $request->user();
        // #region agent log
        $logPath = base_path('../.cursor/debug-38053a.log');
        $payload = ['sessionId' => '38053a', 'location' => 'AgentActionController::getAlerts', 'message' => 'getAlerts called', 'data' => ['user_id' => $user->id, 'restaurant_id' => $user->restaurant_id, 'is_super_admin' => $user->is_super_admin ?? false], 'timestamp' => (int) (microtime(true) * 1000), 'hypothesisId' => 'A'];
        @file_put_contents($logPath, json_encode($payload) . "\n", FILE_APPEND);
        // #endregion

        $alerts = MonitoringAlert::where('restaurant_id', $user->restaurant_id)
            ->where('is_read', false)
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        // #region agent log
        $payload2 = ['sessionId' => '38053a', 'location' => 'AgentActionController::getAlerts', 'message' => 'getAlerts result', 'data' => ['alerts_count' => $alerts->count()], 'timestamp' => (int) (microtime(true) * 1000), 'hypothesisId' => 'A'];
        @file_put_contents($logPath, json_encode($payload2) . "\n", FILE_APPEND);
        // #endregion

        return response()->json([
            'success' => true,
            'alerts'  => $alerts,
        ]);
    }

    /**
     * Mark an alert as read
     */
    public function markAlertRead(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        $alert = MonitoringAlert::where('restaurant_id', $user->restaurant_id)
            ->findOrFail($id);

        $alert->update(['is_read' => true]);

        return response()->json([
            'success' => true,
            'message' => 'ההתראה סומנה כנקראה',
        ]);
    }

    /**
     * Send push notification to restaurant staff (called by agent)
     */
    public function sendPushNotification(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'body'  => 'required|string|max:500',
        ]);

        $tenantId = app('tenant_id');
        $tokens = FcmToken::where('tenant_id', $tenantId)->pluck('token');

        if ($tokens->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאו מכשירים רשומים לקבלת התראות',
            ]);
        }

        $fcm = new FcmService();
        $sent = 0;

        foreach ($tokens as $token) {
            try {
                if ($fcm->sendToToken($token, $request->input('title'), $request->input('body'), [
                    'type' => 'agent_notification',
                ])) {
                    $sent++;
                }
            } catch (\Exception $e) {
                Log::warning('FCM send failed for token', ['error' => $e->getMessage()]);
            }
        }

        return response()->json([
            'success' => $sent > 0,
            'message' => $sent > 0
                ? "נשלחו {$sent} התראות בהצלחה"
                : 'שליחת ההתראות נכשלה',
        ]);
    }
}
