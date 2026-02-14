<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CustomMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param string $emailSubject כותרת המייל
     * @param string $emailBody תוכן ההודעה (HTML allowed)
     * @param string|null $recipientName שם הנמען (אופציונלי)
     */
    public function __construct(
        public string $emailSubject,
        public string $emailBody,
        public ?string $recipientName = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->emailSubject,
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
        $body = '';

        // ברכה
        if ($this->recipientName) {
            $body .= EmailLayoutHelper::paragraph('שלום <strong>' . e($this->recipientName) . '</strong>,');
        } else {
            $body .= EmailLayoutHelper::paragraph('שלום,');
        }

        // תוכן ההודעה - מאפשר HTML בסיסי
        $body .= '<div style="font-size: 14px; color: #4b5563; line-height: 1.7; margin-bottom: 20px;">'
            . nl2br(e($this->emailBody))
            . '</div>';

        // חתימה
        $body .= '<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">'
            . '<p style="margin: 0; font-size: 13px; color: #6b7280;">בברכה,</p>'
            . '<p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #f97316;">צוות TakeEat</p>'
            . '</div>';

        return EmailLayoutHelper::wrap($body, $this->emailSubject, 'info@chefsync.co.il');
    }
}
