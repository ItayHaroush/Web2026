<?php

namespace App\Mail;

use App\Models\Customer;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CustomerEmailVerificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Customer $customer,
        public string $token,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'אימות כתובת אימייל',
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
        $verifyUrl = EmailLayoutHelper::siteUrl('/verify-email?token=' . $this->token);

        $body = '';

        $body .= EmailLayoutHelper::paragraph("שלום <strong>{$name}</strong>,");
        $body .= EmailLayoutHelper::paragraph('קיבלנו בקשה לאמת את כתובת האימייל שלך במערכת TakeEat. לחץ/י על הכפתור למטה כדי לאשר את הכתובת.');

        $body .= EmailLayoutHelper::ctaButton('אימות כתובת אימייל', $verifyUrl);

        $body .= EmailLayoutHelper::paragraph('<span style="color: #9ca3af; font-size: 13px;">אם לא ביקשת לאמת את האימייל הזה, ניתן להתעלם מהודעה זו.</span>');

        return EmailLayoutHelper::wrap($body, 'אמת/י את כתובת האימייל שלך ב-TakeEat');
    }
}
