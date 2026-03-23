<!DOCTYPE html>
<html dir="rtl" lang="he">

<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
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
        .header h1 { font-size: 22px; color: #f97316; margin-bottom: 4px; }
        .header .sub { font-size: 14px; color: #6b7280; }
        .kpi-row { display: flex; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
        .kpi {
            flex: 1;
            min-width: 120px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
        }
        .kpi .v { font-size: 18px; font-weight: bold; color: #1f2937; }
        .kpi .l { font-size: 11px; color: #6b7280; margin-top: 4px; }
        .section { font-size: 15px; font-weight: bold; color: #f97316; border-bottom: 1px solid #fed7aa; padding-bottom: 4px; margin: 16px 0 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: right; }
        th { background: #f3f4f6; font-weight: bold; }
        tr:nth-child(even) { background: #fafafa; }
    </style>
</head>

<body>
    @php
        $rname = $summary['restaurant_name'] ?? ($restaurant->name ?? '');
        $y = $summary['year'] ?? '';
        $q = $summary['quarter'] ?? '';
        $from = $summary['from'] ?? '';
        $to = $summary['to'] ?? '';
    @endphp
    <div class="header">
        <h1>דוח רבעוני — TakeEat</h1>
        <p class="sub">{{ $rname }}</p>
        <p class="sub" style="margin-top:6px;">רבעון {{ $q }} · {{ $y }} · {{ $from }} — {{ $to }}</p>
    </div>

    <div class="kpi-row">
        <div class="kpi">
            <div class="v">{{ number_format((int) ($summary['days_with_reports'] ?? 0)) }}</div>
            <div class="l">ימים עם דוח</div>
        </div>
        <div class="kpi">
            <div class="v">{{ number_format((int) ($summary['total_orders'] ?? 0)) }}</div>
            <div class="l">סה״כ הזמנות</div>
        </div>
        <div class="kpi">
            <div class="v">₪{{ number_format((float) ($summary['total_revenue'] ?? 0), 0) }}</div>
            <div class="l">סה״כ הכנסות</div>
        </div>
        <div class="kpi">
            <div class="v">{{ number_format((int) ($summary['total_cancelled_orders'] ?? 0)) }}</div>
            <div class="l">הזמנות מבוטלות</div>
        </div>
    </div>

    @if(!empty($summary['daily_breakdown']) && count($summary['daily_breakdown']) > 0)
        <div class="section">פירוט יומי</div>
        <table>
            <thead>
                <tr>
                    <th>תאריך</th>
                    <th>הזמנות</th>
                    <th>הכנסות (₪)</th>
                    <th>בוטלו</th>
                </tr>
            </thead>
            <tbody>
                @foreach($summary['daily_breakdown'] as $row)
                    <tr>
                        <td>{{ $row['date'] ?? '' }}</td>
                        <td>{{ (int) ($row['total_orders'] ?? 0) }}</td>
                        <td>{{ number_format((float) ($row['total_revenue'] ?? 0), 0) }}</td>
                        <td>{{ (int) ($row['cancelled_orders'] ?? 0) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @else
        <p style="color:#9ca3af; text-align:center; padding:20px;">אין שורות דוח יומי ברבעון זה.</p>
    @endif
</body>

</html>
