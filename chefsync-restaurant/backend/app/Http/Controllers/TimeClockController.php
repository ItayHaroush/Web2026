<?php

namespace App\Http\Controllers;

use App\Models\EmployeeTimeLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class TimeClockController extends Controller
{
    /**
     * Round minutes to nearest 15-minute increment.
     * 0-7 → 0, 8-22 → 15, 23-37 → 30, 38-52 → 45, 53-67 → 60
     */
    private function roundTo15(int $minutes): int
    {
        return (int) (round($minutes / 15) * 15);
    }

    /**
     * POST /api/admin/time/clock
     */
    public function clock(Request $request)
    {
        $request->validate(['pin' => 'required|string|size:4']);

        $currentUser = $request->user();
        $restaurantId = $currentUser->restaurant_id;

        $employees = User::where('restaurant_id', $restaurantId)
            ->whereNotNull('pos_pin_hash')
            ->where('is_active', true)
            ->get();

        $matched = null;
        foreach ($employees as $emp) {
            if (Hash::check($request->pin, $emp->pos_pin_hash)) {
                $matched = $emp;
                break;
            }
        }

        if (!$matched) {
            return response()->json([
                'success' => false,
                'message' => 'קוד PIN שגוי',
            ], 401);
        }

        $openLog = EmployeeTimeLog::where('user_id', $matched->id)
            ->where('restaurant_id', $restaurantId)
            ->whereNull('clock_out')
            ->latest('clock_in')
            ->first();

        if ($openLog) {
            $now = Carbon::now();
            $rawMinutes = (int) $openLog->clock_in->diffInMinutes($now);
            $openLog->update([
                'clock_out' => $now,
                'total_minutes' => $rawMinutes,
            ]);

            $roundedMinutes = $this->roundTo15($rawMinutes);
            $hourlyRate = $matched->hourly_rate ? (float) $matched->hourly_rate : null;
            $roundedHours = round($roundedMinutes / 60, 2);

            return response()->json([
                'success' => true,
                'action' => 'clock_out',
                'employee' => $matched->name,
                'role' => $matched->role,
                'time' => $now->format('H:i'),
                'clock_in_time' => $openLog->clock_in->format('H:i'),
                'clock_out_time' => $now->format('H:i'),
                'date' => $now->format('d/m/Y'),
                'raw_minutes' => $rawMinutes,
                'rounded_minutes' => $roundedMinutes,
                'total_hours' => $roundedHours,
                'hourly_rate' => $hourlyRate,
                'total_pay' => ($hourlyRate && $matched->role !== 'owner')
                    ? round($roundedHours * $hourlyRate, 2)
                    : null,
            ]);
        }

        EmployeeTimeLog::create([
            'user_id' => $matched->id,
            'restaurant_id' => $restaurantId,
            'clock_in' => Carbon::now(),
        ]);

        return response()->json([
            'success' => true,
            'action' => 'clock_in',
            'employee' => $matched->name,
            'time' => Carbon::now()->format('H:i'),
        ]);
    }

    /**
     * POST /api/admin/time/set-pin
     */
    public function setPin(Request $request)
    {
        $request->validate([
            'user_id' => 'required|integer',
            'pin' => 'required|string|size:4',
        ]);

        $currentUser = $request->user();

        if (!$currentUser->isManager()) {
            return response()->json(['success' => false, 'message' => 'אין הרשאה'], 403);
        }

        $employee = User::where('restaurant_id', $currentUser->restaurant_id)
            ->findOrFail($request->user_id);

        $employee->update(['pos_pin_hash' => Hash::make($request->pin)]);

        return response()->json([
            'success' => true,
            'message' => 'קוד PIN עודכן בהצלחה',
        ]);
    }

    /**
     * GET /api/admin/time/today
     */
    public function today(Request $request)
    {
        $currentUser = $request->user();
        $restaurantId = $currentUser->restaurant_id;
        $today = Carbon::today();

        $logs = EmployeeTimeLog::where('restaurant_id', $restaurantId)
            ->where('clock_in', '>=', $today)
            ->with('user:id,name,role')
            ->orderBy('clock_in', 'desc')
            ->get()
            ->map(function ($log) {
                $rawMinutes = $log->total_minutes;
                if (!$rawMinutes && $log->clock_out) {
                    $rawMinutes = (int) $log->clock_in->diffInMinutes($log->clock_out);
                }

                return [
                    'id' => $log->id,
                    'employee_name' => $log->user->name ?? '—',
                    'role' => $log->user->role ?? '—',
                    'clock_in' => $log->clock_in->format('H:i'),
                    'clock_out' => $log->clock_out?->format('H:i'),
                    'raw_minutes' => $rawMinutes,
                    'is_active' => is_null($log->clock_out),
                ];
            });

        return response()->json(['success' => true, 'logs' => $logs]);
    }

    /**
     * GET /api/admin/time/report?from=&to=&user_id=
     */
    public function report(Request $request)
    {
        $currentUser = $request->user();

        if (!$currentUser->isManager()) {
            return response()->json(['success' => false, 'message' => 'אין הרשאה'], 403);
        }

        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date',
            'user_id' => 'nullable|integer',
        ]);

        $restaurantId = $currentUser->restaurant_id;
        $from = Carbon::parse($request->from)->startOfDay();
        $to = Carbon::parse($request->to)->endOfDay();

        $query = EmployeeTimeLog::where('restaurant_id', $restaurantId)
            ->whereBetween('clock_in', [$from, $to])
            ->whereNotNull('clock_out');

        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        $logs = $query->with('user:id,name,role,hourly_rate')
            ->orderBy('clock_in', 'asc')
            ->get();

        $grouped = $logs->groupBy('user_id')->map(function ($userLogs) {
            $user = $userLogs->first()->user;
            $isOwner = $user->role === 'owner';
            $hourlyRate = $user->hourly_rate ? (float) $user->hourly_rate : null;

            $totalRawMinutes = $userLogs->sum('total_minutes');
            $totalRoundedMinutes = $this->roundTo15($totalRawMinutes);
            $totalHours = round($totalRoundedMinutes / 60, 2);

            return [
                'user_id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
                'is_owner' => $isOwner,
                'hourly_rate' => $hourlyRate,
                'raw_minutes' => $totalRawMinutes,
                'rounded_minutes' => $totalRoundedMinutes,
                'total_hours' => $totalHours,
                'total_pay' => (!$isOwner && $hourlyRate) ? round($totalHours * $hourlyRate, 2) : null,
                'days' => $userLogs->groupBy(fn($l) => $l->clock_in->format('Y-m-d'))->map(function ($dayLogs, $date) {
                    $dayRawMinutes = $dayLogs->sum('total_minutes');
                    $dayRoundedMinutes = $this->roundTo15($dayRawMinutes);

                    return [
                        'date' => $date,
                        'entries' => $dayLogs->map(function ($l) {
                            $rawMin = $l->total_minutes ?? (int) $l->clock_in->diffInMinutes($l->clock_out);
                            return [
                                'clock_in' => $l->clock_in->format('H:i'),
                                'clock_out' => $l->clock_out->format('H:i'),
                                'raw_minutes' => $rawMin,
                                'rounded_minutes' => $this->roundTo15($rawMin),
                                'hours' => round($this->roundTo15($rawMin) / 60, 2),
                            ];
                        })->values(),
                        'raw_minutes' => $dayRawMinutes,
                        'total_hours' => round($dayRoundedMinutes / 60, 2),
                    ];
                })->values(),
            ];
        })->values();

        $payrollEmployees = $grouped->filter(fn($e) => !$e['is_owner']);
        $ownerEntries = $grouped->filter(fn($e) => $e['is_owner']);

        return response()->json([
            'success' => true,
            'employees' => $grouped,
            'summary' => [
                'payroll_employee_count' => $payrollEmployees->count(),
                'payroll_hours' => round($payrollEmployees->sum('total_hours'), 2),
                'payroll_total' => round($payrollEmployees->sum('total_pay'), 2),
                'owner_hours' => round($ownerEntries->sum('total_hours'), 2),
                'total_hours' => round($grouped->sum('total_hours'), 2),
                'total_pay' => round($payrollEmployees->sum('total_pay'), 2),
                'from' => $from->format('Y-m-d'),
                'to' => $to->format('Y-m-d'),
            ],
        ]);
    }

    /**
     * GET /api/admin/time/my-report?from=&to=
     */
    public function myReport(Request $request)
    {
        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date',
        ]);

        $user = $request->user();
        $from = Carbon::parse($request->from)->startOfDay();
        $to = Carbon::parse($request->to)->endOfDay();

        $logs = EmployeeTimeLog::where('user_id', $user->id)
            ->where('restaurant_id', $user->restaurant_id)
            ->whereBetween('clock_in', [$from, $to])
            ->whereNotNull('clock_out')
            ->orderBy('clock_in', 'asc')
            ->get();

        $totalRawMinutes = $logs->sum('total_minutes');
        $totalRoundedMinutes = $this->roundTo15($totalRawMinutes);
        $totalHours = round($totalRoundedMinutes / 60, 2);
        $hourlyRate = $user->hourly_rate ? (float) $user->hourly_rate : null;

        $entries = $logs->map(function ($l) {
            $rawMin = $l->total_minutes ?? (int) $l->clock_in->diffInMinutes($l->clock_out);
            $roundedMin = $this->roundTo15($rawMin);
            return [
                'date' => $l->clock_in->format('Y-m-d'),
                'clock_in' => $l->clock_in->format('H:i'),
                'clock_out' => $l->clock_out->format('H:i'),
                'raw_minutes' => $rawMin,
                'rounded_minutes' => $roundedMin,
                'hours' => round($roundedMin / 60, 2),
            ];
        });

        return response()->json([
            'success' => true,
            'entries' => $entries,
            'summary' => [
                'total_hours' => $totalHours,
                'raw_minutes' => $totalRawMinutes,
                'rounded_minutes' => $totalRoundedMinutes,
                'hourly_rate' => $hourlyRate,
                'total_pay' => $hourlyRate ? round($totalHours * $hourlyRate, 2) : null,
                'from' => $from->format('Y-m-d'),
                'to' => $to->format('Y-m-d'),
            ],
        ]);
    }
}
