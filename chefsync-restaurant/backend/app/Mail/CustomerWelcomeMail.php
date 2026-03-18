<?php

namespace App\Mail;

use App\Models\Customer;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CustomerWelcomeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Customer $customer,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'ברוכים הבאים ל-TakeEat!',
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
        $name = e($this->customer->name ?: 'לקוח/ה יקר/ה');
        $homeUrl = EmailLayoutHelper::siteUrl('/');

        $body = '';

        $body .= EmailLayoutHelper::paragraph("שלום <strong>{$name}</strong>,");
        $body .= EmailLayoutHelper::paragraph('האימייל שלך אומת בהצלחה! ברוכים הבאים למשפחת TakeEat — פלטפורמת ההזמנות החכמה.');

        $body .= EmailLayoutHelper::sectionTitle('מה מחכה לך?');
        $body .= EmailLayoutHelper::featureList([
            'היסטוריית הזמנות — עקוב אחרי כל ההזמנות שלך במקום אחד',
            'כתובות שמורות — שמור כתובות למשלוח מהיר',
            'הזמנה חוזרת — הזמן שוב בלחיצה אחת',
            'מועדפים — שמור את המנות האהובות עליך',
            'קבלות במייל — קבל סיכום הזמנה אוטומטי',
        ]);

        $body .= EmailLayoutHelper::ctaButton('התחל להזמין', $homeUrl);

        $body .= EmailLayoutHelper::paragraph('<span style="color: #9ca3af; font-size: 13px;">תודה שבחרת ב-TakeEat! אנחנו כאן בשבילך.</span>');

        return EmailLayoutHelper::wrap($body, 'ברוכים הבאים ל-TakeEat! האימייל שלך אומת בהצלחה.');
    }
}
