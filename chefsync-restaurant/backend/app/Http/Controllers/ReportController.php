<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\DailyReport;
use App\Models\Restaurant;
use App\Models\Order;
use App\Models\User;
use App\Mail\DailyReportMail;
use App\Console\Commands\GenerateDailyReportsJob;
use App\Services\DailyReportDeliveryService;
use App\Support\MpdfWritableConfig;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Mpdf\Mpdf;

class ReportController extends Controller
{
    private function applyOwnerDailyReportCutoff($query, Restaurant $restaurant): void
    {
        if ($restaurant->owner_activity_started_at) {
            $query->where('date', '>=', $restaurant->owner_activity_started_at->toDateString());
        }
    }

    private function assertDailyReportVisibleToOwner(DailyReport $report, Restaurant $restaurant): void
    {
        if ($restaurant->owner_activity_started_at
            && $report->date
            && $report->date->toDateString() < $restaurant->owner_activity_started_at->toDateString()) {
            abort(404, 'הדוח לא זמין');
        }
    }

    /**
     * רשימת דוחות יומיים עם פילטרים
     * GET /admin/reports
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $perPage = $request->integer('per_page', 30);

        $restaurant = Restaurant::where('tenant_id', app('tenant_id'))->firstOrFail();

        $query = DailyReport::orderBy('date', 'desc');
        $this->applyOwnerDailyReportCutoff($query, $restaurant);

        if ($request->filled('from')) {
            $query->where('date', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->where('date', '<=', $request->input('to'));
        }

        $reports = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'message' => 'דוחות יומיים',
            'data' => $reports,
        ]);
    }

    /**
     * דוח יומי בודד
     * GET /admin/reports/{id}
     */
    public function show(int $id): JsonResponse
    {
        $restaurant = Restaurant::where('tenant_id', app('tenant_id'))->firstOrFail();
        $report = DailyReport::findOrFail($id);
        $this->assertDailyReportVisibleToOwner($report, $restaurant);

        return response()->json([
            'success' => true,
            'message' => 'דוח יומי',
            'data' => $report,
        ]);
    }

