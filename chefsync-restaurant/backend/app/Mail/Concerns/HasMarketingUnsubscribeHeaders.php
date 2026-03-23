<?php

namespace App\Mail\Concerns;

use App\Services\EmailMarketingUnsubscribeService;
use Illuminate\Mail\Mailables\Headers;

trait HasMarketingUnsubscribeHeaders
{
    /**
     * כתובת נמען לצורך כותרות List-Unsubscribe (RFC 8058) — חובה למיילים שיווקיים.
     */
    abstract protected function marketingRecipientEmail(): ?string;

    public function headers(): Headers
    {
        $email = $this->marketingRecipientEmail();
        if ($email === null || $email === '') {
            return new Headers;
        }

        return new Headers(
            text: [
                'List-Unsubscribe' => EmailMarketingUnsubscribeService::listUnsubscribeHeaderValue($email),
                'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
            ],
        );
    }

    protected function marketingUnsubscribeFooterHtml(): string
    {
        $email = $this->marketingRecipientEmail();
        if ($email === null || $email === '') {
            return '';
        }

        $url = e(EmailMarketingUnsubscribeService::unsubscribeUrl($email));

        return '<p style="margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center;">'
            .'<a href="'.$url.'" style="color: #9ca3af; text-decoration: underline;">ביטול קבלת מיילים שיווקיים</a>'
            .'</p>';
    }
}
