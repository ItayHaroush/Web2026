<?php

namespace App\Services;

use App\Models\DailyReport;
use App\Models\Restaurant;
use App\Models\User;
use App\Support\MpdfWritableConfig;
use Illuminate\Support\Collection;
use Mpdf\Mpdf;

class DailyReportDeliveryService
{
    /** ספרות בלבד ל-wa.me (972...) */
    public static function normalizePhoneE164(?string $raw): ?string
    {
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

    /**
     * סדר עדיפות: פלאפון בעלים במערכת → טלפון מסעדה → פלאפון משתמש owner
     */
    public static function resolveWhatsappPhone(?Restaurant $restaurant): ?string
    {
        if (! $restaurant) {
            return null;
        }
        $raw = $restaurant->owner_contact_phone ?: ($restaurant->phone ?? null);
        $owner = User::where('restaurant_id', $restaurant->id)->where('role', 'owner')->first();
        if (! $raw && $owner?->phone) {
            $raw = $owner->phone;
        }

        return self::normalizePhoneE164($raw);
    }

    /**
     * יצירת קובץ ZIP זמני עם PDF לכל דוח (מחזיר נתיב קובץ).
     */
    public static function buildZipPathForReports(Collection $reports, string $basename = 'daily-reports'): string
    {
        $dir = storage_path('app/temp');
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $zipPath = $dir.'/'.$basename.'-'.now()->timestamp.'-'.substr(sha1((string) microtime(true)), 0, 8).'.zip';

        $zip = new \ZipArchive;
        if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('לא ניתן ליצור קובץ ZIP');
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
            $safeName = preg_replace('/[^\p{L}\p{N}_\-\s]/u', '', $report->restaurant?->name ?? 'report');
            $safeName = trim($safeName) ?: 'report';
            $pdfContent = $mpdf->Output('', 'S');
            $zip->addFromString("{$safeName}-{$date}.pdf", $pdfContent);
        }

        $zip->close();

        return $zipPath;
    }

    /**
     * PDF אחד — כל דוח יום כעמודים רצופים (חלופה ל-ZIP של קבצים נפרדים).
     */
    public static function buildMergedPdfPathForReports(Collection $reports, string $basename = 'daily-reports-merged'): string
    {
        $dir = storage_path('app/temp');
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $pdfPath = $dir.'/'.$basename.'-'.now()->timestamp.'-'.substr(sha1((string) microtime(true)), 0, 8).'.pdf';

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

        $first = true;
        foreach ($reports as $report) {
            if (! $first) {
                $mpdf->AddPage();
            }
            $first = false;
            $html = view('reports.daily-pdf', ['report' => $report])->render();
            $mpdf->WriteHTML($html);
        }

        $mpdf->Output($pdfPath, 'F');

        return $pdfPath;
    }

    /**
     * טווח תאריכים לרבעון בלוח שנה (Asia/Jerusalem).
     *
     * @return array{0: \Carbon\Carbon, 1: \Carbon\Carbon, from: string, to: string}
     */
    public static function quarterDateRange(int $year, int $quarter): array
    {
        $startMonth = ($quarter - 1) * 3 + 1;
        $start = \Carbon\Carbon::parse(sprintf('%04d-%02d-01', $year, $startMonth), 'Asia/Jerusalem')->startOfDay();
        $end = $start->copy()->addMonths(3)->subDay()->endOfDay();

        return [$start, $end, $start->toDateString(), $end->toDateString()];
    }

    /**
     * סיכום רבעון מדוחות יומיים קיימים.
     *
     * @return array<string, mixed>
     */
    public static function aggregateQuarterlyForRestaurant(int $restaurantId, int $year, int $quarter): array
    {
        [$start, $end, $fromStr, $toStr] = self::quarterDateRange($year, $quarter);

        $reports = DailyReport::withoutGlobalScopes()
            ->with('restaurant:id,name,tenant_id')
            ->where('restaurant_id', $restaurantId)
            ->where('date', '>=', $fromStr)
            ->where('date', '<=', $toStr)
            ->orderBy('date')
            ->get();

        $restaurant = $reports->first()?->restaurant ?? Restaurant::withoutGlobalScopes()->find($restaurantId);

        $dailyBreakdown = $reports->map(fn (DailyReport $r) => [
            'date' => $r->date->format('Y-m-d'),
            'total_orders' => (int) $r->total_orders,
            'total_revenue' => (float) $r->total_revenue,
            'cancelled_orders' => (int) $r->cancelled_orders,
        ])->values()->all();

        return [
            'restaurant_id' => $restaurantId,
            'restaurant_name' => $restaurant?->name ?? '',
            'year' => $year,
            'quarter' => $quarter,
            'from' => $fromStr,
            'to' => $toStr,
            'days_with_reports' => $reports->count(),
            'total_orders' => (int) $reports->sum('total_orders'),
            'total_revenue' => (float) $reports->sum('total_revenue'),
            'total_cancelled_orders' => (int) $reports->sum('cancelled_orders'),
            'daily_breakdown' => $dailyBreakdown,
        ];
    }
}
