<?php

namespace App\Mail;

use App\Models\Restaurant;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * מייל אחד עם PDF מאוחד — כל דוחות היום ברצף עמודים (ללא ZIP).
 */
class DailyReportsPeriodMergedPdfMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Restaurant $restaurant,
        public string $from,
        public string $to,
        public string $pdfPath,
    ) {}

    public function envelope(): Envelope
    {
        $name = $this->restaurant->name ?? '';

        return new Envelope(
            subject: "דוחות יומיים — {$name} — {$this->from} עד {$this->to}",
        );
    }

    public function content(): Content
    {
        $name = e($this->restaurant->name ?? '');
        $body = '<p style="font-family: Arial, sans-serif; font-size: 15px; color: #374151;">'
            ."מצורף קובץ PDF אחד הכולל את כל דוחות הימים לתקופה ({$name}), עמוד לכל יום."
            .'</p>'
            .'<p style="font-family: Arial, sans-serif; font-size: 13px; color: #6b7280;">'
            .'טווח: '.e($this->from).' — '.e($this->to)
            .'</p>';

        return new Content(htmlString: $body);
    }

    public function attachments(): array
    {
        $safe = preg_replace('/[^\p{L}\p{N}_\-]/u', '_', $this->restaurant->name ?? 'reports').'.pdf';

        return [
            Attachment::fromPath($this->pdfPath)
                ->as($safe)
                ->withMime('application/pdf'),
        ];
    }
}
