<?php

namespace App\Mail;

use App\Models\Restaurant;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TrialInfoMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param Restaurant $restaurant
     * @param int $dayNumber יום מספר X בניסיון (3 או 7)
     * @param array $stats סטטיסטיקות שימוש
     */
    public function __construct(
        public Restaurant $restaurant,
        public int $dayNumber = 3,
        public array $stats = [],
    ) {}

    public function envelope(): Envelope
    {
        $day = $this->dayNumber;
        return new Envelope(
            subject: "יום {$day} ב-TakeEat — טיפים לשימוש מיטבי",
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
        $categoriesCount = $this->stats['categories'] ?? 0;
        $menuItemsCount = $this->stats['menu_items'] ?? 0;
        $ordersCount = $this->stats['orders'] ?? 0;
        $daysLeft = $this->restaurant->trial_ends_at
            ? max(0, (int) now()->diffInDays($this->restaurant->trial_ends_at, false))
            : 0;

        $body = '';

        // ברכה
        $body .= EmailLayoutHelper::paragraph("שלום,");

        if ($this->dayNumber <= 3) {
            $body .= EmailLayoutHelper::paragraph("עברו 3 ימים מאז שהצטרפתם ל-TakeEat עם <strong>\"{$restaurantName}\"</strong>. רצינו לוודא שהכל מתנהל חלק ולשתף כמה טיפים שיעזרו לכם להתחיל.");
        } else {
            $body .= EmailLayoutHelper::paragraph("שבוע שלם ב-TakeEat! הנה סיכום קצר של מה שכבר עשיתם עם <strong>\"{$restaurantName}\"</strong> וכמה רעיונות להמשך.");
        }

        // סטטיסטיקות
        $body .= EmailLayoutHelper::sectionTitle('המצב שלכם עד כה');
        $body .= '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>';
        $body .= EmailLayoutHelper::statCard((string) $categoriesCount, 'קטגוריות', '#3b82f6');
        $body .= '<td style="width: 8px;"></td>';
        $body .= EmailLayoutHelper::statCard((string) $menuItemsCount, 'פריטי תפריט', '#f97316');
        $body .= '<td style="width: 8px;"></td>';
        $body .= EmailLayoutHelper::statCard((string) $ordersCount, 'הזמנות', '#22c55e');
        $body .= '<td style="width: 8px;"></td>';
        $body .= EmailLayoutHelper::statCard("{$daysLeft}", 'ימים נותרו', '#ef4444');
        $body .= '</tr></table>';

        // טיפים
        $body .= EmailLayoutHelper::sectionTitle('טיפים לשימוש מיטבי');

        if ($this->dayNumber <= 3) {
            $tips = [
                '<strong>הוסיפו תמונות לפריטים</strong> — פריטים עם תמונות מקבלים 3 פי יותר הזמנות',
                '<strong>הגדירו שעות פעילות</strong> — כדי שלקוחות ידעו מתי אפשר להזמין',
                '<strong>הפעילו אזור משלוח</strong> — והגדירו טווח ועלות',
                '<strong>שתפו את הלינק</strong> — העבירו ללקוחות את כתובת התפריט הדיגיטלי',
            ];
        } else {
            $tips = [
                '<strong>הפעילו מבצעים</strong> — תמריצו לקוחות עם "קנה X קבל Y"',
                '<strong>חברו מדפסת מטבח</strong> — הזמנות יודפסו אוטומטית',
                '<strong>בדקו את הדוחות</strong> — עקבו אחרי הביצועים בדשבורד',
                '<strong>הגדירו מסך תצוגה</strong> — להצגת הזמנות פעילות במטבח',
            ];
            if ($categoriesCount === 0) {
                array_unshift($tips, '<strong style="color: #ef4444;">הוסיפו קטגוריות ופריטים!</strong> — התפריט שלכם עדיין ריק');
            }
        }

        $body .= EmailLayoutHelper::featureList($tips);

        // כפתור
        $loginUrl = config('app.frontend_url', 'https://app.takeeat.co.il') . '/admin/login';
        $body .= EmailLayoutHelper::ctaButton('כניסה לפאנל הניהול', $loginUrl);

        // תזכורת ימי ניסיון
        if ($daysLeft <= 7) {
            $body .= EmailLayoutHelper::warningBox(
                '<p style="margin: 0; font-size: 14px; color: #92400e; text-align: center;">'
                . "<strong>נותרו לכם {$daysLeft} ימי ניסיון</strong><br>"
                . '<span style="font-size: 12px;">לאחר תקופת הניסיון, יש להפעיל מנוי כדי להמשיך.</span>'
                . '</p>'
            );
        }

        return EmailLayoutHelper::wrap($body, "יום {$this->dayNumber} ב-TakeEat — טיפים לשימוש מיטבי");
    }
}