    /**
     * ייצוא דוח בודד כ-PDF
     * GET /admin/reports/{id}/pdf
     */
    public function pdf(int $id)
    {
        try {
            $restaurant = Restaurant::where('tenant_id', app('tenant_id'))->firstOrFail();
            $report = DailyReport::with('restaurant')->findOrFail($id);
            $this->assertDailyReportVisibleToOwner($report, $restaurant);

            $html = view('reports.daily-pdf', ['report' => $report])->render();

            $mpdf = new Mpdf(MpdfWritableConfig::merge([
                'mode' => 'utf-8',
                'format' => 'A4',
                'default_font' => 'arial',
                'directionality' => 'rtl',
                'margin_left' => 15,
                'margin_right' => 15,
                'margin_top' => 15,
                'margin_bottom' => 15,
            ]));

            $mpdf->WriteHTML($html);

            $date = $report->date instanceof \Carbon\Carbon ? $report->date->format('Y-m-d') : $report->date;
            $name = $report->restaurant?->name ?? 'report';
            $filename = "daily-report-{$name}-{$date}.pdf";

            return response($mpdf->Output($filename, 'S'), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            ]);
        } catch (\Exception $e) {
            Log::error('PDF generation failed', [
                'report_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'שגיאה ביצירת PDF: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * ייצוא דוחות כ-CSV
     * GET /admin/reports/csv
     */
    public function csv(Request $request)
    {
        $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);

        $restaurant = Restaurant::where('tenant_id', app('tenant_id'))->firstOrFail();

        $query = DailyReport::orderBy('date', 'desc');
        $this->applyOwnerDailyReportCutoff($query, $restaurant);

        if ($request->filled('from')) {
            $query->where('date', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->where('date', '<=', $request->input('to'));
        }

        $reports = $query->get();

        $restaurantName = $restaurant->name ?? '';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="daily-reports.csv"',
        ];

        $callback = function () use ($reports, $restaurantName) {
            $file = fopen('php://output', 'w');
            // BOM for Hebrew in Excel
            fwrite($file, "\xEF\xBB\xBF");

            // כותרת מערכת
            fputcsv($file, ['TakeEat - דוחות יומיים']);
            fputcsv($file, [$restaurantName]);
            fputcsv($file, ['הופק אוטומטית ע״י מערכת TakeEat', now()->format('d/m/Y H:i')]);
            fputcsv($file, []); // שורה ריקה

            fputcsv($file, [
                'תאריך',
                'הזמנות',
                'הכנסות',
                'איסוף',
                'משלוח',
                'אונליין',
                'הכנסות אונליין',
                'קיוסק',
                'הכנסות קיוסק',
                'קופה',
                'הכנסות קופה',
                'לשבת',
                'לקחת',
                'מזומן',
                'אשראי',
                'ביטולים',
                'סכום ביטולים',
                'ממוצע להזמנה',
            ]);

            foreach ($reports as $r) {
                fputcsv($file, [
                    $r->date->format('Y-m-d'),
                    $r->total_orders,
                    $r->total_revenue,
                    $r->pickup_orders,
                    $r->delivery_orders,
                    $r->web_orders,
                    $r->web_revenue,
                    $r->kiosk_orders,
                    $r->kiosk_revenue,
                    $r->pos_orders,
                    $r->pos_revenue,
                    $r->dine_in_orders,
                    $r->takeaway_orders,
                    $r->cash_total,
                    $r->credit_total,
                    $r->cancelled_orders,
                    $r->cancelled_total,
                    $r->avg_order_value,
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * ייצוא CSV מס (עסקאות בודדות)
     * GET /admin/reports/tax-csv
     */
    public function taxCsv(Request $request)
    {
        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date',
        ]);

        $from = Carbon::parse($request->input('from'))->startOfDay();
        $to = Carbon::parse($request->input('to'))->endOfDay();

        $restaurant = Restaurant::where('tenant_id', app('tenant_id'))->firstOrFail();

        $orders = Order::where('restaurant_id', $restaurant->id)
            ->forOwnerReporting($restaurant)
            ->whereBetween('created_at', [$from, $to])
            ->where('is_test', false)
            ->where('status', '!=', 'cancelled')
            ->orderBy('created_at')
            ->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="tax-export.csv"',
        ];

        $callback = function () use ($orders) {
            $file = fopen('php://output', 'w');
            fwrite($file, "\xEF\xBB\xBF");

            // כותרת מערכת
            fputcsv($file, ['TakeEat - ייצוא עסקאות למס']);
            fputcsv($file, ['הופק אוטומטית ע״י מערכת TakeEat', now()->format('d/m/Y H:i')]);
            fputcsv($file, []); // שורה ריקה

            fputcsv($file, [
                'מזהה הזמנה',
                'תאריך',
                'שעה',
                'שם לקוח',
                'טלפון',
                'סכום',
                'אמצעי תשלום',
                'סוג',
                'סטטוס',
            ]);

            foreach ($orders as $o) {
                fputcsv($file, [
                    $o->id,
                    $o->created_at->format('Y-m-d'),
                    $o->created_at->format('H:i'),
                    $o->customer_name ?? '',
                    $o->phone ?? '',
                    $o->total_amount,
                    $o->payment_method ?? '',
                    $o->delivery_method ?? '',
                    $o->status,
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * ייצוא ZIP עם דוחות PDF מרובים
     * GET /admin/reports/zip
     */
    public function zip(Request $request)
    {
        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date',
        ]);

        $restaurant = Restaurant::where('tenant_id', app('tenant_id'))->firstOrFail();

        $reportsQuery = DailyReport::with('restaurant')
            ->where('date', '>=', $request->input('from'))
            ->where('date', '<=', $request->input('to'))
            ->orderBy('date');
        $this->applyOwnerDailyReportCutoff($reportsQuery, $restaurant);
        $reports = $reportsQuery->get();

        if ($reports->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'אין דוחות בטווח התאריכים שנבחר',
            ], 404);
        }

        $zipPath = storage_path('app/temp/reports-' . now()->timestamp . '.zip');
        $dir = dirname($zipPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $zip = new \ZipArchive();
        if ($zip->open($zipPath, \ZipArchive::CREATE) !== true) {
            return response()->json(['success' => false, 'message' => 'שגיאה ביצירת קובץ ZIP'], 500);
        }

        foreach ($reports as $report) {
            $html = view('reports.daily-pdf', ['report' => $report])->render();

            $mpdf = new Mpdf(MpdfWritableConfig::merge([
                'mode' => 'utf-8',
                'format' => 'A4',
                'default_font' => 'arial',
                'directionality' => 'rtl',
                'margin_left' => 15,
                'margin_right' => 15,
                'margin_top' => 15,
                'margin_bottom' => 15,
            ]));
            $mpdf->WriteHTML($html);

            $date = $report->date->format('Y-m-d');
            $name = $report->restaurant?->name ?? 'report';
            $pdfContent = $mpdf->Output('', 'S');
            $zip->addFromString("report-{$name}-{$date}.pdf", $pdfContent);
        }

        $zip->close();

        $zipName = 'reports-' . ($restaurant->name ?? 'takeeat') . '.zip';

        return response()->download($zipPath, $zipName)->deleteFileAfterSend(true);
    }

    /**
     * יצירת דוח ידנית (idempotent)
     * POST /admin/reports/generate
     */
    public function generate(Request $request): JsonResponse
    {
        $request->validate([
            'date' => 'required|date|before_or_equal:today',
        ]);

        $restaurant = Restaurant::where('tenant_id', app('tenant_id'))->firstOrFail();

        $dateStr = Carbon::parse($request->input('date'))->toDateString();
        if ($restaurant->owner_activity_started_at
            && $dateStr < $restaurant->owner_activity_started_at->toDateString()) {
            return response()->json([
                'success' => false,
                'message' => 'אין דוח לתקופה זו (לפני תאריך תחילת הפעילות)',
            ], 422);
        }

        $tz = 'Asia/Jerusalem';
        $startOfDay = Carbon::parse($dateStr, $tz)->startOfDay();
        $endOfDay = Carbon::parse($dateStr, $tz)->endOfDay();

        $report = GenerateDailyReportsJob::generateForRestaurant(
            $restaurant,
            $dateStr,
            $startOfDay,
            $endOfDay
        );

        if (!$report) {
            return response()->json([
                'success' => false,
                'message' => 'אין הזמנות ביום שנבחר',
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'דוח נוצר בהצלחה',
            'data' => $report,
        ]);
    }

    /**
     * סיכום דוחות לסופר אדמין (כל המסעדות)
     * GET /super-admin/reports/summary
     */
    public function superAdminSummary(Request $request): JsonResponse
    {
        $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);

        $from = $request->input('from', Carbon::now('Asia/Jerusalem')->subDays(7)->toDateString());
        $to = $request->input('to', Carbon::now('Asia/Jerusalem')->subDay()->toDateString());

        $reports = DailyReport::withoutGlobalScopes()
            ->with('restaurant:id,name,tenant_id')
            ->where('date', '>=', $from)
            ->where('date', '<=', $to)
            ->get();

        $summary = [
            'from' => $from,
            'to' => $to,
            'total_restaurants' => $reports->pluck('restaurant_id')->unique()->count(),
            'total_orders' => $reports->sum('total_orders'),
            'total_revenue' => (float) $reports->sum('total_revenue'),
            'total_cancelled' => $reports->sum('cancelled_orders'),
            'avg_order_value' => $reports->sum('total_orders') > 0
                ? round($reports->sum('total_revenue') / $reports->sum('total_orders'), 2)
                : 0,
            'daily_breakdown' => $reports->groupBy(fn($r) => $r->date->format('Y-m-d'))
                ->map(fn($dayReports) => [
                    'date' => $dayReports->first()->date->format('Y-m-d'),
                    'orders' => $dayReports->sum('total_orders'),
                    'revenue' => (float) $dayReports->sum('total_revenue'),
                    'restaurants' => $dayReports->count(),
                ])
                ->values(),
            'restaurant_breakdown' => $reports->groupBy('restaurant_id')
                ->map(fn($rReports) => [
                    'restaurant_id' => $rReports->first()->restaurant_id,
                    'name' => $rReports->first()->restaurant?->name ?? '',
                    'orders' => $rReports->sum('total_orders'),
                    'revenue' => (float) $rReports->sum('total_revenue'),
                    'days' => $rReports->count(),
                ])
                ->sortByDesc('revenue')
                ->values(),
        ];

        return response()->json([
            'success' => true,
            'message' => 'סיכום דוחות מערכת',
            'data' => $summary,
        ]);
    }

    /**
     * שליחה מרוכזת: מייל / קישורי וואטסאפ / טקסט להעתקה — לדוחות שנבחרו (טננט נוכחי).
     */
    public function bulkDispatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'report_ids' => 'required|array|min:1',
            'report_ids.*' => 'integer|exists:daily_reports,id',
            'send_email' => 'sometimes|boolean',
            'whatsapp' => 'sometimes|boolean',
            'copy_text' => 'sometimes|boolean',
        ]);

        $sendEmail = $validated['send_email'] ?? false;
        $whatsapp = $validated['whatsapp'] ?? false;
        $copyText = $validated['copy_text'] ?? false;

        if (!$sendEmail && !$whatsapp && !$copyText) {
            return response()->json([
                'success' => false,
                'message' => 'בחר לפחות פעולה אחת (מייל, וואטסאפ או העתקה)',
            ], 422);
        }

        $ids = array_values(array_unique($validated['report_ids']));
        $reports = DailyReport::whereIn('id', $ids)->with('restaurant')->orderBy('date')->get();

        if ($reports->count() !== count($ids)) {
            return response()->json([
                'success' => false,
                'message' => 'חלק מהדוחות לא נמצאו או לא שייכים למסעדה',
            ], 422);
        }

        $sent = 0;
        $skippedNoEmail = 0;
        $errors = [];
        $links = [];
        $lines = [];

        foreach ($reports as $report) {
            if ($sendEmail) {
                $email = $this->resolveBulkReportEmail($report);
                if (!$email) {
                    $skippedNoEmail++;
                } else {
                    try {
                        Mail::to($email)->send(new DailyReportMail($report));
                        $sent++;
                    } catch (\Throwable $e) {
                        $errors[] = "דוח {$report->id}: {$e->getMessage()}";
                        Log::warning('Admin bulk daily report email failed', ['report_id' => $report->id, 'error' => $e->getMessage()]);
                    }
                }
            }

            if ($whatsapp) {
                $phone = DailyReportDeliveryService::resolveWhatsappPhone($report->restaurant);
                if ($phone) {
                    $text = $this->buildBulkWhatsappSummary($report);
                    $links[] = [
                        'report_id' => $report->id,
                        'date' => $report->date->format('Y-m-d'),
                        'url' => 'https://wa.me/' . $phone . '?text=' . rawurlencode($text),
                    ];
                }
            }

            if ($copyText) {
                $lines[] = $this->buildBulkWhatsappSummary($report);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'בוצע',
            'data' => [
                'emails_sent' => $sent,
                'skipped_no_email' => $skippedNoEmail,
                'errors' => $errors,
                'whatsapp_links' => $links,
                'copy_text' => $copyText ? implode("\n\n---\n\n", $lines) : null,
            ],
        ]);
    }

    private function resolveBulkReportEmail(DailyReport $report): ?string
    {
        $restaurant = $report->restaurant;
        if (!$restaurant) {
            return null;
        }
        if ($restaurant->daily_report_email) {
            return $restaurant->daily_report_email;
        }
        $owner = User::where('restaurant_id', $restaurant->id)->where('role', 'owner')->first();

        return $owner?->email;
    }

    private function buildBulkWhatsappSummary(DailyReport $report): string
    {
        $name = $report->restaurant?->name ?? '';
        $d = $report->date->format('d/m/Y');

        return "דוח יומי TakeEat — {$name} — {$d}\n"
            . "הזמנות: {$report->total_orders} | הכנסות: ₪" . number_format((float) $report->total_revenue, 0)
            . "\nאיסוף: {$report->pickup_orders} | משלוח: {$report->delivery_orders}";
    }
}
