<?php

namespace App\Mail;

use App\Models\Restaurant;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RestaurantApprovedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Restaurant $restaurant,
        public string $ownerName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'המסעדה שלכם אושרה ב-TakeEat! ✅',
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
        $name = e($this->ownerName);
        $restaurantName = e($this->restaurant->name);
        $loginUrl = EmailLayoutHelper::siteUrl('/admin/login');
        $menuUrl = EmailLayoutHelper::siteUrl('/' . e($this->restaurant->tenant_id) . '/menu');

        $body = '';

        // ברכה
        $body .= EmailLayoutHelper::paragraph("שלום <strong>{$name}</strong>,");

        // הודעת אישור
        $body .= EmailLayoutHelper::successBox(
            '<div style="text-align: center;">'
                . '<p style="margin: 0; font-size: 20px; color: #166534; font-weight: bold;">המסעדה אושרה!</p>'
                . '<p style="margin: 8px 0 0; font-size: 14px; color: #166534;">'
                . "המסעדה <strong>\"{$restaurantName}\"</strong> אושרה בהצלחה על ידי צוות TakeEat."
                . '</p>'
                . '</div>'
        );

        // הנחיות
        $body .= EmailLayoutHelper::sectionTitle('מה עכשיו?');
        $body .= EmailLayoutHelper::paragraph('המסעדה מוכנה לפעולה! הנה מה שצריך לעשות:');

        $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 12px 0;">';

        $steps = [
            ['num' => '1', 'title' => 'היכנסו לפאנל הניהול', 'desc' => 'השתמשו באימייל והסיסמה שהגדרתם בהרשמה'],
            ['num' => '2', 'title' => 'וודאו שהתפריט מוכן', 'desc' => 'בדקו שכל הפריטים, המחירים והתמונות מעודכנים'],
            ['num' => '3', 'title' => 'פתחו את המסעדה', 'desc' => 'לחצו על "פתח מסעדה" בדשבורד כדי להתחיל לקבל הזמנות'],
        ];

        foreach ($steps as $step) {
            $body .= '<tr><td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">'
                . '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>'
                . '<td style="width: 36px; vertical-align: top;">'
                . '<div style="width: 32px; height: 32px; background: #f97316; color: white; border-radius: 50%; text-align: center; line-height: 32px; font-weight: bold; font-size: 14px;">' . $step['num'] . '</div>'
                . '</td>'
                . '<td style="padding-right: 12px; vertical-align: top;">'
                . '<p style="margin: 0; font-size: 14px; font-weight: bold; color: #1f2937;">' . $step['title'] . '</p>'
                . '<p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">' . $step['desc'] . '</p>'
                . '</td>'
                . '</tr></table>'
                . '</td></tr>';
        }

        $body .= '</table>';

        // כפתורים
        $body .= EmailLayoutHelper::ctaButton('כניסה לפאנל הניהול', $loginUrl);

        $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto 16px;">'
            . '<tr><td style="text-align: center;">'
            . '<a href="' . $menuUrl . '" target="_blank" style="font-size: 13px; color: #f97316; text-decoration: underline;">צפייה בתפריט הדיגיטלי &larr;</a>'
            . '</td></tr></table>';

        $body .= EmailLayoutHelper::paragraph(
            '<span style="font-size: 12px; color: #9ca3af;">לכל שאלה או עזרה, צוות TakeEat כאן בשבילכם.</span>'
        );

        return EmailLayoutHelper::wrap($body, "המסעדה \"{$restaurantName}\" אושרה ב-TakeEat!");
    }
}
