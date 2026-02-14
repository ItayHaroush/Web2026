<?php

namespace App\Mail;

use App\Models\Restaurant;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SubscriptionSuspendedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Restaurant $restaurant,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'המנוי הושהה - TakeEat',
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
            "המנוי של <strong>{$restaurantName}</strong> הושהה עקב כשלון חיוב חוזר."
        );

        $warningContent = '<div style="text-align: center;">'
            . '<p style="font-size: 15px; font-weight: bold; color: #92400e; margin: 0 0 8px;">המנוי הושהה</p>'
            . '<p style="font-size: 13px; color: #92400e; margin: 0;">פאנל הניהול חסום עד לחידוש התשלום.</p>'
            . '</div>';

        $body .= EmailLayoutHelper::warningBox($warningContent);

        $body .= EmailLayoutHelper::paragraph(
            '<strong>מה קורה עכשיו?</strong>'
        );

        $body .= EmailLayoutHelper::featureList([
            'התפריט הדיגיטלי ממשיך לפעול כרגיל',
            'לקוחות יכולים להמשיך להזמין',
            'פאנל הניהול חסום (הזמנות, תפריט, הגדרות)',
            'כל הנתונים שלכם שמורים במלואם',
        ]);

        $body .= EmailLayoutHelper::paragraph(
            'כדי לחדש את המנוי ולשחרר את הפאנל, יש לעדכן את אמצעי התשלום:'
        );

        $body .= EmailLayoutHelper::ctaButton('חדש את המנוי', $paywallUrl);

        $body .= EmailLayoutHelper::paragraph(
            '<span style="font-size: 13px; color: #6b7280;">לעזרה: '
                . '<a href="mailto:billing@chefsync.co.il" style="color: #f97316;">billing@chefsync.co.il</a></span>'
        );

        return EmailLayoutHelper::wrap($body, 'המנוי הושהה', 'billing@chefsync.co.il');
    }
}
