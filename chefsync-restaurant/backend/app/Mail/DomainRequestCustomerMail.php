<?php

namespace App\Mail;

use App\Models\DomainRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DomainRequestCustomerMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public DomainRequest $domainRequest,
        public string $event,
        public array $context = [],
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->subjectForEvent(),
        );
    }

    public function content(): Content
    {
        return new Content(
            htmlString: $this->buildHtml(),
        );
    }

    private function subjectForEvent(): string
    {
        $name = $this->domainRequest->restaurant->name ?? 'המסעדה';

        return match ($this->event) {
            'payment_received' => "התשלום התקבל — בקשת הדומיין של {$name}",
            'awaiting_dns' => "נדרשת הגדרת DNS לדומיין של {$name}",
            'domain_active' => "הדומיין של {$name} פעיל!",
            'request_rejected' => "עדכון לגבי בקשת הדומיין של {$name}",
            default => "קיבלנו את בקשת הדומיין של {$name}",
        };
    }

    private function buildHtml(): string
    {
        $r = $this->domainRequest;
        $r->loadMissing(['restaurant', 'requestedBy']);
        $restaurantName = e($r->restaurant->name ?? '');
        $num = e($r->request_number);
        $domain = e($r->domain_name ?: $r->active_domain ?: '—');
        $adminUrl = e(rtrim(config('app.frontend_url', ''), '/') . '/admin/custom-domain');
        $reason = e($this->context['rejection_reason'] ?? $r->rejection_reason ?? '');

        $body = match ($this->event) {
            'payment_received' => "<p>התשלום בסך <strong>₪" . number_format((float) $r->amount, 0) . "</strong> התקבל בהצלחה.</p>"
                . '<p>צוות TakeEat יטפל בחיבור הדומיין ויעדכן אותך בהמשך.</p>',
            'awaiting_dns' => '<p>כדי להשלים את החיבור, יש להגדיר את רשומות ה-DNS אצל ספק הדומיין שלך.</p>'
                . '<p>הוראות מפורטות מופיעות במסך "דומיין מותאם אישית" במערכת הניהול.</p>',
            'domain_active' => '<p>הדומיין מחובר ופעיל. הלקוחות שלך יכולים להזמין ישירות דרך:</p>'
                . "<p dir=\"ltr\"><strong>https://{$domain}</strong></p>",
            'request_rejected' => '<p>לצערנו לא ניתן להשלים את הבקשה.</p>'
                . ($reason ? "<p><strong>סיבה:</strong> {$reason}</p>" : '')
                . '<p>לשאלות נוספות — צרו קשר עם צוות TakeEat.</p>',
            default => $r->payment_status === DomainRequest::PAYMENT_INCLUDED
                ? '<p>הבקשה נרשמה כחלק מחבילת ההקמה — צוות TakeEat יטפל בחיבור הדומיין.</p>'
                : ($r->status === DomainRequest::STATUS_AWAITING_PAYMENT
                    ? '<p>לאחר השלמת התשלום נתחיל בטיפול בבקשה.</p>'
                    : '<p>צוות TakeEat יטפל בבקשה ויעדכן אותך בהמשך.</p>'),
        };

        $dnsBlock = '';
        if ($this->event === 'awaiting_dns' && !empty($this->context['dns_records'])) {
            $dnsBlock = '<p><strong>רשומות DNS:</strong></p><ul dir="ltr">';
            foreach ($this->context['dns_records'] as $rec) {
                if (!is_array($rec)) {
                    continue;
                }
                $type = e($rec['type'] ?? '');
                $name = e($rec['name'] ?? '');
                $value = e($rec['value'] ?? '');
                $dnsBlock .= "<li>{$type} {$name} → {$value}</li>";
            }
            $dnsBlock .= '</ul>';
        }

        return "<div dir=\"rtl\" style=\"font-family:Arial,sans-serif;line-height:1.6\">"
            . "<p>שלום,</p>"
            . "<p>בקשה <strong>{$num}</strong> · {$restaurantName}<br>דומיין: <span dir=\"ltr\">{$domain}</span></p>"
            . $body
            . $dnsBlock
            . "<p><a href=\"{$adminUrl}\">צפייה בסטטוס הבקשה</a></p>"
            . '<p style="color:#666;font-size:12px">TakeEat · ChefSync</p>'
            . '</div>';
    }
}
