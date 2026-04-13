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
            font-family: Arial, sans-serif;
            direction: rtl;
            color: #1f2937;
            font-size: 13px;
        }

        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #f97316;
            padding-bottom: 15px;
        }

        .header h1 {
            font-size: 22px;
            color: #f97316;
            margin-bottom: 4px;
        }

        .header .subtitle {
            font-size: 14px;
            color: #6b7280;
        }

        .header .date {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 4px;
        }

        .kpi-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 18px;
        }

        .kpi-card {
            flex: 1;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
            margin: 0 4px;
        }

        .kpi-card .value {
            font-size: 20px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 2px;
        }

        .kpi-card .label {
            font-size: 11px;
            color: #6b7280;
        }

        .section-title {
            font-size: 15px;
            font-weight: bold;
            color: #f97316;
            border-bottom: 1px solid #fed7aa;
            padding-bottom: 4px;
            margin: 16px 0 10px;
        }

        table.data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }

        table.data-table th {
            background: #f9fafb;
            padding: 8px 10px;
            font-size: 11px;
            color: #6b7280;
            border-bottom: 1px solid #e5e7eb;
            text-align: right;
        }

        table.data-table td {
            padding: 8px 10px;
            font-size: 12px;
            border-bottom: 1px solid #f3f4f6;
        }

        .info-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 16px;
        }

        .info-item {
            flex: 0 0 48%;
            background: #f9fafb;
            border-radius: 6px;
            padding: 8px 12px;
        }

        .info-item .label {
            font-size: 11px;
            color: #6b7280;
        }

        .info-item .value {
            font-size: 14px;
            font-weight: bold;
            color: #1f2937;
        }

        .footer {
            text-align: center;
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid #e5e7eb;
            font-size: 11px;
            color: #9ca3af;
        }
    </style>
</head>

