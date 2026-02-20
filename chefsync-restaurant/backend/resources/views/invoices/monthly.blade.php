<!DOCTYPE html>
<html dir="rtl" lang="he">

<head>
    <meta charset="UTF-8">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            direction: rtl;
            color: #1f2937;
            font-size: 11px;
            line-height: 1.4;
            padding: 20px 30px 40px;
        }

        /* Header */
        .header {
            width: 100%;
            margin-bottom: 12px;
            border-bottom: 3px solid #f97316;
            padding-bottom: 10px;
        }

        .header-table {
            width: 100%;
        }

        .header-table td {
            vertical-align: middle;
        }

        .invoice-title {
            font-size: 20px;
            font-weight: bold;
            color: #f97316;
            margin-bottom: 2px;
        }

        .invoice-number {
            font-size: 11px;
            color: #6b7280;
        }

        .logo {
            height: 42px;
        }

        .logo-text {
            font-size: 18px;
            font-weight: bold;
            color: #f97316;
        }

        /* Info Section */
        .info-table {
            width: 100%;
            margin-bottom: 10px;
        }

        .info-table td {
            vertical-align: top;
            width: 48%;
            padding: 7px 10px;
            background: #f9fafb;
            border-radius: 5px;
        }

        .info-table td.spacer {
            width: 4%;
            background: none;
            padding: 0;
        }

        .info-label {
            font-size: 9px;
            color: #9ca3af;
            letter-spacing: 1px;
            margin-bottom: 3px;
            font-weight: bold;
        }

        .info-value {
            font-weight: bold;
        }

        .info-line {
            font-size: 11px;
            margin-bottom: 1px;
        }

        /* Items Table */
        table.items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
        }

        table.items th {
            background: #f97316;
            color: white;
            padding: 5px 10px;
            text-align: right;
            font-size: 10px;
            font-weight: bold;
        }

        table.items th.amount-col {
            text-align: left;
        }

        table.items td {
            padding: 6px 10px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 11px;
            text-align: right;
        }

        table.items td.amount-col {
            text-align: left;
            font-weight: bold;
        }

        table.items tr:last-child td {
            border-bottom: none;
        }

        /* Total */
        .total-box {
            width: 100%;
            margin-top: 6px;
            margin-bottom: 10px;
            border: 2px solid #f97316;
            border-radius: 5px;
            background: #fff7ed;
        }

        .total-box td {
            padding: 8px 14px;
            vertical-align: middle;
        }

        .total-label {
            font-size: 13px;
            font-weight: bold;
            text-align: right;
        }

        .total-amount {
            text-align: left;
            font-size: 17px;
            font-weight: bold;
            color: #f97316;
        }

        /* Status Badge */
        .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 20px;
            font-size: 9px;
            font-weight: bold;
        }

        .status-draft {
            background: #e5e7eb;
            color: #4b5563;
        }

        .status-pending {
            background: #fef3c7;
            color: #92400e;
        }

        .status-paid {
            background: #d1fae5;
            color: #065f46;
        }

        .status-overdue {
            background: #fee2e2;
            color: #991b1b;
        }

        /* Section Header */
        .section-header {
            font-size: 12px;
            font-weight: bold;
            color: #f97316;
            margin-top: 12px;
            margin-bottom: 6px;
            padding-bottom: 3px;
            border-bottom: 2px solid #fed7aa;
        }

        /* Activity Cards */
        .activity-table {
            width: 100%;
            margin-bottom: 8px;
        }

        .activity-table td {
            vertical-align: top;
            padding: 7px 10px;
            background: #f9fafb;
            border-radius: 5px;
        }

        .activity-table td.spacer {
            width: 3%;
            background: none;
            padding: 0;
        }

        .stat-number {
            font-size: 15px;
            font-weight: bold;
            color: #1f2937;
        }

        .stat-label {
            font-size: 9px;
            color: #6b7280;
            margin-top: 1px;
        }

        /* Breakdown Table */
        table.breakdown {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
        }

        table.breakdown th {
            background: #f3f4f6;
            padding: 3px 8px;
            text-align: right;
            font-size: 9px;
            font-weight: bold;
            color: #6b7280;
            border-bottom: 1px solid #e5e7eb;
        }

        table.breakdown th.num-col {
            text-align: left;
        }

        table.breakdown td {
            padding: 3px 8px;
            font-size: 10px;
            text-align: right;
            border-bottom: 1px solid #f3f4f6;
        }

        table.breakdown td.num-col {
            text-align: left;
            font-weight: bold;
        }

        /* Features Grid */
        .features-table {
            width: 100%;
            margin-bottom: 6px;
        }

        .features-table td {
            width: 24%;
            padding: 7px;
            background: #f9fafb;
            border-radius: 5px;
            text-align: center;
        }

        .features-table td.spacer {
            width: 1.3%;
            background: none;
            padding: 0;
        }

        .feature-number {
            font-size: 14px;
            font-weight: bold;
            color: #f97316;
        }

        .feature-label {
            font-size: 8px;
            color: #6b7280;
            margin-top: 1px;
        }

        /* Notes */
        .notes-box {
            margin-top: 8px;
            padding: 7px 10px;
            background: #eff6ff;
            border-radius: 5px;
            border-right: 3px solid #3b82f6;
        }

        .notes-title {
            font-size: 10px;
            color: #1e40af;
            font-weight: bold;
            margin-bottom: 2px;
        }

        .notes-text {
            font-size: 10px;
            color: #1e40af;
        }

        /* Page 2 - Tips */
        .tips-subtitle {
            font-size: 11px;
            color: #6b7280;
            text-align: center;
            margin-bottom: 16px;
        }

        .tip-card {
            width: 100%;
            margin-bottom: 10px;
        }

        .tip-card td {
            padding: 12px 14px;
            background: #f9fafb;
            border-radius: 6px;
            border-right: 4px solid #f97316;
        }

        .tip-title {
            font-size: 12px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 3px;
        }

        .tip-description {
            font-size: 10px;
            color: #6b7280;
            line-height: 1.5;
        }

        .cta-box {
            width: 100%;
            margin-top: 16px;
            border: 2px solid #f97316;
            border-radius: 6px;
            background: #fff7ed;
        }

        .cta-box td {
            padding: 14px 18px;
            text-align: center;
        }

        .cta-title {
            font-size: 14px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 3px;
        }

        .cta-text {
            font-size: 10px;
            color: #6b7280;
        }

        .cta-url {
            font-size: 11px;
            font-weight: bold;
            color: #f97316;
            margin-top: 4px;
        }
    </style>
