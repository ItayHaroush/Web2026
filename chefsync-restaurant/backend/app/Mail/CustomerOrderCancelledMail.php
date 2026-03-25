<?php

namespace App\Mail;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Restaurant;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CustomerOrderCancelledMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Order $order,
        public Customer $customer,
        public Restaurant $restaurant,
    ) {}

    public function envelope(): Envelope
    {
        $restaurantName = $this->restaurant->name;
        $orderId = $this->order->id;

        return new Envelope(
            subject: "הזמנה #{$orderId} מ{$restaurantName} בוטלה",
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
        $name = e($this->customer->name ?: 'לקוח/ה יקר/ה');
        $restaurantName = e($this->restaurant->name);
        $orderId = $this->order->id;
        $orderDate = $this->order->created_at->format('d/m/Y H:i');
        $total = number_format($this->order->total_amount ?? 0, 2);

        $body = '';

        $body .= EmailLayoutHelper::paragraph("שלום <strong>{$name}</strong>,");
        $body .= EmailLayoutHelper::paragraph("לצערנו, ההזמנה שלך <strong>#{$orderId}</strong> מ-<strong>{$restaurantName}</strong> בוטלה.");

        // סיבת ביטול
        $reason = $this->order->cancellation_reason;
        if ($reason) {
            $body .= '<div style="background: #fef2f2; border: 2px solid #fca5a5; border-radius: 12px; padding: 16px; margin: 16px 0;">';
            $body .= '<p style="margin: 0; font-size: 14px; color: #991b1b;"><strong>סיבת הביטול:</strong> ' . e($reason) . '</p>';
            $body .= '</div>';
        }

        // פרטי הזמנה
        $body .= EmailLayoutHelper::sectionTitle("פרטי ההזמנה שבוטלה");

        $itemsHtml = $this->buildItemsTable();
        $body .= $itemsHtml;

        $body .= '<div style="text-align: left; margin: 16px 0; padding-top: 12px; border-top: 2px solid #ef4444;">';
        $body .= '<p style="font-size: 18px; font-weight: bold; color: #991b1b; margin: 0; text-decoration: line-through;">סה"כ: ₪' . $total . '</p>';
        $body .= '</div>';

        // תשלום
        $paymentMethod = $this->order->payment_method ?? '';
        if ($paymentMethod === 'credit_card') {
            $body .= EmailLayoutHelper::warningBox(
                '<p style="margin: 0; font-size: 14px; color: #92400e;"><strong>החזר כספי:</strong> אם חויבת, הסכום יוחזר לכרטיס האשראי שלך תוך מספר ימי עסקים.</p>'
            );
        }

        // פרטי הזמנה
        $infoContent = EmailLayoutHelper::infoRow('מספר הזמנה', "#{$orderId}");
        $infoContent .= EmailLayoutHelper::infoRow('תאריך הזמנה', $orderDate);
        $infoContent .= EmailLayoutHelper::infoRow('סטטוס', '<span style="color: #ef4444; font-weight: bold;">בוטלה</span>');

        $body .= EmailLayoutHelper::infoBox($infoContent, '#ef4444', '#fef2f2');

        // CTA להזמנה חדשה — תפריט ציבורי (App.jsx: /:tenantId/menu)
        $tenantId = $this->restaurant->tenant_id ?? '';
        $menuUrl = EmailLayoutHelper::siteUrl('/' . rawurlencode((string) $tenantId) . '/menu');

        $body .= EmailLayoutHelper::paragraph('<span style="text-align: center; display: block; margin-top: 8px;">נשמח לראות אותך שוב!</span>');
        $body .= EmailLayoutHelper::ctaButton('הזמן מחדש', $menuUrl);

        return EmailLayoutHelper::wrap($body, "הזמנה #{$orderId} מ{$restaurantName} בוטלה");
    }

    private function buildItemsTable(): string
    {
        $items = $this->order->items;
        if ($items === null || $items->isEmpty()) {
            return '';
        }

        $html = '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 12px 0; opacity: 0.7;">';
        $html .= '<tr style="background: #fef2f2;">';
        $html .= '<td style="padding: 10px 12px; font-size: 13px; font-weight: bold; color: #991b1b; border-bottom: 1px solid #fecaca;">פריט</td>';
        $html .= '<td style="padding: 10px 12px; font-size: 13px; font-weight: bold; color: #991b1b; border-bottom: 1px solid #fecaca; text-align: center;">כמות</td>';
        $html .= '<td style="padding: 10px 12px; font-size: 13px; font-weight: bold; color: #991b1b; border-bottom: 1px solid #fecaca; text-align: left;">מחיר</td>';
        $html .= '</tr>';

        foreach ($items as $item) {
            $itemName = e($item->name);
            $qty = $item->quantity ?? 1;
            $linePrice = number_format($item->subtotal ?? ($item->price_at_order * $qty), 2);

            $html .= '<tr>';
            $html .= '<td style="padding: 10px 12px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #fef2f2;">' . $itemName . '</td>';
            $html .= '<td style="padding: 10px 12px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #fef2f2; text-align: center;">' . $qty . '</td>';
            $html .= '<td style="padding: 10px 12px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #fef2f2; text-align: left;">' . '₪' . $linePrice . '</td>';
            $html .= '</tr>';
        }

        $html .= '</table>';
        return $html;
    }
}
