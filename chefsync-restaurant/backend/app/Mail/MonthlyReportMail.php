<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class MonthlyReportMail extends Mailable
{
    use Queueable, SerializesModels;

    private const HEBREW_MONTHS = [
        '01' => 'ינואר',
        '02' => 'פברואר',
        '03' => 'מרץ',
        '04' => 'אפריל',
        '05' => 'מאי',
        '06' => 'יוני',
        '07' => 'יולי',
        '08' => 'אוגוסט',
        '09' => 'ספטמבר',
        '10' => 'אוקטובר',
        '11' => 'נובמבר',
        '12' => 'דצמבר',
    ];

    /**
     * @param string $month בפורמט YYYY-MM
     * @param array $reportData נתוני הדוח
     */
    public function __construct(
        public string $month,
        public array $reportData = [],
    ) {}

    public function envelope(): Envelope
    {
        $monthHebrew = $this->getHebrewMonth();
        return new Envelope(
            subject: "דוח חודשי TakeEat — {$monthHebrew}",
        );
    }

    public function content(): Content
    {
        return new Content(
            htmlString: $this->buildHtml(),
        );
    }

    private function getHebrewMonth(): string
    {
        $parts = explode('-', $this->month);
        return (self::HEBREW_MONTHS[$parts[1] ?? ''] ?? '') . ' ' . ($parts[0] ?? '');
    }

    private function buildHtml(): string
    {
        $monthHebrew = $this->getHebrewMonth();
        $data = $this->reportData;

        $totalRestaurants = $data['total_restaurants'] ?? 0;
        $activeRestaurants = $data['active_restaurants'] ?? 0;
        $trialRestaurants = $data['trial_restaurants'] ?? 0;
        $newRestaurants = $data['new_restaurants'] ?? 0;
        $totalOrders = $data['total_orders'] ?? 0;
        $totalRevenue = $data['total_revenue'] ?? 0;
        $webOrders = $data['web_orders'] ?? 0;
        $webRevenue = $data['web_revenue'] ?? 0;
        $kioskOrders = $data['kiosk_orders'] ?? 0;
        $kioskRevenue = $data['kiosk_revenue'] ?? 0;
        $activeKiosks = $data['active_kiosks'] ?? 0;
        $totalKiosks = $data['total_kiosks'] ?? 0;
        $avgOrderValue = $totalOrders > 0 ? round($totalRevenue / $totalOrders, 2) : 0;
        $mrr = $data['mrr'] ?? 0;
        $invoicesSent = $data['invoices_sent'] ?? 0;
        $invoicesPaid = $data['invoices_paid'] ?? 0;
        $outstandingAmount = $data['outstanding_amount'] ?? 0;
        $topRestaurants = $data['top_restaurants'] ?? [];

        $body = '';

        // כותרת
        $body .= '<h1 style="margin: 0 0 8px; font-size: 22px; color: #1f2937; text-align: center;">דוח חודשי</h1>';
        $body .= '<p style="margin: 0 0 24px; font-size: 15px; color: #6b7280; text-align: center;">' . $monthHebrew . '</p>';

        // KPIs ראשיים
        $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">';
        $body .= '<tr>';
        $body .= EmailLayoutHelper::statCard(number_format($totalRevenue, 0) . ' &#8362;', 'הכנסות מהזמנות', '#22c55e');
        $body .= '<td style="width: 8px;"></td>';
        $body .= EmailLayoutHelper::statCard(number_format($totalOrders), 'סה״כ הזמנות', '#3b82f6');
        $body .= '<td style="width: 8px;"></td>';
        $body .= EmailLayoutHelper::statCard(number_format($mrr, 0) . ' &#8362;', 'MRR', '#f97316');
        $body .= '</tr></table>';

        // פילוח הזמנות: אתר vs קיוסק
        $body .= EmailLayoutHelper::sectionTitle('פילוח הזמנות');
        $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 16px;">';
        $body .= '<tr>';
        $body .= EmailLayoutHelper::statCard(number_format($webOrders), 'הזמנות אתר', '#3b82f6');
        $body .= '<td style="width: 6px;"></td>';
        $body .= EmailLayoutHelper::statCard(number_format($webRevenue, 0) . ' &#8362;', 'הכנסות אתר', '#2563eb');
        $body .= '<td style="width: 6px;"></td>';
        $body .= EmailLayoutHelper::statCard(number_format($kioskOrders), 'הזמנות קיוסק', '#8b5cf6');
        $body .= '<td style="width: 6px;"></td>';
        $body .= EmailLayoutHelper::statCard(number_format($kioskRevenue, 0) . ' &#8362;', 'הכנסות קיוסק', '#7c3aed');
        $body .= '</tr></table>';

        // קיוסקים
        if ($totalKiosks > 0) {
            $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 16px;">';
            $body .= '<tr>';
            $body .= EmailLayoutHelper::statCard((string) $activeKiosks, 'קיוסקים פעילים', '#22c55e');
            $body .= '<td style="width: 6px;"></td>';
            $body .= EmailLayoutHelper::statCard((string) $totalKiosks, 'סה״כ קיוסקים', '#6b7280');
            $body .= '</tr></table>';
        }

        // מסעדות
        $body .= EmailLayoutHelper::sectionTitle('מסעדות');
        $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 16px;">';
        $body .= '<tr>';
        $body .= EmailLayoutHelper::statCard((string) $totalRestaurants, 'סה״כ', '#6b7280');
        $body .= '<td style="width: 6px;"></td>';
        $body .= EmailLayoutHelper::statCard((string) $activeRestaurants, 'פעילות', '#22c55e');
        $body .= '<td style="width: 6px;"></td>';
        $body .= EmailLayoutHelper::statCard((string) $trialRestaurants, 'בניסיון', '#f59e0b');
        $body .= '<td style="width: 6px;"></td>';
        $body .= EmailLayoutHelper::statCard((string) $newRestaurants, 'חדשות החודש', '#3b82f6');
        $body .= '</tr></table>';

        // הזמנות וחיוב
        $body .= EmailLayoutHelper::sectionTitle('הזמנות וחיוב');
        $body .= EmailLayoutHelper::infoBox(
            EmailLayoutHelper::infoRow('סה״כ הזמנות', number_format($totalOrders))
                . EmailLayoutHelper::infoRow('הזמנות אתר', number_format($webOrders))
                . EmailLayoutHelper::infoRow('הזמנות קיוסק', number_format($kioskOrders))
                . EmailLayoutHelper::infoRow('מחזור הכנסות', number_format($totalRevenue, 2) . ' &#8362;')
                . EmailLayoutHelper::infoRow('הכנסות אתר', number_format($webRevenue, 2) . ' &#8362;')
                . EmailLayoutHelper::infoRow('הכנסות קיוסק', number_format($kioskRevenue, 2) . ' &#8362;')
                . EmailLayoutHelper::infoRow('ממוצע להזמנה', number_format($avgOrderValue, 2) . ' &#8362;')
                . EmailLayoutHelper::infoRow('חשבוניות שנשלחו', (string) $invoicesSent)
                . EmailLayoutHelper::infoRow('חשבוניות ששולמו', (string) $invoicesPaid)
                . EmailLayoutHelper::infoRow('יתרה לגבייה', number_format($outstandingAmount, 2) . ' &#8362;')
        );

        // טופ מסעדות
        if (!empty($topRestaurants)) {
            $body .= EmailLayoutHelper::sectionTitle('מסעדות מובילות');
            $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 16px;">';
            $body .= '<tr style="background: #f9fafb;">'
                . '<td style="padding: 8px 12px; font-size: 11px; font-weight: bold; color: #6b7280; border-bottom: 1px solid #e5e7eb;">מסעדה</td>'
                . '<td style="padding: 8px 12px; font-size: 11px; font-weight: bold; color: #6b7280; text-align: left; border-bottom: 1px solid #e5e7eb;">סה״כ</td>'
                . '<td style="padding: 8px 12px; font-size: 11px; font-weight: bold; color: #3b82f6; text-align: left; border-bottom: 1px solid #e5e7eb;">אתר</td>'
                . '<td style="padding: 8px 12px; font-size: 11px; font-weight: bold; color: #8b5cf6; text-align: left; border-bottom: 1px solid #e5e7eb;">קיוסק</td>'
                . '<td style="padding: 8px 12px; font-size: 11px; font-weight: bold; color: #6b7280; text-align: left; border-bottom: 1px solid #e5e7eb;">הכנסות</td>'
                . '</tr>';

            foreach (array_slice($topRestaurants, 0, 10) as $r) {
                $body .= '<tr>'
                    . '<td style="padding: 8px 12px; font-size: 13px; color: #1f2937; border-bottom: 1px solid #f3f4f6;">' . e($r['name'] ?? '') . '</td>'
                    . '<td style="padding: 8px 12px; font-size: 13px; color: #1f2937; text-align: left; border-bottom: 1px solid #f3f4f6; font-weight: bold;">' . number_format($r['orders'] ?? 0) . '</td>'
                    . '<td style="padding: 8px 12px; font-size: 13px; color: #3b82f6; text-align: left; border-bottom: 1px solid #f3f4f6;">' . number_format($r['web_orders'] ?? 0) . '</td>'
                    . '<td style="padding: 8px 12px; font-size: 13px; color: #8b5cf6; text-align: left; border-bottom: 1px solid #f3f4f6;">' . number_format($r['kiosk_orders'] ?? 0) . '</td>'
                    . '<td style="padding: 8px 12px; font-size: 13px; color: #f97316; text-align: left; border-bottom: 1px solid #f3f4f6; font-weight: bold;">' . number_format($r['revenue'] ?? 0, 2) . ' &#8362;</td>'
                    . '</tr>';
            }
            $body .= '</table>';
        }

        // כפתור לדשבורד
        $dashboardUrl = EmailLayoutHelper::siteUrl('/super-admin/dashboard');
        $body .= EmailLayoutHelper::ctaButton('צפייה בדשבורד', $dashboardUrl);

        return EmailLayoutHelper::wrap($body, "דוח חודשי TakeEat — {$monthHebrew}", 'info@chefsync.co.il');
    }
}
