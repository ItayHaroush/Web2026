<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Models\Restaurant;

class AbandonedCartReportMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Restaurant $restaurant,
        public string $month,
        public int $reminders_sent,
        public int $saved_orders,
        public float $saved_revenue,
    ) {}

    public function envelope(): Envelope
    {
        $name = $this->restaurant->name ?? '';
        return new Envelope(
            subject: "דוח תזכורות סל נטוש — {$this->month} — {$name}",
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
        $r = $this->restaurant;
        $name = $r->name ?? '';

        $body = '';

        $body .= '<h1 style="margin: 0 0 8px; font-size: 22px; color: #1f2937; text-align: center;">כמה הזמנות הצלחנו להציל החודש</h1>';
        $body .= '<p style="margin: 0 0 4px; font-size: 15px; color: #6b7280; text-align: center;">' . e($name) . '</p>';
        $body .= '<p style="margin: 0 0 24px; font-size: 14px; color: #9ca3af; text-align: center;">' . e($this->month) . '</p>';

        $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">';
        $body .= '<tr>';
        $body .= EmailLayoutHelper::statCard(number_format($this->reminders_sent), 'תזכורות שנשלחו', '#3b82f6');
        $body .= '<td style="width: 8px;"></td>';
        $body .= EmailLayoutHelper::statCard(number_format($this->saved_orders), 'הזמנות שנצלו', '#22c55e');
        $body .= '<td style="width: 8px;"></td>';
        $body .= EmailLayoutHelper::statCard(number_format($this->saved_revenue, 0) . ' &#8362;', 'הכנסות מההזמנות שנצלו', '#f97316');
        $body .= '</tr></table>';

        $body .= EmailLayoutHelper::paragraph('הזמנות שנצלו = הלקוח חזר אחרי קבלת התזכורת והשלים את ההזמנה.');

        $dashboardUrl = EmailLayoutHelper::siteUrl('/admin');
        $body .= EmailLayoutHelper::ctaButton('לדשבורד ההזמנות', $dashboardUrl);

        return EmailLayoutHelper::wrap($body, "דוח תזכורות סל נטוש — {$name} — {$this->month}", 'info@chefsync.co.il');
    }
}
