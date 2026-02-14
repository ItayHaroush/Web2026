<?php

namespace App\Mail;

use App\Models\Restaurant;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PaymentSuccessMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Restaurant $restaurant,
        public float $amount,
        public string $cardLast4,
        public Carbon $nextChargeAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'התשלום התקבל בהצלחה - TakeEat',
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
        $restaurantName = $this->restaurant->name ?? 'המסעדה';
        $formattedAmount = number_format($this->amount, 2);
        $nextDate = $this->nextChargeAt->format('d/m/Y');
        $tier = $this->restaurant->tier === 'pro' ? 'Pro' : 'Basic';
        $plan = $this->restaurant->subscription_plan === 'yearly' ? 'שנתי' : 'חודשי';
        $dashboardUrl = EmailLayoutHelper::siteUrl('/admin/dashboard');

        $body = '';
        $body .= EmailLayoutHelper::paragraph("שלום,");
        $body .= EmailLayoutHelper::paragraph(
            "התשלום עבור <strong>{$restaurantName}</strong> התקבל בהצלחה."
        );

        $body .= EmailLayoutHelper::successBox(
            '<div style="text-align: center;">'
                . '<p style="font-size: 13px; color: #166534; margin: 0 0 5px;">סכום ששולם</p>'
                . "<p style=\"font-size: 28px; font-weight: bold; color: #22c55e; margin: 0;\">{$formattedAmount} &#8362;</p>"
                . '</div>'
        );

        $body .= EmailLayoutHelper::infoRow('חבילה', "{$tier} — {$plan}");
        $body .= EmailLayoutHelper::infoRow('כרטיס', "•••• {$this->cardLast4}");
        $body .= EmailLayoutHelper::infoRow('חיוב הבא', $nextDate);

        $body .= EmailLayoutHelper::ctaButton('כניסה לפאנל', $dashboardUrl);

        $body .= EmailLayoutHelper::paragraph(
            '<span style="font-size: 13px; color: #6b7280;">לשאלות ובירורים: '
                . '<a href="mailto:billing@chefsync.co.il" style="color: #f97316;">billing@chefsync.co.il</a></span>'
        );

        return EmailLayoutHelper::wrap($body, 'התשלום התקבל בהצלחה', 'billing@chefsync.co.il');
    }
}
