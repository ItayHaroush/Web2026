<?php

namespace App\Http\Controllers;

use App\Models\PrintDevice;
use App\Models\PrintJob;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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
            'jobs' => $jobs->map(fn ($job) => [
                'id' => $job->id,
                'role' => $job->role,
                'order_id' => $job->order_id,
                'type' => $job->payload['type'] ?? 'custom',
                'text' => $job->payload['text'] ?? '',
                'target_ip' => $job->target_ip,
                'target_port' => $job->target_port,
                'created_at' => $job->created_at?->toIso8601String(),
            ]),
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
        $device->update(['last_seen_at' => now()]);

        return response()->json([
            'success' => true,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    // ─── Admin CRUD (sanctum auth) ───

    public function index(Request $request)
    {
        $user = $request->user();
        $devices = PrintDevice::where('restaurant_id', $user->restaurant_id)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($device) {
                $device->is_connected = $device->is_connected;
                return $device;
            });

        return response()->json([
            'success' => true,
            'devices' => $devices,
        ]);
    }

    public function register(Request $request)
    {
        $user = $request->user();

        if (!$user->isManager()) {
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
        if (!$restaurant) {
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

        if (!$user->isManager()) {
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
        ]);

        $device = PrintDevice::where('restaurant_id', $user->restaurant_id)->findOrFail($id);
        $device->update($request->only(['name', 'role', 'printer_ip', 'printer_port']));

        return response()->json([
            'success' => true,
            'message' => 'מכשיר הדפסה עודכן בהצלחה!',
            'device' => $device,
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager()) {
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

        if (!$user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לשנות סטטוס מכשיר',
            ], 403);
        }

        $device = PrintDevice::where('restaurant_id', $user->restaurant_id)->findOrFail($id);
        $device->is_active = !$device->is_active;
        $device->save();

        return response()->json([
            'success' => true,
            'message' => $device->is_active ? 'מכשיר הדפסה הופעל!' : 'מכשיר הדפסה כובה',
            'device' => $device,
        ]);
    }
}
