<?php

namespace App\Mail;

use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ChurnRequestMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Restaurant $restaurant,
        public User $requestedBy,
        public string $reasonLabel,
        public ?string $note,
        public ?string $effectiveDate,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "בקשת סיום התקשרות — {$this->restaurant->name}",
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
        $name = e($this->restaurant->name);
        $owner = e($this->requestedBy->name ?? 'בעלים');
        $email = e($this->requestedBy->email ?? '—');
        $reason = e($this->reasonLabel);
        $note = $this->note ? e($this->note) : '—';
        $date = $this->effectiveDate
            ? e(\Carbon\Carbon::parse($this->effectiveDate)->format('d/m/Y'))
            : 'לא צוין';
        $dashboardUrl = EmailLayoutHelper::siteUrl('/super-admin/dashboard');

        $body = '';
        $body .= EmailLayoutHelper::paragraph('שלום,');
        $body .= EmailLayoutHelper::paragraph("התקבלה <strong>בקשה לסיום התקשרות</strong> ממסעדה <strong>{$name}</strong>.");
        $body .= EmailLayoutHelper::infoBox(
            '<p style="margin:0 0 6px;"><strong>מבקש:</strong> ' . $owner . ' (' . $email . ')</p>'
            . '<p style="margin:0 0 6px;"><strong>סיבה:</strong> ' . $reason . '</p>'
            . '<p style="margin:0 0 6px;"><strong>תאריך מבוקש לסיום:</strong> ' . $date . '</p>'
            . '<p style="margin:0;"><strong>הערה:</strong> ' . $note . '</p>'
        );
        $body .= EmailLayoutHelper::ctaButton('צפייה בבקשות סיום', $dashboardUrl);

        return EmailLayoutHelper::wrap($body, "בקשת סיום מ{$name}");
    }
}