<body>
    @php
    $restaurantName = $report->restaurant?->name ?? '';
    $date = $report->date->format('d/m/Y');
    $json = $report->report_json ?? [];
    $topItems = $json['top_items'] ?? [];
    $hourlyBreakdown = $json['hourly_breakdown'] ?? [];
    $transactions = $json['transactions'] ?? [];
    $netRevenue = (float) ($report->net_revenue ?: $report->total_revenue);
    @endphp

    <div class="header">
        <h1>TakeEat</h1>
        <div class="subtitle">דוח יומי — {{ $restaurantName }}</div>
        <div class="date">{{ $date }}</div>
    </div>

    {{-- KPIs ראשיים --}}
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
        <tr>
            <td width="25%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value" style="color: #6b7280;">₪{{ number_format($report->total_revenue, 0) }}</div>
                    <div class="label">ברוטו</div>
                </div>
            </td>
            <td width="25%" style="padding: 0 4px;">
                <div class="kpi-card" style="border: 2px solid #22c55e;">
                    <div class="value" style="color: #22c55e;">₪{{ number_format($netRevenue, 0) }}</div>
                    <div class="label">נטו אמיתי</div>
                </div>
            </td>
            <td width="25%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value" style="color: #3b82f6;">{{ $report->total_orders }}</div>
                    <div class="label">הזמנות</div>
                </div>
            </td>
            <td width="25%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value" style="color: #f97316;">₪{{ number_format($report->avg_order_value, 0) }}</div>
                    <div class="label">ממוצע</div>
                </div>
            </td>
        </tr>
    </table>

    {{-- החזרים --}}
    @if(($report->refund_count ?? 0) > 0)
    @php
        $cashRefund = (float) ($json['cash_refund_total'] ?? 0);
        $creditRefund = (float) ($json['credit_refund_total'] ?? 0);
        $grossCash = $report->cash_total + $cashRefund;
        $grossCredit = $report->credit_total + $creditRefund;
    @endphp
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
        <tr>
            <td width="50%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value" style="color: #ef4444;">{{ $report->refund_count }}</div>
                    <div class="label">החזרים</div>
                </div>
            </td>
            <td width="50%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value" style="color: #ef4444;">-₪{{ number_format($report->refund_total, 0) }}</div>
                    <div class="label">סכום החזרים</div>
                </div>
            </td>
        </tr>
    </table>

    {{-- מזומן בפועל לאחר החזרים --}}
    @if($cashRefund > 0 || $creditRefund > 0)
    <div class="section-title">סיכום בפועל (לאחר החזרים)</div>
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
        <tr>
            @if($cashRefund > 0)
            <td width="33%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value" style="color: #6b7280;">₪{{ number_format($grossCash, 0) }}</div>
                    <div class="label">מזומן שנגבה</div>
                </div>
            </td>
            <td width="33%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value" style="color: #ef4444;">-₪{{ number_format($cashRefund, 0) }}</div>
                    <div class="label">החזרי מזומן</div>
                </div>
            </td>
            <td width="33%" style="padding: 0 4px;">
                <div class="kpi-card" style="border: 2px solid #22c55e;">
                    <div class="value" style="color: #22c55e;">₪{{ number_format($report->cash_total, 0) }}</div>
                    <div class="label">מזומן בפועל</div>
                </div>
            </td>
            @endif
        </tr>
    </table>
    @if($creditRefund > 0)
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
        <tr>
            <td width="33%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value" style="color: #6b7280;">₪{{ number_format($grossCredit, 0) }}</div>
                    <div class="label">אשראי שנגבה</div>
                </div>
            </td>
            <td width="33%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value" style="color: #ef4444;">-₪{{ number_format($creditRefund, 0) }}</div>
                    <div class="label">החזרי אשראי</div>
                </div>
            </td>
            <td width="33%" style="padding: 0 4px;">
                <div class="kpi-card" style="border: 2px solid #22c55e;">
                    <div class="value" style="color: #22c55e;">₪{{ number_format($report->credit_total, 0) }}</div>
                    <div class="label">אשראי בפועל</div>
                </div>
            </td>
        </tr>
    </table>
    @endif
    @endif
    @endif

    {{-- אמצעי תשלום --}}
    <div class="section-title">אמצעי תשלום</div>
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
        <tr>
            <td width="25%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value">₪{{ number_format($report->cash_total, 0) }}</div>
                    <div class="label">מזומן</div>
                </div>
            </td>
            @if(($report->online_credit_total ?? 0) > 0 || ($report->pos_credit_total ?? 0) > 0 || ($report->kiosk_credit_total ?? 0) > 0)
            @if(($report->online_credit_total ?? 0) > 0)
            <td width="25%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value">₪{{ number_format($report->online_credit_total, 0) }}</div>
                    <div class="label">אשראי אתר (HYP)</div>
                </div>
            </td>
            @endif
            @if(($report->pos_credit_total ?? 0) > 0)
            <td width="25%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value">₪{{ number_format($report->pos_credit_total, 0) }}</div>
                    <div class="label">אשראי קופה (POS)</div>
                </div>
            </td>
            @endif
            @if(($report->kiosk_credit_total ?? 0) > 0)
            <td width="25%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value">₪{{ number_format($report->kiosk_credit_total, 0) }}</div>
                    <div class="label">אשראי קיוסק</div>
                </div>
            </td>
            @endif
            @else
            <td width="25%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value">₪{{ number_format($report->credit_total, 0) }}</div>
                    <div class="label">אשראי</div>
                </div>
            </td>
            @endif
        </tr>
    </table>

    {{-- פילוח --}}
    <div class="section-title">פילוח הזמנות</div>
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
        <tr>
            <td width="50%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value">{{ $report->pickup_orders }}</div>
                    <div class="label">איסוף</div>
                </div>
            </td>
            <td width="50%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value">{{ $report->delivery_orders }}</div>
                    <div class="label">משלוח</div>
                </div>
            </td>
        </tr>
    </table>

    {{-- פילוח לפי מקור --}}
    @if(($report->web_orders ?? 0) + ($report->kiosk_orders ?? 0) + ($report->pos_orders ?? 0) > 0)
    <div class="section-title">מקור הזמנות</div>
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
        <tr>
            @if(($report->web_orders ?? 0) > 0)
            <td width="33%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value">{{ $report->web_orders }}</div>
                    <div class="label">אונליין (₪{{ number_format($report->web_revenue ?? 0, 0) }})</div>
                </div>
            </td>
            @endif
            @if(($report->kiosk_orders ?? 0) > 0)
            <td width="33%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value">{{ $report->kiosk_orders }}</div>
                    <div class="label">קיוסק (₪{{ number_format($report->kiosk_revenue ?? 0, 0) }})</div>
                </div>
            </td>
            @endif
            @if(($report->pos_orders ?? 0) > 0)
            <td width="33%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value">{{ $report->pos_orders }}</div>
                    <div class="label">קופה (₪{{ number_format($report->pos_revenue ?? 0, 0) }})</div>
                </div>
            </td>
            @endif
        </tr>
    </table>
    @if(($report->dine_in_orders ?? 0) + ($report->takeaway_orders ?? 0) > 0)
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
        <tr>
            <td width="50%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value">{{ $report->dine_in_orders ?? 0 }}</div>
                    <div class="label">לשבת (קיוסק)</div>
                </div>
            </td>
            <td width="50%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value">{{ $report->takeaway_orders ?? 0 }}</div>
                    <div class="label">לקחת (קיוסק)</div>
                </div>
            </td>
        </tr>
    </table>
    @endif
    @endif

    @if($report->cancelled_orders > 0)
    <div class="section-title">ביטולים</div>
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
        <tr>
            <td width="50%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value" style="color: #ef4444;">{{ $report->cancelled_orders }}</div>
                    <div class="label">הזמנות שבוטלו</div>
                </div>
            </td>
            <td width="50%" style="padding: 0 4px;">
                <div class="kpi-card">
                    <div class="value" style="color: #ef4444;">₪{{ number_format($report->cancelled_total, 0) }}</div>
                    <div class="label">סכום ביטולים</div>
                </div>
            </td>
        </tr>
    </table>
    @endif

    {{-- פריטים מובילים --}}
    @if(!empty($topItems))
    <div class="section-title">פריטים מובילים</div>
    <table class="data-table">
        <thead>
            <tr>
                <th>פריט</th>
                <th>כמות</th>
                <th>הכנסה</th>
            </tr>
        </thead>
        <tbody>
            @foreach(array_slice($topItems, 0, 15) as $item)
            <tr>
                <td>{{ $item['name'] ?? '' }}</td>
                <td>{{ number_format($item['quantity'] ?? 0) }}</td>
                <td>₪{{ number_format($item['revenue'] ?? 0, 0) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    @endif

    {{-- פירוט שעתי --}}
    @if(!empty($hourlyBreakdown))
    <div class="section-title">פירוט שעתי</div>
    <table class="data-table">
        <thead>
            <tr>
                <th>שעה</th>
                <th>הזמנות</th>
                <th>הכנסה</th>
            </tr>
        </thead>
        <tbody>
            @foreach($hourlyBreakdown as $hour => $data)
            @if(($data['orders'] ?? 0) > 0)
            <tr>
                <td>{{ str_pad($hour, 2, '0', STR_PAD_LEFT) }}:00</td>
                <td>{{ $data['orders'] }}</td>
                <td>₪{{ number_format($data['revenue'] ?? 0, 0) }}</td>
            </tr>
            @endif
            @endforeach
        </tbody>
    </table>
    @endif

    <div class="footer">
        הופק אוטומטית ע״י מערכת TakeEat &bull; {{ now()->format('d/m/Y H:i') }}
    </div>
</body>

</html>