</head>

<body>

    {{-- ==================== PAGE 1 — INVOICE ==================== --}}

    {{-- HEADER --}}
    <table class="header-table">
        <tr>
            <td style="width: 60%; text-align: right;">
                <div class="invoice-title">חשבונית חודשית TakeEat</div>
                <div class="invoice-number">{{ $invoiceNumber }}</div>
            </td>
            <td style="width: 40%; text-align: left;">
                @if($logoBase64)
                <img src="data:image/png;base64,{{ $logoBase64 }}" class="logo" alt="TakeEat">
                @else
                <div class="logo-text">TakeEat</div>
                @endif
            </td>
        </tr>
    </table>
    <div class="header"></div>

    {{-- INFO SECTION --}}
    <table class="info-table">
        <tr>
            <td>
                <div class="info-label">פרטי מסעדה</div>
                <p class="info-line"><span class="info-value">{{ $restaurant->name }}</span></p>
                <p class="info-line">מזהה: {{ $restaurant->tenant_id }}</p>
                @if($restaurant->phone)
                <p class="info-line">טלפון: {{ $restaurant->phone }}</p>
                @endif
                @if($restaurant->address)
                <p class="info-line">כתובת: {{ $restaurant->address }}</p>
                @endif
            </td>
            <td class="spacer"></td>
            <td>
                <div class="info-label">פרטי חשבונית</div>
                <p class="info-line">תקופה: <span class="info-value">{{ $monthHebrew }}</span></p>
                <p class="info-line">תאריך הפקה: {{ $issueDate }}</p>
                <p class="info-line">מטבע: {{ $invoice->currency ?? 'ILS' }}</p>
                <p class="info-line">
                    סטטוס:
                    <span class="status-badge status-{{ $invoice->status }}">
                        {{ $statusLabels[$invoice->status] ?? $invoice->status }}
                    </span>
                </p>
            </td>
        </tr>
    </table>

    {{-- SUBSCRIPTION + BILLING COMBINED --}}
    <table class="info-table">
        <tr>
            <td>
                <div class="info-label">פרטי מנוי</div>
                <p class="info-line">סוג מנוי: <span class="info-value">{{ $tierLabel }}</span></p>
                <p class="info-line">מודל חיוב: <span class="info-value">{{ $billingModelLabels[$invoice->billing_model] ?? $invoice->billing_model }}</span></p>
                @if($subscription)
                <p class="info-line">סטטוס מנוי: <span class="info-value">{{ $subscriptionStatusLabels[$subscription->status] ?? $subscription->status }}</span></p>
                @endif
            </td>
            <td class="spacer"></td>
            <td>
                <div class="info-label">&nbsp;</div>
                @if($invoice->billing_model !== 'flat' && $invoice->commission_percent > 0)
                <p class="info-line">אחוז עמלה: <span class="info-value">{{ $invoice->commission_percent }}%</span></p>
                @endif
                @if($invoice->base_fee > 0)
                <p class="info-line">דמי מנוי חודשי: <span class="info-value">{{ number_format($invoice->base_fee, 2) }} &#8362;</span></p>
                @endif
                <p class="info-line">קרדיטים AI חודשיים: <span class="info-value">{{ $aiCreditsMonthly > 0 ? $aiCreditsMonthly : 'לא כלול' }}</span></p>
            </td>
        </tr>
    </table>

    {{-- BILLING TABLE --}}
    <div class="section-header">פירוט חיוב</div>
    <table class="items">
        <thead>
            <tr>
                <th>תיאור</th>
                <th>פרטים</th>
                <th class="amount-col">סכום</th>
            </tr>
        </thead>
        <tbody>
            @if($invoice->base_fee > 0)
            <tr>
                <td>דמי מנוי חודשי</td>
                <td>תשלום קבוע</td>
                <td class="amount-col">{{ number_format($invoice->base_fee, 2) }} &#8362;</td>
            </tr>
            @endif
            @if($invoice->commission_fee > 0)
            <tr>
                <td>עמלת פלטפורמה</td>
                <td>{{ $invoice->commission_percent }}% על {{ number_format($invoice->order_revenue, 2) }} &#8362; ({{ $invoice->order_count }} הזמנות)</td>
                <td class="amount-col">{{ number_format($invoice->commission_fee, 2) }} &#8362;</td>
            </tr>
            @endif
            @if($invoice->base_fee == 0 && $invoice->commission_fee == 0)
            <tr>
                <td>ללא חיובים</td>
                <td>-</td>
                <td class="amount-col">0.00 &#8362;</td>
            </tr>
            @endif
        </tbody>
    </table>

    <table class="total-box">
        <tr>
            <td class="total-label">סה״כ לתשלום</td>
            <td class="total-amount">{{ number_format($invoice->total_due, 2) }} &#8362;</td>
        </tr>
    </table>

    {{-- ORDER ACTIVITY --}}
    <div class="section-header">פעילות הזמנות - {{ $monthHebrew }}</div>

    <table class="activity-table">
        <tr>
            <td style="width: 22%;">
                <div class="stat-number">{{ number_format($totalOrders) }}</div>
                <div class="stat-label">הזמנות שבוצעו</div>
            </td>
            <td class="spacer"></td>
            <td style="width: 22%;">
                <div class="stat-number">{{ number_format($totalRevenue, 2) }} &#8362;</div>
                <div class="stat-label">מחזור (ללא ביטולים)</div>
            </td>
            <td class="spacer"></td>
            <td style="width: 22%;">
                <div class="stat-number">{{ number_format($avgOrderValue, 2) }} &#8362;</div>
                <div class="stat-label">ממוצע להזמנה</div>
            </td>
            <td class="spacer"></td>
            <td style="width: 22%;">
                <div class="stat-number" style="color: #ef4444;">{{ number_format($cancelledCount) }}</div>
                <div class="stat-label">הזמנות שבוטלו ({{ number_format($cancelledRevenue, 2) }} ₪)</div>
            </td>
        </tr>
    </table>

    {{-- Orders by Status & Payment --}}
    @if(count($ordersByStatus) > 0)
    <table class="info-table">
        <tr>
            <td>
                <div class="info-label">לפי סטטוס</div>
                <table class="breakdown">
                    <thead>
                        <tr>
                            <th>סטטוס</th>
                            <th class="num-col">כמות</th>
                            <th class="num-col">סכום</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($ordersByStatus as $status => $data)
                        <tr>
                            <td>{{ $orderStatusLabels[$status] ?? $status }}</td>
                            <td class="num-col">{{ $data['count'] }}</td>
                            <td class="num-col">{{ number_format($data['revenue'], 2) }} &#8362;</td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="info-label">לפי אמצעי תשלום</div>
                @if(count($ordersByPayment) > 0)
                <table class="breakdown">
                    <thead>
                        <tr>
                            <th>אמצעי</th>
                            <th class="num-col">כמות</th>
                            <th class="num-col">סכום</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($ordersByPayment as $method => $data)
                        <tr>
                            <td>{{ $paymentMethodLabels[$method] ?? $method }}</td>
                            <td class="num-col">{{ $data['count'] }}</td>
                            <td class="num-col">{{ number_format($data['total'], 2) }} &#8362;</td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
                @else
                <p class="info-line" style="color: #9ca3af;">אין נתונים</p>
                @endif
            </td>
        </tr>
    </table>
    @endif

    {{-- Orders by Source (web/kiosk) --}}
    @if(count($ordersBySource) > 0)
    <table class="info-table">
        <tr>
            <td>
                <div class="info-label">לפי מקור הזמנה</div>
                <table class="breakdown">
                    <thead>
                        <tr>
                            <th>מקור</th>
                            <th class="num-col">כמות</th>
                            <th class="num-col">סכום</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($ordersBySource as $source => $data)
                        <tr>
                            <td>{{ $sourceLabels[$source] ?? $source }}</td>
                            <td class="num-col">{{ $data['count'] }}</td>
                            <td class="num-col">{{ number_format($data['total'], 2) }} &#8362;</td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="info-label">&nbsp;</div>
            </td>
        </tr>
    </table>
    @endif

    {{-- FEATURES & AI USAGE --}}
    <div class="section-header">שימוש בתכונות המערכת</div>

    <table class="features-table">
        <tr>
            <td>
                <div class="feature-number">{{ $menuItemsCount }}</div>
                <div class="feature-label">פריטי תפריט</div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="feature-number">{{ $categoriesCount }}</div>
                <div class="feature-label">קטגוריות</div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="feature-number">{{ $displayScreensCount }}</div>
                <div class="feature-label">מסכי תצוגה</div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="feature-number">{{ $kiosksCount }}</div>
                <div class="feature-label">קיוסקים</div>
            </td>
        </tr>
    </table>

    @if($aiCreditsMonthly > 0 || $totalAiCreditsUsed > 0)
    <table class="info-table">
        <tr>
            <td>
                <div class="info-label">שימוש AI</div>
                <p class="info-line">קרדיטים: <span class="info-value">{{ $totalAiCreditsUsed }} / {{ $aiCreditsMonthly > 0 ? $aiCreditsMonthly : '&#8734;' }}</span></p>
                @if(isset($aiUsage['generate_description']))
                <p class="info-line">תיאורים: {{ $aiUsage['generate_description']['total'] ?? 0 }}</p>
                @endif
                @if(isset($aiUsage['recommend_price']))
                <p class="info-line">המלצות מחיר: {{ $aiUsage['recommend_price']['total'] ?? 0 }}</p>
                @endif
            </td>
            <td class="spacer"></td>
            <td>
                <div class="info-label">&nbsp;</div>
                @if(isset($aiUsage['enhance_image']))
                <p class="info-line">שיפור תמונות: {{ $aiUsage['enhance_image']['total'] ?? 0 }}</p>
                @endif
                @if(isset($aiUsage['dashboard_insights']))
                <p class="info-line">תובנות דשבורד: {{ $aiUsage['dashboard_insights']['total'] ?? 0 }}</p>
                @endif
                @if(isset($aiUsage['chat']))
                <p class="info-line">צ׳אט AI: {{ $aiUsage['chat']['total'] ?? 0 }}</p>
                @endif
            </td>
        </tr>
    </table>
    @endif

    @if($invoice->notes)
    <div class="notes-box">
        <p class="notes-title">הערות:</p>
        <p class="notes-text">{{ $invoice->notes }}</p>
    </div>
    @endif

    {{-- ==================== PAGE 2 — TIPS & RECOMMENDATIONS ==================== --}}
    <pagebreak />

    {{-- Header for page 2 --}}
    <table class="header-table">
        <tr>
            <td style="width: 60%; text-align: right;">
                <div class="invoice-title">הצעות לייעול העסק</div>
                <div class="invoice-number">{{ $restaurant->name }} — {{ $monthHebrew }}</div>
            </td>
            <td style="width: 40%; text-align: left;">
                @if($logoBase64)
                <img src="data:image/png;base64,{{ $logoBase64 }}" class="logo" alt="TakeEat">
                @else
                <div class="logo-text">TakeEat</div>
                @endif
            </td>
        </tr>
    </table>
    <div class="header"></div>

    <div class="tips-subtitle">בהתבסס על הנתונים שלך מ{{ $monthHebrew }}, הנה כמה הצעות שיכולות לעזור לך לשפר את הביצועים</div>

    {{-- Dynamic tips based on data --}}
    @if($totalOrders < 20)
        <table class="tip-card">
        <tr>
            <td>
                <div class="tip-title">הגדל את החשיפה של התפריט הדיגיטלי</div>
                <div class="tip-description">קיבלת {{ $totalOrders }} הזמנות החודש. שתף את הלינק לתפריט ברשתות חברתיות, בגוגל מפות ובכרטיס ביקור. ניתן גם להדפיס QR Code ולהניח על השולחנות.</div>
            </td>
        </tr>
        </table>
        @endif

        @if($cancelledCount > 0)
        <table class="tip-card">
            <tr>
                <td>
                    <div class="tip-title">צמצם ביטולי הזמנות</div>
                    <div class="tip-description">החודש בוטלו {{ $cancelledCount }} הזמנות. מומלץ לבדוק את הסיבות ולעדכן זמינות פריטים בזמן אמת כדי להפחית ביטולים.</div>
                </td>
            </tr>
        </table>
        @endif

        <table class="tip-card">
            <tr>
                <td>
                    <div class="tip-title">בדוק את הדוחות בפאנל הניהול</div>
                    <div class="tip-description">בדף הדוחות תוכל לראות ניתוח מפורט של מגמות מכירות, פריטים פופולריים ושעות עומס. נתונים אלה יעזרו לך לקבל החלטות מבוססות נתונים על התפריט ושעות הפעילות.</div>
                </td>
            </tr>
        </table>

        <table class="tip-card">
            <tr>
                <td>
                    <div class="tip-title">עדכן את התפריט באופן שוטף</div>
                    <div class="tip-description">יש לך {{ $menuItemsCount }} פריטים בתפריט. מומלץ לוודא שכל הפריטים מעודכנים עם תמונות איכותיות ותיאורים מפורטים. ניתן להשתמש בסוכן ה-AI ליצירת תיאורים מושכים באופן אוטומטי.</div>
                </td>
            </tr>
        </table>

        @if($displayScreensCount == 0 && $kiosksCount == 0)
        <table class="tip-card">
            <tr>
                <td>
                    <div class="tip-title">הפעל מסכי תצוגה וקיוסקים</div>
                    <div class="tip-description">מסכי תצוגה מאפשרים ללקוחות לראות את סטטוס ההזמנה בזמן אמת, וקיוסקים מאפשרים הזמנה עצמאית. שניהם מגדילים יעילות תפעולית ושביעות רצון לקוחות.</div>
                </td>
            </tr>
        </table>
        @endif

        @if($aiCreditsMonthly > 0 && $totalAiCreditsUsed < ($aiCreditsMonthly * 0.3))
            <table class="tip-card">
            <tr>
                <td>
                    <div class="tip-title">נצל את קרדיטי ה-AI שלך</div>
                    <div class="tip-description">השתמשת ב-{{ $totalAiCreditsUsed }} מתוך {{ $aiCreditsMonthly }} קרדיטים בלבד. נסה את הסוכן החכם ליצירת תיאורי מנות, המלצות מחיר ותובנות עסקיות.</div>
                </td>
            </tr>
            </table>
            @endif

            <table class="tip-card">
                <tr>
                    <td>
                        <div class="tip-title">גישה מהירה לפאנל הניהול</div>
                        <div class="tip-description">ניתן לגשת לפאנל הניהול בכל עת ומכל מכשיר. שם תוכל לנהל הזמנות, לעדכן תפריט, לצפות בדוחות, להגדיר קופונים, לנהל עובדים ועוד.</div>
                    </td>
                </tr>
            </table>

            {{-- CTA --}}
            <table class="cta-box">
                <tr>
                    <td>
                        <div class="cta-title">צריך עזרה? הצוות שלנו כאן לשירותך</div>
                        <div class="cta-text">לשאלות, בירורים או סיוע טכני ניתן לפנות אלינו בכל עת</div>
                        <div class="cta-url">billing@takeeat.co.il</div>
                    </td>
                </tr>
            </table>

</body>

</html>