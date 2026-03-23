<?php

namespace App\Http\Controllers;

use App\Mail\DailyReportMail;
use App\Models\DailyReport;
use App\Models\Restaurant;
use App\Models\User;
use App\Services\DailyReportBackfillService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Mpdf\Mpdf;

class SuperAdminDailyReportsController extends Controller
{
    /**
     * יצירת דוחות יומיים חסרים — ימים עם הזמנות וללא שורת daily_reports.
     */
    public function backfillMissing(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
            'restaurant_ids' => 'nullable|array',
            'restaurant_ids.*' => 'integer|exists:restaurants,id',
        ]);

        $from = $validated['from'] ?? null;
        $to = $validated['to'] ?? null;
        $ids = $validated['restaurant_ids'] ?? null;

        $result = DailyReportBackfillService::backfillAll($ids, $from, $to);

        return response()->json([
            'success' => true,
            'message' => 'סיום מילוי דוחות חסרים',
            'data' => $result,
        ]);
    }

    /**
     * הורדת ZIP של PDF לפי תקופה (מסעדות נבחרות או כולן).
     */
    public function exportZip(Request $request)
    {
        $validated = $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
            'restaurant_ids' => 'nullable|array',
            'restaurant_ids.*' => 'integer|exists:restaurants,id',
        ]);

        $query = DailyReport::withoutGlobalScopes()
            ->with('restaurant')
            ->where('date', '>=', $validated['from'])
            ->where('date', '<=', $validated['to'])
            ->orderBy('date');

        if (! empty($validated['restaurant_ids'])) {
            $query->whereIn('restaurant_id', $validated['restaurant_ids']);
        }

        $reports = $query->get();

        if ($reports->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'אין דוחות בטווח התאריכים שנבחר',
            ], 404);
        }

        $zipPath = storage_path('app/temp/sa-reports-'.now()->timestamp.'.zip');
        $dir = dirname($zipPath);
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $zip = new \ZipArchive;
        if ($zip->open($zipPath, \ZipArchive::CREATE) !== true) {
            return response()->json(['success' => false, 'message' => 'שגיאה ביצירת קובץ ZIP'], 500);
        }

        foreach ($reports as $report) {
            $html = view('reports.daily-pdf', ['report' => $report])->render();

            $mpdf = new Mpdf([
                'mode' => 'utf-8',
                'format' => 'A4',
                'default_font' => 'arial',
                'directionality' => 'rtl',
                'margin_left' => 15,
                'margin_right' => 15,
                'margin_top' => 15,
                'margin_bottom' => 15,
            ]);
            $mpdf->WriteHTML($html);

            $date = $report->date->format('Y-m-d');
            $safeName = preg_replace('/[^\p{L}\p{N}_\-\s]/u', '', $report->restaurant?->name ?? 'report');
            $safeName = trim($safeName) ?: 'report';
            $pdfContent = $mpdf->Output('', 'S');
            $zip->addFromString("{$safeName}-{$date}.pdf", $pdfContent);
        }

        $zip->close();

        return response()->download($zipPath, 'daily-reports-'.$validated['from'].'-to-'.$validated['to'].'.zip')
            ->deleteFileAfterSend(true);
    }

    /**
     * שליחת מייל DailyReportMail לכל דוח בתקופה (למייל מוגדר למסעדה / בעלים).
     */
    public function sendEmails(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
            'restaurant_ids' => 'nullable|array',
            'restaurant_ids.*' => 'integer|exists:restaurants,id',
        ]);

        $query = DailyReport::withoutGlobalScopes()
            ->with('restaurant')
            ->where('date', '>=', $validated['from'])
            ->where('date', '<=', $validated['to'])
            ->orderBy('date');

        if (! empty($validated['restaurant_ids'])) {
            $query->whereIn('restaurant_id', $validated['restaurant_ids']);
        }

        $reports = $query->get();

        $sent = 0;
        $skipped = 0;
        $errors = [];

        foreach ($reports as $report) {
            $email = $this->resolveReportEmail($report);
            if (! $email) {
                $skipped++;

                continue;
            }
            try {
                Mail::to($email)->send(new DailyReportMail($report));
                $sent++;
            } catch (\Throwable $e) {
                $errors[] = "דוח {$report->id}: {$e->getMessage()}";
                Log::warning('SuperAdmin daily report email failed', ['report_id' => $report->id, 'error' => $e->getMessage()]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => "נשלחו {$sent} מיילים",
            'data' => [
                'sent' => $sent,
                'skipped_no_email' => $skipped,
                'errors' => $errors,
            ],
        ]);
    }

    /**
     * קישורי וואטסאפ (wa.me) עם טקסט מסכם לכל דוח — הדפדפן יפתח את האפליקציה.
     */
    public function whatsappLinks(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
            'restaurant_ids' => 'nullable|array',
            'restaurant_ids.*' => 'integer|exists:restaurants,id',
        ]);

        $query = DailyReport::withoutGlobalScopes()
            ->with('restaurant')
            ->where('date', '>=', $validated['from'])
            ->where('date', '<=', $validated['to'])
            ->orderBy('date');

        if (! empty($validated['restaurant_ids'])) {
            $query->whereIn('restaurant_id', $validated['restaurant_ids']);
        }

        $reports = $query->get();
        $links = [];

        foreach ($reports as $report) {
            $phone = $this->resolveWhatsappPhone($report->restaurant);
            if (! $phone) {
                continue;
            }
            $text = $this->buildWhatsappSummary($report);
            $url = 'https://wa.me/'.$phone.'?text='.rawurlencode($text);
            $links[] = [
                'report_id' => $report->id,
                'restaurant_id' => $report->restaurant_id,
                'restaurant_name' => $report->restaurant?->name,
                'date' => $report->date->format('Y-m-d'),
                'phone_e164_digits' => $phone,
                'url' => $url,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => ['links' => $links],
        ]);
    }

    private function resolveReportEmail(DailyReport $report): ?string
    {
        $restaurant = $report->restaurant;
        if (! $restaurant) {
            return null;
        }
        if ($restaurant->daily_report_email) {
            return $restaurant->daily_report_email;
        }
        $owner = User::where('restaurant_id', $restaurant->id)->where('role', 'owner')->first();

        return $owner?->email;
    }

    /** ספרות בלבד, כולל קידומת מדינה (972...) */
    private function resolveWhatsappPhone(?Restaurant $restaurant): ?string
    {
        if (! $restaurant) {
            return null;
        }
        $raw = $restaurant->phone ?? null;
        $owner = User::where('restaurant_id', $restaurant->id)->where('role', 'owner')->first();
        if (! $raw && $owner?->phone) {
            $raw = $owner->phone;
        }
        if (! $raw) {
            return null;
        }
        $digits = preg_replace('/\D+/', '', $raw);
        if (str_starts_with($digits, '0')) {
            $digits = '972'.substr($digits, 1);
        }
        if ($digits !== '' && ! str_starts_with($digits, '972')) {
            $digits = '972'.ltrim($digits, '0');
        }

        return strlen($digits) >= 11 ? $digits : null;
    }

    private function buildWhatsappSummary(DailyReport $report): string
    {
        $name = $report->restaurant?->name ?? '';
        $d = $report->date->format('d/m/Y');

        return "דוח יומי TakeEat — {$name} — {$d}\n"
            ."הזמנות: {$report->total_orders} | הכנסות: ₪".number_format((float) $report->total_revenue, 0)
            ."\nאיסוף: {$report->pickup_orders} | משלוח: {$report->delivery_orders}";
    }
}
