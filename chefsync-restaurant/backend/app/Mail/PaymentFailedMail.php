<?php

namespace App\Mail;

use App\Models\Restaurant;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PaymentFailedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Restaurant $restaurant,
        public string $reason,
        public int $daysLeft,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'שגיאה בחיוב החודשי - TakeEat',
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
        $paywallUrl = EmailLayoutHelper::siteUrl('/admin/paywall');

        $body = '';
        $body .= EmailLayoutHelper::paragraph("שלום,");
        $body .= EmailLayoutHelper::paragraph(
            "החיוב החודשי עבור <strong>{$restaurantName}</strong> נכשל."
        );

        $warningContent = '<div style="text-align: center;">'
            . '<p style="font-size: 15px; font-weight: bold; color: #92400e; margin: 0 0 8px;">החיוב לא בוצע</p>'
            . '<p style="font-size: 13px; color: #92400e; margin: 0 0 4px;">סיבה: ' . e($this->reason) . '</p>';

        if ($this->daysLeft > 0) {
            $warningContent .= "<p style=\"font-size: 13px; color: #92400e; margin: 0;\">נותרו <strong>{$this->daysLeft} ימים</strong> עד להשעיית הפאנל.</p>";
        } else {
            $warningContent .= '<p style="font-size: 13px; color: #dc2626; font-weight: bold; margin: 0;">הפאנל עלול להיחסם בכל רגע.</p>';
        }

        $warningContent .= '</div>';

        $body .= EmailLayoutHelper::warningBox($warningContent);

        $body .= EmailLayoutHelper::paragraph(
            'יש לעדכן את אמצעי התשלום כדי למנוע השעיה. התפריט הדיגיטלי ימשיך לפעול, אך פאנל הניהול ייחסם.'
        );

        $body .= EmailLayoutHelper::ctaButton('עדכן אמצעי תשלום', $paywallUrl);

        $body .= EmailLayoutHelper::paragraph(
            '<span style="font-size: 13px; color: #6b7280;">לעזרה: '
                . '<a href="mailto:billing@chefsync.co.il" style="color: #f97316;">billing@chefsync.co.il</a></span>'
        );

        return EmailLayoutHelper::wrap($body, 'שגיאה בחיוב החודשי', 'billing@chefsync.co.il');
    }
}
