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

class CustomerOrderReceiptMail extends Mailable
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
            subject: "ההזמנה נמסרה! אישור #{$orderId} מ{$restaurantName}",
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

        $body = '';

        $body .= EmailLayoutHelper::paragraph("שלום <strong>{$name}</strong>,");
        $body .= EmailLayoutHelper::paragraph("ההזמנה שלך מ-<strong>{$restaurantName}</strong> נמסרה בהצלחה! בתאבון 🍽️");
        $body .= EmailLayoutHelper::paragraph("הנה סיכום ההזמנה שלך:");

        // Order details
        $body .= EmailLayoutHelper::sectionTitle("פרטי הזמנה #{$orderId}");

        $itemsHtml = $this->buildItemsTable();
        $body .= $itemsHtml;

        // Total
        $total = number_format($this->order->total_amount ?? 0, 2);
        $body .= '<div style="text-align: left; margin: 16px 0; padding-top: 12px; border-top: 2px solid #f97316;">';
        $body .= '<p style="font-size: 18px; font-weight: bold; color: #1f2937; margin: 0;">סה"כ: ₪' . $total . '</p>';
        $body .= '</div>';

        // Order info box
        $infoContent = EmailLayoutHelper::infoRow('מספר הזמנה', "#{$orderId}");
        $infoContent .= EmailLayoutHelper::infoRow('תאריך', $orderDate);

        $deliveryMethod = $this->order->delivery_method ?? $this->order->order_type ?? '';
        if ($deliveryMethod === 'delivery') {
            $infoContent .= EmailLayoutHelper::infoRow('אופן קבלה', 'משלוח');
            $address = $this->order->delivery_address ?? $this->order->customer_address ?? '';
            if ($address) {
                $infoContent .= EmailLayoutHelper::infoRow('כתובת', e($address));
            }
        } elseif ($deliveryMethod === 'pickup') {
            $infoContent .= EmailLayoutHelper::infoRow('אופן קבלה', 'איסוף עצמי');
        } elseif ($deliveryMethod === 'dine_in') {
            $infoContent .= EmailLayoutHelper::infoRow('אופן קבלה', 'ישיבה במקום');
        }

        $paymentMethod = $this->order->payment_method ?? '';
        if ($paymentMethod) {
            $paymentLabel = match ($paymentMethod) {
                'cash' => 'מזומן',
                'credit_card', 'credit' => 'כרטיס אשראי',
                'bit' => 'Bit',
                default => $paymentMethod,
            };
            $infoContent .= EmailLayoutHelper::infoRow('אמצעי תשלום', $paymentLabel);
        }

        $body .= EmailLayoutHelper::infoBox($infoContent);

        // Reorder CTA — תפריט ציבורי (App.jsx: /:tenantId/menu)
        $tenantId = $this->restaurant->tenant_id ?? '';
        $menuUrl = EmailLayoutHelper::siteUrl('/' . rawurlencode((string) $tenantId) . '/menu');
        $body .= EmailLayoutHelper::ctaButton('הזמן שוב', $menuUrl);

        // WhatsApp share
        $shareText = urlencode("הזמנתי מ-{$restaurantName} ב-TakeEat וזה היה מעולה! נסו גם: {$menuUrl}");
        $whatsappUrl = "https://wa.me/?text={$shareText}";
        $body .= '<p style="text-align: center; margin: 8px 0 0;">';
        $body .= '<a href="' . $whatsappUrl . '" style="color: #25D366; font-size: 14px; text-decoration: none; font-weight: bold;">📱 שתף עם חברים בוואטסאפ</a>';
        $body .= '</p>';

        return EmailLayoutHelper::wrap($body, "אישור להזמנה #{$orderId} מ{$restaurantName}");
    }

    private function buildItemsTable(): string
    {
        $items = $this->order->items;
        if ($items === null || $items->isEmpty()) {
            return '';
        }

        $html = '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 12px 0;">';
        $html .= '<tr style="background: #f9fafb;">';
        $html .= '<td style="padding: 10px 12px; font-size: 13px; font-weight: bold; color: #6b7280; border-bottom: 1px solid #e5e7eb;">פריט</td>';
        $html .= '<td style="padding: 10px 12px; font-size: 13px; font-weight: bold; color: #6b7280; border-bottom: 1px solid #e5e7eb; text-align: center;">כמות</td>';
        $html .= '<td style="padding: 10px 12px; font-size: 13px; font-weight: bold; color: #6b7280; border-bottom: 1px solid #e5e7eb; text-align: left;">מחיר</td>';
        $html .= '</tr>';

        foreach ($items as $item) {
            $itemName = e($item->name);
            $qty = $item->quantity ?? 1;
            $linePrice = number_format($item->subtotal ?? ($item->price_at_order * $qty), 2);

            $html .= '<tr>';
            $html .= '<td style="padding: 10px 12px; font-size: 14px; color: #1f2937; border-bottom: 1px solid #f3f4f6;">' . $itemName . '</td>';
            $html .= '<td style="padding: 10px 12px; font-size: 14px; color: #4b5563; border-bottom: 1px solid #f3f4f6; text-align: center;">' . $qty . '</td>';
            $html .= '<td style="padding: 10px 12px; font-size: 14px; color: #1f2937; border-bottom: 1px solid #f3f4f6; text-align: left; font-weight: bold;">₪' . $linePrice . '</td>';
            $html .= '</tr>';
        }

        $html .= '</table>';

        return $html;
    }
}
