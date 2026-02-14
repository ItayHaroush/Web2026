<?php

namespace App\Mail;

use App\Models\Restaurant;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TrialExpiringMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param Restaurant $restaurant
     * @param int $daysRemaining ימים שנותרו (1 או 3)
     * @param array $usageSummary סיכום שימוש
     */
    public function __construct(
        public Restaurant $restaurant,
        public int $daysRemaining = 3,
        public array $usageSummary = [],
    ) {}

    public function envelope(): Envelope
    {
        if ($this->daysRemaining <= 1) {
            return new Envelope(
                subject: '⚠️ תקופת הניסיון שלכם ב-TakeEat מסתיימת מחר!',
            );
        }

        return new Envelope(
            subject: "נותרו {$this->daysRemaining} ימים לתקופת הניסיון ב-TakeEat",
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
        $restaurantName = e($this->restaurant->name);
        $tier = $this->restaurant->tier === 'pro' ? 'Pro' : 'Basic';
        $trialEnds = $this->restaurant->trial_ends_at
            ? $this->restaurant->trial_ends_at->format('d/m/Y')
            : '';
        $ordersCount = $this->usageSummary['orders'] ?? 0;
        $menuItemsCount = $this->usageSummary['menu_items'] ?? 0;

        $pricing = [
            'basic' => ['monthly' => 450, 'yearly' => 4500],
            'pro' => ['monthly' => 600, 'yearly' => 5000],
        ];
        $monthlyPrice = $pricing[$this->restaurant->tier ?? 'basic']['monthly'];
        $yearlyPrice = $pricing[$this->restaurant->tier ?? 'basic']['yearly'];

        $body = '';

        // ברכה
        $body .= EmailLayoutHelper::paragraph("שלום,");

        if ($this->daysRemaining <= 1) {
            $body .= EmailLayoutHelper::warningBox(
                '<p style="margin: 0; font-size: 16px; color: #92400e; text-align: center; font-weight: bold;">'
                . 'תקופת הניסיון שלכם מסתיימת מחר!'
                . '</p>'
                . '<p style="margin: 8px 0 0; font-size: 13px; color: #92400e; text-align: center;">'
                . "המסעדה \"{$restaurantName}\" — עד {$trialEnds}"
                . '</p>'
            );
        } else {
            $body .= EmailLayoutHelper::paragraph(
                "נותרו <strong>{$this->daysRemaining} ימים</strong> לתקופת הניסיון במסעדה <strong>\"{$restaurantName}\"</strong>."
            );
        }

        // מה יקרה?
        $body .= EmailLayoutHelper::sectionTitle('מה קורה כשהניסיון מסתיים?');
        $body .= EmailLayoutHelper::paragraph('לאחר תום תקופת הניסיון:');
        $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 8px 0 16px;">';
        $warnings = [
            'הפאנל יהיה נגיש אבל ללא אפשרות לקבל הזמנות חדשות',
            'התפריט הדיגיטלי יוסתר מהלקוחות',
            'כל הנתונים נשמרים ויהיו זמינים מיד עם חידוש המנוי',
        ];
        foreach ($warnings as $w) {
            $body .= '<tr><td style="padding: 4px 0; font-size: 14px; color: #4b5563; line-height: 1.6;">'
                . '<span style="color: #ef4444; margin-left: 8px;">&#9888;</span> ' . $w
                . '</td></tr>';
        }
        $body .= '</table>';

        // סיכום שימוש
        if ($ordersCount > 0 || $menuItemsCount > 0) {
            $body .= EmailLayoutHelper::sectionTitle('הישגים בתקופת הניסיון');
            $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>';
            $body .= EmailLayoutHelper::statCard((string) $ordersCount, 'הזמנות שקיבלתם', '#22c55e');
            $body .= '<td style="width: 12px;"></td>';
            $body .= EmailLayoutHelper::statCard((string) $menuItemsCount, 'פריטי תפריט', '#3b82f6');
            $body .= '</tr></table>';
        }

        // מחירים
        $body .= EmailLayoutHelper::sectionTitle('תוכניות מנוי');
        $body .= EmailLayoutHelper::infoBox(
            '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">'
            . '<tr>'
            . '<td style="text-align: center; padding: 12px; border-left: 1px solid #fed7aa;">'
            . '<p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af;">חודשי</p>'
            . "<p style=\"margin: 0; font-size: 24px; font-weight: bold; color: #f97316;\">{$monthlyPrice} &#8362;</p>"
            . '<p style="margin: 4px 0 0; font-size: 11px; color: #6b7280;">לחודש</p>'
            . '</td>'
            . '<td style="text-align: center; padding: 12px;">'
            . '<p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af;">שנתי</p>'
            . "<p style=\"margin: 0; font-size: 24px; font-weight: bold; color: #22c55e;\">{$yearlyPrice} &#8362;</p>"
            . '<p style="margin: 4px 0 0; font-size: 11px; color: #6b7280;">לשנה (חסכון!)</p>'
            . '</td>'
            . '</tr>'
            . '</table>',
            '#f97316',
            '#fff7ed'
        );

        // כפתור
        $loginUrl = config('app.frontend_url', 'https://app.takeeat.co.il') . '/admin/login';
        $body .= EmailLayoutHelper::ctaButton('הפעלת מנוי', $loginUrl, '#22c55e');

        $body .= EmailLayoutHelper::paragraph(
            '<span style="font-size: 12px; color: #9ca3af;">יש שאלות? אנחנו כאן לעזור. פשוט השיבו למייל הזה.</span>'
        );

        $preheader = $this->daysRemaining <= 1
            ? "תקופת הניסיון שלכם מסתיימת מחר! {$restaurantName}"
            : "נותרו {$this->daysRemaining} ימים לניסיון — {$restaurantName}";

        return EmailLayoutHelper::wrap($body, $preheader);
    }
}
