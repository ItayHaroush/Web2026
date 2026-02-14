<?php

namespace App\Mail;

use App\Models\MonthlyInvoice;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InvoiceMail extends Mailable
{
    use Queueable, SerializesModels;

    private const HEBREW_MONTHS = [
        '01' => 'ינואר',
        '02' => 'פברואר',
        '03' => 'מרץ',
        '04' => 'אפריל',
        '05' => 'מאי',
        '06' => 'יוני',
        '07' => 'יולי',
        '08' => 'אוגוסט',
        '09' => 'ספטמבר',
        '10' => 'אוקטובר',
        '11' => 'נובמבר',
        '12' => 'דצמבר',
    ];

    public function __construct(
        public MonthlyInvoice $invoice,
        public string $pdfContent,
    ) {}

    public function envelope(): Envelope
    {
        $monthParts = explode('-', $this->invoice->month);
        $monthHebrew = (self::HEBREW_MONTHS[$monthParts[1] ?? ''] ?? '') . ' ' . ($monthParts[0] ?? '');

        return new Envelope(
            subject: "חשבונית TakeEat — {$monthHebrew}",
        );
    }

    public function content(): Content
    {
        return new Content(
            htmlString: $this->buildHtml(),
        );
    }

    public function attachments(): array
    {
        $filename = sprintf('TakeEat-Invoice-%s.pdf', $this->invoice->month);

        return [
            Attachment::fromData(fn() => $this->pdfContent, $filename)
                ->withMime('application/pdf'),
        ];
    }

    private function buildHtml(): string
    {
        $this->invoice->loadMissing('restaurant');
        $restaurantName = $this->invoice->restaurant->name ?? 'המסעדה';
        $monthParts = explode('-', $this->invoice->month);
        $monthHebrew = (self::HEBREW_MONTHS[$monthParts[1] ?? ''] ?? '') . ' ' . ($monthParts[0] ?? '');
        $totalDue = number_format($this->invoice->total_due, 2);

        $body = '';

        // ברכה
        $body .= EmailLayoutHelper::paragraph('שלום,');
        $body .= EmailLayoutHelper::paragraph(
            "מצורפת חשבונית עבור <strong>{$restaurantName}</strong> לחודש <strong>{$monthHebrew}</strong>."
        );

        // סכום
        $body .= EmailLayoutHelper::infoBox(
            '<div style="text-align: center;">'
                . '<p style="font-size: 13px; color: #9a3412; margin: 0 0 5px;">סכום לתשלום</p>'
                . "<p style=\"font-size: 28px; font-weight: bold; color: #f97316; margin: 0;\">{$totalDue} &#8362;</p>"
                . '</div>'
        );

        $body .= EmailLayoutHelper::paragraph(
            '<span style="font-size: 13px; color: #6b7280;">החשבונית המלאה מצורפת כקובץ PDF.<br>'
                . 'לשאלות ובירורים: <a href="mailto:billing@chefsync.co.il" style="color: #f97316;">billing@chefsync.co.il</a></span>'
        );

        return EmailLayoutHelper::wrap($body, "חשבונית TakeEat — {$monthHebrew}", 'billing@chefsync.co.il');
    }
}
