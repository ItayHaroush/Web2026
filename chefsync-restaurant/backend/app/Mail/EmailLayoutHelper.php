<?php

namespace App\Mail;

/**
 * EmailLayoutHelper - Layout משותף לכל תבניות המייל של TakeEat
 *
 * מספק header, footer, ו-wrapper עם עיצוב אחיד:
 * - RTL (עברית)
 * - Responsive (מובייל + דסקטופ)
 * - צבע מותג: כתום #f97316
 * - Font: Arial, sans-serif
 */
class EmailLayoutHelper
{
    /**
     * עוטף תוכן HTML ב-layout מלא של TakeEat
     */
    public static function wrap(string $bodyContent, string $preheader = ''): string
    {
        $header = self::header();
        $footer = self::footer();
        $preheaderHtml = $preheader
            ? '<div style="display:none;font-size:1px;color:#f9fafb;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">' . e($preheader) . '</div>'
            : '';

        return <<<HTML
<!DOCTYPE html>
<html dir="rtl" lang="he" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>TakeEat</title>
    <!--[if mso]>
    <style type="text/css">
        table { border-collapse: collapse; }
        td { font-family: Arial, sans-serif; }
    </style>
    <![endif]-->
    <style type="text/css">
        @media only screen and (max-width: 620px) {
            .email-container { width: 100% !important; max-width: 100% !important; }
            .fluid { max-width: 100% !important; height: auto !important; }
            .stack-column { display: block !important; width: 100% !important; }
            .stack-column-center { text-align: center !important; }
            .center-on-narrow { text-align: center !important; display: block !important; margin-left: auto !important; margin-right: auto !important; float: none !important; }
            table.center-on-narrow { display: inline-block !important; }
            .padding-mobile { padding-left: 16px !important; padding-right: 16px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; font-family: Arial, Helvetica, sans-serif; direction: rtl;">
    {$preheaderHtml}

    <!-- Email wrapper table -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
        <tr>
            <td style="padding: 20px 10px;">
                <!-- Main content container -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center" class="email-container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    {$header}

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 30px 32px;" class="padding-mobile">
                            {$bodyContent}
                        </td>
                    </tr>

                    {$footer}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
HTML;
    }

    /**
     * Header של TakeEat - רקע כתום + לוגו
     */
    private static function header(): string
    {
        return <<<HTML
        <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 28px 32px; text-align: center;">
                <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff; letter-spacing: 1px;">TakeEat</h1>
                <p style="margin: 6px 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">פלטפורמת ההזמנות החכמה למסעדות</p>
            </td>
        </tr>
HTML;
    }

    /**
     * Footer קבוע
     */
    private static function footer(): string
    {
        $year = date('Y');

        return <<<HTML
        <tr>
            <td style="padding: 0 32px;" class="padding-mobile">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="border-top: 1px solid #e5e7eb; padding: 20px 0; text-align: center;">
                            <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af; font-weight: bold;">TakeEat Platform</p>
                            <p style="margin: 0 0 4px; font-size: 11px; color: #d1d5db;">הודעה זו נשלחה אוטומטית ממערכת TakeEat</p>
                            <p style="margin: 0; font-size: 11px; color: #d1d5db;">לשאלות ובירורים: support@takeeat.co.il</p>
                            <p style="margin: 8px 0 0; font-size: 10px; color: #e5e7eb;">&copy; {$year} TakeEat. כל הזכויות שמורות.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
HTML;
    }

    // ========================================
    // UI Components - לשימוש חוזר בתבניות
    // ========================================

    /**
     * כפתור CTA מרכזי
     */
    public static function ctaButton(string $text, string $url, string $bgColor = '#f97316'): string
    {
        return <<<HTML
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 24px auto;">
            <tr>
                <td style="background-color: {$bgColor}; border-radius: 12px; text-align: center;">
                    <a href="{$url}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 15px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 12px; font-family: Arial, sans-serif;">{$text}</a>
                </td>
            </tr>
        </table>
HTML;
    }

    /**
     * קופסת מידע מודגשת (bordered box)
     */
    public static function infoBox(string $content, string $borderColor = '#f97316', string $bgColor = '#fff7ed'): string
    {
        return <<<HTML
        <div style="background: {$bgColor}; border: 2px solid {$borderColor}; border-radius: 12px; padding: 20px; margin: 20px 0;">
            {$content}
        </div>
HTML;
    }

    /**
     * שורת מידע (label: value)
     */
    public static function infoRow(string $label, string $value): string
    {
        return <<<HTML
        <p style="margin: 6px 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
            <span style="color: #9ca3af;">{$label}:</span>
            <strong style="color: #1f2937;">{$value}</strong>
        </p>
HTML;
    }

    /**
     * כותרת section
     */
    public static function sectionTitle(string $title, string $color = '#f97316'): string
    {
        return <<<HTML
        <h2 style="margin: 28px 0 12px; font-size: 18px; font-weight: bold; color: {$color}; border-bottom: 2px solid #fed7aa; padding-bottom: 8px;">{$title}</h2>
HTML;
    }

    /**
     * טקסט פשוט
     */
    public static function paragraph(string $text): string
    {
        return '<p style="margin: 0 0 14px; font-size: 14px; color: #4b5563; line-height: 1.7;">' . $text . '</p>';
    }

    /**
     * כרטיס סטטיסטיקה (מספר + תווית)
     */
    public static function statCard(string $number, string $label, string $color = '#f97316'): string
    {
        return <<<HTML
        <td style="text-align: center; padding: 14px; background: #f9fafb; border-radius: 10px;">
            <div style="font-size: 24px; font-weight: bold; color: {$color};">{$number}</div>
            <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">{$label}</div>
        </td>
HTML;
    }

    /**
     * רשימת פיצ'רים (check items)
     */
    public static function featureList(array $items): string
    {
        $html = '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 12px 0;">';
        foreach ($items as $item) {
            $html .= <<<HTML
            <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
                    <span style="color: #22c55e; font-weight: bold; margin-left: 8px;">&#10003;</span>
                    {$item}
                </td>
            </tr>
HTML;
        }
        $html .= '</table>';
        return $html;
    }

    /**
     * הודעת אזהרה
     */
    public static function warningBox(string $content): string
    {
        return self::infoBox($content, '#f59e0b', '#fffbeb');
    }

    /**
     * הודעת הצלחה
     */
    public static function successBox(string $content): string
    {
        return self::infoBox($content, '#22c55e', '#f0fdf4');
    }
}
