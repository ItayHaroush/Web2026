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
        '01' => 'ינואר', '02' => 'פברואר', '03' => 'מרץ',
        '04' => 'אפריל', '05' => 'מאי', '06' => 'יוני',
        '07' => 'יולי', '08' => 'אוגוסט', '09' => 'ספטמבר',
        '10' => 'אוקטובר', '11' => 'נובמבר', '12' => 'דצמבר',
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
            Attachment::fromData(fn () => $this->pdfContent, $filename)
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

        return <<<HTML
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f97316; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">TakeEat</h1>
                <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">חשבונית חודשית</p>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; color: #1f2937;">שלום,</p>
                <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
                    מצורפת חשבונית עבור <strong>{$restaurantName}</strong> לחודש <strong>{$monthHebrew}</strong>.
                </p>
                <div style="background: #fff7ed; border: 2px solid #f97316; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
                    <p style="font-size: 13px; color: #9a3412; margin: 0 0 5px;">סכום לתשלום</p>
                    <p style="font-size: 28px; font-weight: bold; color: #f97316; margin: 0;">{$totalDue} ₪</p>
                </div>
                <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">
                    החשבונית המלאה מצורפת כקובץ PDF.<br>
                    לשאלות ובירורים ניתן לפנות אלינו.
                </p>
            </div>
            <div style="text-align: center; padding: 15px; color: #9ca3af; font-size: 11px;">
                <p>TakeEat Platform — חשבונית זו הופקה אוטומטית</p>
            </div>
        </div>
        HTML;
    }
}
