<?php

namespace App\Http\Controllers;

use App\Models\FcmToken;
use App\Models\PrintDevice;
use App\Models\PrintJob;
use App\Services\FcmService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PrintAgentController extends Controller
{
    /** After this many consecutive failed prints we escalate to the super-admin. */
    private const AUTO_RECOVERY_THRESHOLD = 3;

    // ─── Agent API (device-token auth) ───

    /**
     * Backward-compatible status endpoint used by older agent builds.
     * Reuses heartbeat flow so device last_seen/config stay in sync.
     */
    public function status(Request $request)
    {
        return $this->heartbeat($request);
    }

    public function getJobs(Request $request)
    {
        $device = $request->get('print_device');

        $jobs = DB::transaction(function () use ($device) {
            $pending = PrintJob::withoutGlobalScopes()
                ->where('restaurant_id', $device->restaurant_id)
                ->where('status', 'pending_bridge')
                ->where(function ($q) use ($device) {
                    if ($device->role === 'general') {
                        // General device catches ALL roles
                        $q->whereNotNull('role');
                    } else {
                        $q->where('role', $device->role)
                            ->orWhere('role', 'general');
                    }
                })
                ->where(function ($q) use ($device) {
                    $q->whereNull('device_id')
                        ->orWhere('device_id', $device->id);
                })
                ->orderBy('id')
                ->lockForUpdate()
                // Concurrent Prints = 1: claim exactly one job so the next order never
                // starts before the previous finished, and a long agent-side retry can't
                // be prematurely re-queued by retryStaleJobs (double-print protection).
                ->limit(1)
                ->get();

            foreach ($pending as $job) {
                $job->update([
                    'status' => 'printing',
                    'device_id' => $device->id,
                    'target_ip' => $device->printer_ip,
                    'target_port' => $device->printer_port,
                ]);
            }

            return $pending;
        });

        return response()->json([
            'success' => true,
            'jobs' => $jobs->map(function ($job) {
                $row = [
                    'id' => $job->id,
                    'role' => $job->role,
                    'order_id' => $job->order_id,
                    'type' => $job->payload['type'] ?? 'custom',
                    'text' => $job->payload['text'] ?? '',
                    'target_ip' => $job->target_ip,
                    'target_port' => $job->target_port,
                    'created_at' => $job->created_at?->toIso8601String(),
                    'double_height' => ($job->payload['type'] ?? '') === 'kitchen_ticket',
                    'codepage_id' => $device->codepage_id ?? 10,
                ];
                if (! empty($job->payload['escpos_binary_suffix']) && is_string($job->payload['escpos_binary_suffix'])) {
                    $row['escpos_binary_suffix'] = $job->payload['escpos_binary_suffix'];
                }

                return $row;
            }),
        ]);
    }

    public function ackJob(Request $request, $id)
    {
        $device = $request->get('print_device');

        $request->validate([
            'status' => 'required|in:done,failed',
            'error_message' => 'nullable|string|max:500',
            'printer_status_verified' => 'nullable|boolean',
            'printer_status' => 'nullable|string|max:32',
            'printer_status_detail' => 'nullable|string|max:255',
            'retry_count' => 'nullable|integer|min:0|max:50',
            'print_duration_ms' => 'nullable|integer|min:0',
            'printer_ip' => 'nullable|string|max:45',
        ]);

        $job = PrintJob::withoutGlobalScopes()
            ->where('device_id', $device->id)
            ->where('status', 'printing')
            ->findOrFail($id);

        $status = $request->input('status');
        $retryCount = $request->input('retry_count');

        $job->update([
            'status' => $status,
            'error_message' => $request->input('error_message'),
            'printer_status_verified' => $request->has('printer_status_verified')
                ? $request->boolean('printer_status_verified')
                : null,
            'printer_status' => $request->input('printer_status'),
            'printer_status_detail' => $request->input('printer_status_detail'),
            'retry_count' => $retryCount,
            'print_duration_ms' => $request->input('print_duration_ms'),
            'printer_ip' => $request->input('printer_ip') ?: $job->target_ip,
            'printer_name' => $device->name,
        ]);

        if ($status === 'done') {
            // Reset the failure streak and record the last successful print for Printer Health.
            $device->update([
                'last_successful_print_at' => now(),
                'consecutive_failures' => 0,
                'last_retry_count' => $retryCount,
                'last_error_message' => null,
                'last_error_at' => null,
            ]);
        } else {
            // Failed AFTER the agent exhausted its retries — never delete/lose the order.
            $device->update([
                'last_error_message' => $request->input('error_message'),
                'last_error_at' => now(),
                'last_retry_count' => $retryCount,
                'consecutive_failures' => DB::raw('consecutive_failures + 1'),
            ]);
            $device->refresh();

            $this->notifyRestaurantPrintFailure($job, $device);

            // Auto Recovery: escalate to the super-admin once failures pile up.
            if ($device->consecutive_failures >= self::AUTO_RECOVERY_THRESHOLD) {
                $this->notifySuperAdminPrintError($job, $device);
            }
        }

        Log::info('Print job ACK', [
            'job_id' => $job->id,
            'order_id' => $job->order_id,
            'status' => $status,
            'retry_count' => $retryCount,
            'print_duration_ms' => $request->input('print_duration_ms'),
            'printer_status' => $job->printer_status,
            'consecutive_failures' => $device->consecutive_failures,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Alert the restaurant tablets that a print failed (so staff can re-print manually).
     * Deduped per job via failed_notified_at.
     */
    private function notifyRestaurantPrintFailure(PrintJob $job, PrintDevice $device): void
    {
        if ($job->failed_notified_at) {
            return;
        }

        try {
            $fcm = app(FcmService::class);
            $tokens = FcmToken::withoutGlobalScopes()
                ->where('tenant_id', $job->tenant_id)
                ->get(['token', 'platform']);

            $orderLabel = $job->order_id ? "#{$job->order_id}" : "#{$job->id}";
            $title = '⚠️ הדפסה נכשלה';
            $body = "הזמנה {$orderLabel} לא הודפסה. ההזמנה נשמרה — ניתן להדפיס מחדש מהאפליקציה.";
            $data = [
                'type' => 'print_failed',
                'orderId' => (string) ($job->order_id ?? ''),
                'jobId' => (string) $job->id,
                'url' => '/admin/orders',
            ];

            foreach ($tokens as $row) {
                $fcm->sendToToken($row->token, $title, $body, $data, $row->platform);
            }

            $job->forceFill(['failed_notified_at' => now()])->save();
        } catch (\Throwable $e) {
            Log::warning('Failed to notify restaurant about print failure', [
                'job_id' => $job->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Escalate a recurring print failure to the super-admin (system error).
     */
    private function notifySuperAdminPrintError(PrintJob $job, PrintDevice $device): void
    {
        try {
            $fcm = app(FcmService::class);
            $tokens = FcmToken::withoutGlobalScopes()
                ->where('tenant_id', '__super_admin__')
                ->get(['token', 'platform']);

            $restaurantName = optional($device->restaurant)->name ?? $device->tenant_id;
            $title = '🔴 שגיאת מערכת הדפסה';
            $body = "מדפסת '{$device->name}' נכשלה {$device->consecutive_failures} פעמים ברצף ({$restaurantName}).";
            $data = [
                'type' => 'print_system_error',
                'deviceId' => (string) $device->id,
                'restaurantId' => (string) $device->restaurant_id,
                'url' => '/super-admin/dashboard',
            ];

            foreach ($tokens as $row) {
                $fcm->sendToToken($row->token, $title, $body, $data, $row->platform);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to escalate print failure to super-admin', [
                'device_id' => $device->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function heartbeat(Request $request)
    {
        $device = $request->get('print_device');

        $request->validate([
            'bridge_online' => 'sometimes|boolean',
            'printer_connected' => 'sometimes|nullable|boolean',
            'printer_last_error' => 'sometimes|nullable|string|max:500',
            'agent_version' => 'sometimes|nullable|string|max:32',
        ]);

        $update = ['last_seen_at' => now()];

        if ($request->has('printer_connected')) {
            $update['printer_connected'] = $request->boolean('printer_connected');
            $update['printer_last_check_at'] = now();
            $update['printer_last_error'] = $request->input('printer_last_error');
        }

        if ($request->filled('agent_version')) {
            $update['agent_version'] = $request->input('agent_version');
        }

        $device->update($update);

        return response()->json([
            'success' => true,
            'server_time' => now()->toIso8601String(),
            'config' => [
                'restaurant_id' => $device->restaurant_id,
                'role' => $device->role,
                'printer_ip' => $device->printer_ip,
                'printer_port' => $device->printer_port,
                'codepage_id' => $device->codepage_id ?? 10,
                'is_active' => (bool) $device->is_active,
                'heartbeat_interval_seconds' => 30,
                'printer_probe_timeout_ms' => 1500,
            ],
        ]);
    }

    /**
     * הסוכן מדווח על IP חדש של מדפסת שזוהה בסריקת רשת.
     *   apply=true  → בחירה ידנית מהמסך — מחילים מיד.
     *   apply=false → גילוי אוטומטי (Auto Recovery) — שומרים כהצעה + מתריעים לסופר-אדמין.
     */
    public function setPrinterIp(Request $request)
    {
        $device = $request->get('print_device');

        $validated = $request->validate([
            'printer_ip' => 'required|ip',
            'source' => 'nullable|string|max:32',
            'apply' => 'sometimes|boolean',
            'candidates' => 'sometimes|array',
            'candidates.*' => 'string|max:45',
        ]);

        $newIp = $validated['printer_ip'];
        $source = $validated['source'] ?? 'discovery';
        $apply = $request->boolean('apply', true);

        if ($apply) {
            $device->update([
                'printer_ip' => $newIp,
                'consecutive_failures' => 0,
                'printer_last_error' => null,
                'suggested_printer_ip' => null,
                'suggested_printer_at' => null,
            ]);

            Log::info('Print device IP updated by agent', [
                'device_id' => $device->id,
                'printer_ip' => $newIp,
                'source' => $source,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'IP applied',
            ]);
        }

        // Auto-recovery suggestion — store and alert super-admin once per distinct IP.
        $isNewSuggestion = $device->suggested_printer_ip !== $newIp;
        $device->update([
            'suggested_printer_ip' => $newIp,
            'suggested_printer_at' => now(),
        ]);

        if ($isNewSuggestion) {
            $this->notifySuperAdminPrinterSuggestion($device, $newIp);
        }

        return response()->json([
            'success' => true,
            'message' => 'Suggestion recorded',
        ]);
    }

    /**
     * Auto Recovery: מתריע לסופר-אדמין שזוהה IP חדש למדפסת שנכשלה שוב ושוב.
     */
    private function notifySuperAdminPrinterSuggestion(PrintDevice $device, string $suggestedIp): void
    {
        try {
            $fcm = app(FcmService::class);
            $tokens = FcmToken::withoutGlobalScopes()
                ->where('tenant_id', '__super_admin__')
                ->get(['token', 'platform']);

            $restaurantName = optional($device->restaurant)->name ?? $device->tenant_id;
            $title = '🔧 זוהה IP חדש למדפסת';
            $body = "מדפסת '{$device->name}' ({$restaurantName}) לא הגיבה — זוהתה כתובת חדשה {$suggestedIp}. ניתן לאשר מעבר בלוח הבקרה.";
            $data = [
                'type' => 'printer_ip_suggested',
                'deviceId' => (string) $device->id,
                'restaurantId' => (string) $device->restaurant_id,
                'suggestedIp' => $suggestedIp,
                'url' => '/super-admin/dashboard',
            ];

            foreach ($tokens as $row) {
                $fcm->sendToToken($row->token, $title, $body, $data, $row->platform);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to notify super-admin about printer IP suggestion', [
                'device_id' => $device->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    // ─── Admin CRUD (sanctum auth) ───

    public function index(Request $request)
    {
        $user = $request->user();

        $devices = PrintDevice::where('restaurant_id', $user->restaurant_id)
            ->orderBy('created_at', 'desc')
            ->get();

        // ספירת עבודות הדפסה תקועות לכל device — מאפשר לדשבורד להציג "X עבודות בהמתנה"
        $pendingJobsByRole = PrintJob::withoutGlobalScopes()
            ->where('restaurant_id', $user->restaurant_id)
            ->whereIn('status', ['pending_bridge', 'printing'])
            ->selectRaw('role, COUNT(*) as cnt')
            ->groupBy('role')
            ->pluck('cnt', 'role')
            ->all();

        $payload = $devices->map(function ($device) use ($pendingJobsByRole) {
            $isConnected = $device->is_connected;
            $printerConnected = $device->is_printer_connected;
            $pendingForRole = $pendingJobsByRole[$device->role] ?? 0;
            if ($device->role === 'general') {
                $pendingForRole = array_sum($pendingJobsByRole);
            }

            $arr = $device->toArray();
            $arr['is_connected'] = $isConnected;
            $arr['printer_connected'] = $printerConnected;
            $arr['connection_status'] = $device->connection_status;
            $arr['pending_jobs_count'] = (int) $pendingForRole;
            $arr['agent_version'] = $device->agent_version;
            $arr['printer_last_check_at'] = $device->printer_last_check_at?->toIso8601String();
            $arr['printer_last_error'] = $device->printer_last_error;
            // Printer Health fields
            $arr['last_seen_at'] = $device->last_seen_at?->toIso8601String();
            $arr['last_successful_print_at'] = $device->last_successful_print_at?->toIso8601String();
            $arr['last_error_at'] = $device->last_error_at?->toIso8601String();
            $arr['last_error_message'] = $device->last_error_message;
            $arr['consecutive_failures'] = (int) $device->consecutive_failures;
            $arr['last_retry_count'] = $device->last_retry_count;
            // Auto Recovery suggestion
            $arr['suggested_printer_ip'] = $device->suggested_printer_ip;
            $arr['suggested_printer_at'] = $device->suggested_printer_at?->toIso8601String();

            return $arr;
        });

        return response()->json([
            'success' => true,
            'devices' => $payload,
        ]);
    }

    public function register(Request $request)
    {
        $user = $request->user();

        if (! $user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לרשום מכשירי הדפסה',
            ], 403);
        }

        $request->validate([
            'name' => 'required|string|max:100',
            'role' => 'required|in:kitchen,receipt,bar,general',
            'printer_ip' => 'nullable|ip',
            'printer_port' => 'nullable|integer|min:1|max:65535',
        ]);

        $restaurant = $user->restaurant;
        if (! $restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $device = PrintDevice::create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'name' => $request->input('name'),
            'role' => $request->input('role'),
            'printer_ip' => $request->input('printer_ip'),
            'printer_port' => $request->input('printer_port', 9100),
            'codepage_id' => $request->input('codepage_id', 10),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'מכשיר הדפסה נרשם בהצלחה!',
            'device' => $device,
            'device_token' => $device->device_token,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();

        if (! $user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לעדכן מכשירי הדפסה',
            ], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:100',
            'role' => 'sometimes|in:kitchen,receipt,bar,general',
            'printer_ip' => 'nullable|ip',
            'printer_port' => 'nullable|integer|min:1|max:65535',
            'codepage_id' => 'nullable|integer|min:0|max:255',
        ]);

        $device = PrintDevice::where('restaurant_id', $user->restaurant_id)->findOrFail($id);

        $payload = $request->only(['name', 'role', 'printer_ip', 'printer_port', 'codepage_id']);

        // אם הכתובת שונתה (כולל אישור הצעת מעבר) — נקה את ההצעה ואפס את מונה הכשלים
        if (array_key_exists('printer_ip', $payload) && $payload['printer_ip'] !== $device->printer_ip) {
            $payload['suggested_printer_ip'] = null;
            $payload['suggested_printer_at'] = null;
            $payload['consecutive_failures'] = 0;
            $payload['printer_last_error'] = null;
        }

        $device->update($payload);

        return response()->json([
            'success' => true,
            'message' => 'מכשיר הדפסה עודכן בהצלחה!',
            'device' => $device,
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        if (! $user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה למחוק מכשירי הדפסה',
            ], 403);
        }

        $device = PrintDevice::where('restaurant_id', $user->restaurant_id)->findOrFail($id);
        $device->delete();

        return response()->json([
            'success' => true,
            'message' => 'מכשיר הדפסה נמחק בהצלחה!',
        ]);
    }

    public function toggle(Request $request, $id)
    {
        $user = $request->user();

        if (! $user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לשנות סטטוס מכשיר',
            ], 403);
        }

        $device = PrintDevice::where('restaurant_id', $user->restaurant_id)->findOrFail($id);
        $device->is_active = ! $device->is_active;
        $device->save();

        return response()->json([
            'success' => true,
            'message' => $device->is_active ? 'מכשיר הדפסה הופעל!' : 'מכשיר הדפסה כובה',
            'device' => $device,
        ]);
    }

    /**
     * List failed print jobs for the current restaurant (for the "re-print" UI).
     */
    public function failedJobs(Request $request)
    {
        $user = $request->user();

        $jobs = PrintJob::withoutGlobalScopes()
            ->where('restaurant_id', $user->restaurant_id)
            ->where('status', 'failed')
            ->orderBy('updated_at', 'desc')
            ->limit(50)
            ->get(['id', 'order_id', 'role', 'error_message', 'retry_count', 'printer_name', 'printer_status', 'created_at', 'updated_at']);

        return response()->json([
            'success' => true,
            'jobs' => $jobs->map(fn ($job) => [
                'id' => $job->id,
                'order_id' => $job->order_id,
                'role' => $job->role,
                'error_message' => $job->error_message,
                'retry_count' => $job->retry_count,
                'printer_name' => $job->printer_name,
                'printer_status' => $job->printer_status,
                'created_at' => $job->created_at?->toIso8601String(),
                'failed_at' => $job->updated_at?->toIso8601String(),
            ]),
        ]);
    }

    /**
     * Manually re-queue a failed print job back to the bridge.
     * Never creates a new job — re-uses the existing payload so nothing is lost.
     */
    public function retryJob(Request $request, $id)
    {
        $user = $request->user();

        if (! $user->isManager() && ! $user->isEmployee()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה להדפיס מחדש',
            ], 403);
        }

        $job = PrintJob::withoutGlobalScopes()
            ->where('restaurant_id', $user->restaurant_id)
            ->whereIn('status', ['failed'])
            ->findOrFail($id);

        $job->update([
            'status' => 'pending_bridge',
            'device_id' => null,
            'target_ip' => null,
            'target_port' => null,
            'error_message' => null,
            'attempts' => 0,
            'retry_count' => 0,
            'failed_notified_at' => null,
        ]);

        Log::info('Print job manually re-queued', [
            'job_id' => $job->id,
            'order_id' => $job->order_id,
            'user_id' => $user->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'ההזמנה נשלחה להדפסה מחדש',
        ]);
    }
}
