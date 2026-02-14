<?php

namespace App\Mail;

use App\Models\Restaurant;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WelcomeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Restaurant $restaurant,
        public string $ownerName,
        public string $ownerEmail,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'ברוכים הבאים ל-TakeEat! 🎉',
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
        $tenantId = e($this->restaurant->tenant_id);
        $tier = $this->restaurant->tier === 'pro' ? 'Pro' : 'Basic';
        $trialEnds = $this->restaurant->trial_ends_at
            ? $this->restaurant->trial_ends_at->format('d/m/Y')
            : 'לא הוגדר';
        $daysLeft = $this->restaurant->trial_ends_at
            ? max(0, now()->diffInDays($this->restaurant->trial_ends_at, false))
            : 14;

        $loginUrl = EmailLayoutHelper::siteUrl('/admin/login');

        $body = '';

        // ברכה
        $body .= EmailLayoutHelper::paragraph("שלום <strong>{$name}</strong>,");
        $body .= EmailLayoutHelper::paragraph("שמחים שהצטרפת ל-TakeEat! המסעדה <strong>\"{$restaurantName}\"</strong> נרשמה בהצלחה במערכת.");

        // פרטי חשבון
        $body .= EmailLayoutHelper::infoBox(
            EmailLayoutHelper::infoRow('שם מסעדה', $restaurantName)
                . EmailLayoutHelper::infoRow('מזהה (Tenant)', $tenantId)
                . EmailLayoutHelper::infoRow('סוג מנוי', $tier)
                . EmailLayoutHelper::infoRow('תקופת ניסיון', "{$daysLeft} ימים (עד {$trialEnds})")
                . EmailLayoutHelper::infoRow('אימייל', e($this->ownerEmail))
        );

        // מה עכשיו?
        $body .= EmailLayoutHelper::sectionTitle('מה הצעד הבא?');
        $body .= EmailLayoutHelper::featureList([
            'היכנס לפאנל הניהול והגדר את התפריט שלך',
            'הוסף קטגוריות ופריטי מזון עם תמונות',
            'הגדר אזורי משלוח ותשלום',
            'שתף את הלינק ללקוחות שלך',
            'עקוב אחרי הזמנות בזמן אמת',
        ]);

        // כפתור
        $body .= EmailLayoutHelper::ctaButton('כניסה לפאנל הניהול', $loginUrl);

        // הערה
        $body .= EmailLayoutHelper::paragraph('<span style="color: #9ca3af; font-size: 13px;">שים לב: המסעדה ממתינה לאישור צוות TakeEat. תקבל הודעה ברגע שהמסעדה תאושר.</span>');

        return EmailLayoutHelper::wrap($body, "ברוכים הבאים ל-TakeEat! המסעדה {$restaurantName} נרשמה בהצלחה.");
    }
}
