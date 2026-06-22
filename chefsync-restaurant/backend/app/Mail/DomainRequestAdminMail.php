<?php

namespace App\Mail;

use App\Models\DomainRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DomainRequestAdminMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public DomainRequest $domainRequest,
        public string $event = 'created',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "בקשת דומיין חדשה — {$this->domainRequest->request_number}",
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
        $r = $this->domainRequest;
        $name = e($r->restaurant->name ?? '');
        $domain = e($r->domain_name ?? '—');
        $num = e($r->request_number);

        return "<p>בקשת דומיין חדשה: <strong>{$num}</strong></p>"
            . "<p>מסעדה: {$name}<br>דומיין: {$domain}<br>אירוע: {$this->event}</p>"
            . '<p><a href="' . e(config('app.frontend_url', '')) . '/super-admin/domain-requests">פתח במרכז בקשות דומיין</a></p>';
    }
}
