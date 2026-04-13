<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Models\DailyReport;

class DailyReportMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public DailyReport $report,
    ) {}

    public function envelope(): Envelope
    {
        $date = $this->report->date->format('d/m/Y');
        $name = $this->report->restaurant?->name ?? '';
        return new Envelope(
            subject: "דוח יומי TakeEat — {$name} — {$date}",
        );
    }

    public function content(): Content
    {
        return new Content(
            htmlString: $this->buildHtml(),
        );
    }

    private function buildHtml(): string
    {
        $r = $this->report;
        $date = $r->date->format('d/m/Y');
        $restaurantName = $r->restaurant?->name ?? '';
        $netRevenue = (float) ($r->net_revenue ?: $r->total_revenue);

        $body = '';

        // כותרת
        $body .= '<h1 style="margin: 0 0 8px; font-size: 22px; color: #1f2937; text-align: center;">דוח יומי</h1>';
        $body .= '<p style="margin: 0 0 4px; font-size: 15px; color: #6b7280; text-align: center;">' . e($restaurantName) . '</p>';
        $body .= '<p style="margin: 0 0 24px; font-size: 14px; color: #9ca3af; text-align: center;">' . $date . '</p>';

        // KPIs ראשיים
        $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 12px;">';
        $body .= '<tr>';
        $body .= EmailLayoutHelper::statCard(number_format($r->total_revenue, 0) . ' &#8362;', 'ברוטו', '#6b7280');
        $body .= '<td style="width: 8px;"></td>';
        $body .= EmailLayoutHelper::statCard(number_format($netRevenue, 0) . ' &#8362;', 'נטו אמיתי', '#22c55e');
        $body .= '</tr></table>';

        $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">';
        $body .= '<tr>';
        $body .= EmailLayoutHelper::statCard(number_format($r->total_orders), 'הזמנות', '#3b82f6');
        $body .= '<td style="width: 8px;"></td>';
        $body .= EmailLayoutHelper::statCard(number_format($r->avg_order_value, 0) . ' &#8362;', 'ממוצע להזמנה', '#f97316');
        $body .= '</tr></table>';

        // החזרים
        if (($r->refund_count ?? 0) > 0) {
            $json = $r->report_json ?? [];
            $cashRefund = (float) ($json['cash_refund_total'] ?? 0);
            $creditRefund = (float) ($json['credit_refund_total'] ?? 0);

            $body .= EmailLayoutHelper::sectionTitle('החזרים');
            $body .= EmailLayoutHelper::infoBox(
                EmailLayoutHelper::infoRow('מספר החזרים', (string) $r->refund_count)
                    . EmailLayoutHelper::infoRow('סכום החזרים', '-' . number_format($r->refund_total, 0) . ' &#8362;')
            );

            // סיכום בפועל לאחר החזרים
            if ($cashRefund > 0 || $creditRefund > 0) {
                $body .= EmailLayoutHelper::sectionTitle('סיכום בפועל (לאחר החזרים)');
                $rows = '';
                if ($cashRefund > 0) {
                    $grossCash = (float) $r->cash_total + $cashRefund;
                    $rows .= EmailLayoutHelper::infoRow('מזומן שנגבה', number_format($grossCash, 0) . ' &#8362;');
                    $rows .= EmailLayoutHelper::infoRow('החזרי מזומן', '-' . number_format($cashRefund, 0) . ' &#8362;');
                    $rows .= EmailLayoutHelper::infoRow('מזומן בפועל', number_format($r->cash_total, 0) . ' &#8362;');
                }
                if ($creditRefund > 0) {
                    $grossCredit = (float) $r->credit_total + $creditRefund;
                    $rows .= EmailLayoutHelper::infoRow('אשראי שנגבה', number_format($grossCredit, 0) . ' &#8362;');
                    $rows .= EmailLayoutHelper::infoRow('החזרי אשראי', '-' . number_format($creditRefund, 0) . ' &#8362;');
                    $rows .= EmailLayoutHelper::infoRow('אשראי בפועל', number_format($r->credit_total, 0) . ' &#8362;');
                }
                $body .= EmailLayoutHelper::infoBox($rows);
            }
        }

        // אמצעי תשלום
        $body .= EmailLayoutHelper::sectionTitle('אמצעי תשלום');
        $paymentRows = EmailLayoutHelper::infoRow('מזומן', number_format($r->cash_total, 0) . ' &#8362;');

        $hasDetailedCredit = (float) ($r->online_credit_total ?? 0) > 0
            || (float) ($r->pos_credit_total ?? 0) > 0
            || (float) ($r->kiosk_credit_total ?? 0) > 0;

        if ($hasDetailedCredit) {
            if ((float) ($r->online_credit_total ?? 0) > 0) {
                $paymentRows .= EmailLayoutHelper::infoRow('אשראי אתר (HYP)', number_format($r->online_credit_total, 0) . ' &#8362;');
            }
            if ((float) ($r->pos_credit_total ?? 0) > 0) {
                $paymentRows .= EmailLayoutHelper::infoRow('אשראי קופה (POS)', number_format($r->pos_credit_total, 0) . ' &#8362;');
            }
            if ((float) ($r->kiosk_credit_total ?? 0) > 0) {
                $paymentRows .= EmailLayoutHelper::infoRow('אשראי קיוסק', number_format($r->kiosk_credit_total, 0) . ' &#8362;');
            }
        } else {
            $paymentRows .= EmailLayoutHelper::infoRow('אשראי', number_format($r->credit_total, 0) . ' &#8362;');
        }
        $body .= EmailLayoutHelper::infoBox($paymentRows);

        // פילוח
        $body .= EmailLayoutHelper::sectionTitle('פילוח הזמנות');
        $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 16px;">';
        $body .= '<tr>';
        $body .= EmailLayoutHelper::statCard(number_format($r->pickup_orders), 'איסוף', '#3b82f6');
        $body .= '<td style="width: 6px;"></td>';
        $body .= EmailLayoutHelper::statCard(number_format($r->delivery_orders), 'משלוח', '#8b5cf6');
        $body .= '</tr></table>';

        // ביטולים
        if ($r->cancelled_orders > 0) {
            $body .= EmailLayoutHelper::sectionTitle('ביטולים');
            $body .= EmailLayoutHelper::infoBox(
                EmailLayoutHelper::infoRow('הזמנות שבוטלו', (string) $r->cancelled_orders)
                    . EmailLayoutHelper::infoRow('סכום ביטולים', number_format($r->cancelled_total, 0) . ' &#8362;')
            );
        }

        // פריטים מובילים
        $json = $r->report_json ?? [];
        $topItems = $json['top_items'] ?? [];
        if (!empty($topItems)) {
            $body .= EmailLayoutHelper::sectionTitle('פריטים מובילים');
            $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 16px;">';
            $body .= '<tr style="background: #f9fafb;">'
                . '<td style="padding: 8px 12px; font-size: 11px; font-weight: bold; color: #6b7280; border-bottom: 1px solid #e5e7eb;">פריט</td>'
                . '<td style="padding: 8px 12px; font-size: 11px; font-weight: bold; color: #6b7280; text-align: left; border-bottom: 1px solid #e5e7eb;">כמות</td>'
                . '<td style="padding: 8px 12px; font-size: 11px; font-weight: bold; color: #6b7280; text-align: left; border-bottom: 1px solid #e5e7eb;">הכנסה</td>'
                . '</tr>';

            foreach (array_slice($topItems, 0, 10) as $item) {
                $body .= '<tr>'
                    . '<td style="padding: 8px 12px; font-size: 13px; color: #1f2937; border-bottom: 1px solid #f3f4f6;">' . e($item['name'] ?? '') . '</td>'
                    . '<td style="padding: 8px 12px; font-size: 13px; color: #1f2937; text-align: left; border-bottom: 1px solid #f3f4f6;">' . number_format($item['quantity'] ?? 0) . '</td>'
                    . '<td style="padding: 8px 12px; font-size: 13px; color: #f97316; text-align: left; border-bottom: 1px solid #f3f4f6; font-weight: bold;">' . number_format($item['revenue'] ?? 0, 0) . ' &#8362;</td>'
                    . '</tr>';
            }
            $body .= '</table>';
        }

        // כפתור לדשבורד
        $dashboardUrl = EmailLayoutHelper::siteUrl('/admin/reports');
        $body .= EmailLayoutHelper::ctaButton('צפייה בדוחות', $dashboardUrl);

        return EmailLayoutHelper::wrap($body, "דוח יומי — {$restaurantName} — {$date}", 'info@chefsync.co.il');
    }
}
