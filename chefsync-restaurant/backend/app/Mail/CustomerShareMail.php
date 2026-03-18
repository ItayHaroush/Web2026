<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CustomerShareMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $senderName,
        public string $restaurantName,
        public string $restaurantUrl,
        public ?string $personalMessage = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "{$this->senderName} ממליץ/ה לך על {$this->restaurantName}",
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
        $sender = e($this->senderName);
        $restaurant = e($this->restaurantName);
        $url = $this->restaurantUrl;

        $body = '';

        $body .= EmailLayoutHelper::paragraph("היי,");
        $body .= EmailLayoutHelper::paragraph("<strong>{$sender}</strong> חושב/ת שתאהב/י את <strong>{$restaurant}</strong> ורוצה להמליץ לך!");

        if ($this->personalMessage) {
            $body .= EmailLayoutHelper::infoBox(
                '<p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.7; font-style: italic;">"' . e($this->personalMessage) . '"</p>'
                . '<p style="margin: 8px 0 0; font-size: 13px; color: #9ca3af;">— ' . $sender . '</p>'
            );
        }

        $body .= EmailLayoutHelper::paragraph("ב-TakeEat תוכל/י להזמין בקלות מהתפריט של <strong>{$restaurant}</strong> ולקבל את ההזמנה ישירות אליך.");

        $body .= EmailLayoutHelper::ctaButton('צפה בתפריט', $url);

        $body .= EmailLayoutHelper::paragraph('<span style="color: #9ca3af; font-size: 13px;">המייל נשלח דרך TakeEat בשם ' . $sender . '. אם אינך מעוניין/ת לקבל הודעות כאלה, ניתן להתעלם מהודעה זו.</span>');

        return EmailLayoutHelper::wrap($body, "{$sender} ממליץ/ה לך על {$restaurant} ב-TakeEat");
    }
}
