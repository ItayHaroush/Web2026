<?php

namespace App\Http\Controllers;

use App\Models\PrintDevice;
use App\Models\PrintJob;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PrintAgentController extends Controller
{
    // ─── Agent API (device-token auth) ───

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
                ->lockForUpdate()
                ->limit(5)
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
        ]);

        $job = PrintJob::withoutGlobalScopes()
            ->where('device_id', $device->id)
            ->where('status', 'printing')
            ->findOrFail($id);

        $job->update([
            'status' => $request->input('status'),
            'error_message' => $request->input('error_message'),
        ]);

        if ($request->input('status') === 'failed') {
            $device->update([
                'last_error_message' => $request->input('error_message'),
                'last_error_at' => now(),
            ]);
        }

        return response()->json(['success' => true]);
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
        $device->update($request->only(['name', 'role', 'printer_ip', 'printer_port', 'codepage_id']));

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
}
