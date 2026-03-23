<?php

namespace App\Http\Controllers;

use App\Mail\DailyReportsPeriodZipMail;
use App\Models\DailyReport;
use App\Models\Restaurant;
use App\Models\User;
use App\Services\DailyReportBackfillService;
use App\Services\DailyReportDeliveryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
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

        $zipPath = DailyReportDeliveryService::buildZipPathForReports($reports, 'sa-export');
        $filename = 'daily-reports-'.$validated['from'].'-to-'.$validated['to'].'.zip';

        return response()->download($zipPath, $filename, [
            'Content-Type' => 'application/zip',
        ])->deleteFileAfterSend(true);
    }

    /**
     * מייל אחד לכל מסעדה — קובץ ZIP אחד עם כל ה-PDF בתקופה (לא מייל לכל דוח).
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
        $byRestaurant = $reports->groupBy('restaurant_id');

        $emailsSent = 0;
        $skippedNoEmail = 0;
        $errors = [];

        foreach ($byRestaurant as $restaurantId => $collection) {
            /** @var \Illuminate\Support\Collection $collection */
            $first = $collection->first();
            $restaurant = $first->restaurant ?? Restaurant::withoutGlobalScopes()->find($restaurantId);
            if (! $restaurant) {
                continue;
            }

            $email = $this->resolveReportEmailForRestaurant($restaurant);
            if (! $email) {
                $skippedNoEmail++;

                continue;
            }

            $zipPath = null;
            try {
                $zipPath = DailyReportDeliveryService::buildZipPathForReports($collection, 'email-'.$restaurantId);

                Mail::to($email)->send(new DailyReportsPeriodZipMail(
                    $restaurant,
                    $validated['from'],
                    $validated['to'],
                    $zipPath
                ));
                $emailsSent++;
            } catch (\Throwable $e) {
                $errors[] = "{$restaurant->name}: {$e->getMessage()}";
                Log::warning('SuperAdmin daily reports zip email failed', [
                    'restaurant_id' => $restaurantId,
                    'error' => $e->getMessage(),
                ]);
            } finally {
                if ($zipPath && File::exists($zipPath)) {
                    @unlink($zipPath);
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => "נשלחו {$emailsSent} מיילים (מייל אחד לכל מסעדה עם ZIP)",
            'data' => [
                'sent' => $emailsSent,
                'skipped_no_email' => $skippedNoEmail,
                'errors' => $errors,
            ],
        ]);
    }

    /**
     * קישור וואטסאפ אחד לכל מסעדה — למספר owner_contact_phone (או גיבוי), טקסט מצטבר לתקופה.
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
        $byRestaurant = $reports->groupBy('restaurant_id');
        $links = [];

        foreach ($byRestaurant as $restaurantId => $collection) {
            $restaurant = $collection->first()->restaurant ?? Restaurant::withoutGlobalScopes()->find($restaurantId);
            if (! $restaurant) {
                continue;
            }
            $phone = DailyReportDeliveryService::resolveWhatsappPhone($restaurant);
            if (! $phone) {
                continue;
            }
            $text = $this->buildWhatsappAggregatedSummary($restaurant, $collection, $validated['from'], $validated['to']);
            $links[] = [
                'restaurant_id' => (int) $restaurantId,
                'restaurant_name' => $restaurant->name,
                'phone_e164_digits' => $phone,
                'reports_count' => $collection->count(),
                'url' => 'https://wa.me/'.$phone.'?text='.rawurlencode($text),
            ];
        }

        return response()->json([
            'success' => true,
            'data' => ['links' => $links],
        ]);
    }

    /**
     * סיכום רבעון (JSON) — כל דוחות היום של מסעדה ברבעון בשנה.
     */
    public function quarterlySummary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'restaurant_id' => 'required|integer|exists:restaurants,id',
            'year' => 'required|integer|min:2020|max:2100',
            'quarter' => 'required|integer|min:1|max:4',
        ]);

        $data = DailyReportDeliveryService::aggregateQuarterlyForRestaurant(
            $validated['restaurant_id'],
            $validated['year'],
            $validated['quarter']
        );

        return response()->json([
            'success' => true,
            'message' => 'סיכום רבעון',
            'data' => $data,
        ]);
    }

    /**
     * ייצוא PDF לדוח רבעון (מבוסס סיכום מצטבר).
     */
    public function quarterlyPdf(Request $request)
    {
        $validated = $request->validate([
            'restaurant_id' => 'required|integer|exists:restaurants,id',
            'year' => 'required|integer|min:2020|max:2100',
            'quarter' => 'required|integer|min:1|max:4',
        ]);

        $summary = DailyReportDeliveryService::aggregateQuarterlyForRestaurant(
            $validated['restaurant_id'],
            $validated['year'],
            $validated['quarter']
        );

        $restaurant = Restaurant::withoutGlobalScopes()->findOrFail($validated['restaurant_id']);

        $html = view('reports.quarterly-pdf', [
            'summary' => $summary,
            'restaurant' => $restaurant,
        ])->render();

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

        $fn = 'quarterly-'.$validated['year'].'-Q'.$validated['quarter'].'-'.$restaurant->tenant_id.'.pdf';

        return response($mpdf->Output('', 'S'), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$fn.'"',
        ]);
    }

    private function resolveReportEmailForRestaurant(Restaurant $restaurant): ?string
    {
        if ($restaurant->daily_report_email) {
            return $restaurant->daily_report_email;
        }
        $owner = User::where('restaurant_id', $restaurant->id)->where('role', 'owner')->first();

        return $owner?->email;
    }

    private function buildWhatsappAggregatedSummary(
        Restaurant $restaurant,
        $collection,
        string $from,
        string $to
    ): string {
        $name = $restaurant->name ?? '';
        $orders = (int) $collection->sum('total_orders');
        $rev = (float) $collection->sum('total_revenue');
        $days = $collection->count();

        return "דוחות יומיים TakeEat — {$name}\n"
            ."תקופה: {$from} — {$to}\n"
            ."ימים עם דוח: {$days}\n"
            ."סה״כ הזמנות: {$orders} | סה״כ הכנסות: ₪".number_format($rev, 0);
    }
}
