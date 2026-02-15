<!DOCTYPE html>
<html lang="he" dir="rtl">

<head>
    <meta charset="UTF-8">
    <title>חשבונית מס / קבלה - Itay Solutions</title>
    <style>
        body {
            direction: rtl;
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 15px;
            margin: 0;
            padding: 0;
        }

        h2 {
            margin: 12px 0 8px 0;
            font-size: 22px;
        }

        table {
            border-collapse: collapse;
            width: 100%;
            margin: 18px 0 10px 0;
        }

        th,
        td {
            border: 1px solid #bbb;
            padding: 6px;
            text-align: center;
        }

        th {
            background: #f7f7fa;
        }

        .footer {
            margin-top: 30px;
            text-align: center;
            color: #888;
            font-size: 12px;
        }

        table {
            border-collapse: collapse;
            width: 100%;
            margin: 18px 0 10px 0;
            font-size: 15px;
        }

        table th,
        table td {
            border: 1px solid #bbb;
            padding: 8px 6px;
            text-align: center;
        }

        table th {
            background: #f7f7fa;
            color: #7c3aed;
            font-weight: bold;
        }

        .section-title {
            font-size: 16px;
            color: #7c3aed;
            font-weight: bold;
            margin-top: 18px;
            margin-bottom: 6px;
        }

        .summary {
            margin-top: 18px;
            font-size: 18px;
            color: #ff6600;
            font-weight: bold;
        }

        .footer {
            margin-top: 40px;
            text-align: center;
            color: #888;
            font-size: 13px;
        }
    </style>
</head>

<body>
    <h2>חשבונית מס / קבלה - Itay Solutions</h2>
    <div class="section-title">מס' חשבונית: {{ $invoiceNumber }} | תאריך: {{ $date }}</div>
    <div style="display: flex; gap: 32px; align-items: flex-start; margin-bottom: 12px;">
        <div style="flex:1; min-width:220px;">
            <div class="section-title">פרטי העסק</div>
            איתי חרוש<br>
            Itay Solutions<br>
            עוסק זעיר<br>
            מספר עוסק: 305300808<br>
            טלפון:<a href="tel:0547466508"> 054-7466508</a><br>
            אימייל: <a href="mailto:itayyharoush@gmail.com">itayyharoush@gmail.com</a><br>
            אתר: <a href="https://itaysolutions.com">itaysolutions.com</a>
        </div>
        <div style="flex:1; min-width:220px;">
            <div class="section-title">פרטי לקוח</div>
            לכבוד: {{ $customer_name ?? '-' }}<br>
        </div>
    </div>
    <div class="section-title">פרטי שירות</div>
    <table>
        <tr>
            <th>תיאור שירות</th>
            <th>כמות</th>
            <th>מחיר ליחידה</th>
            <th>סה"כ</th>
        </tr>
        @foreach($items as $item)
        <tr>
            <td>{{ $item['description'] }}</td>
            <td>{{ $item['quantity'] }}</td>
            <td>₪{{ number_format($item['unit_price'], 2) }}</td>
            <td>₪{{ number_format($item['quantity'] * $item['unit_price'], 2) }}</td>
        </tr>
        @endforeach
    </table>
    <div class="summary">
        @if($toPay)
        סה"כ לתשלום: ₪{{ number_format($total, 2) }}
        <div style="font-size:13px; color:#888; font-weight:normal; margin-top:2px;">(עוסק פטור - לא כולל מע"מ)</div>
        @else
        שולם: ₪{{ number_format($total, 2) }} (כולל מע"מ)
        <div style="font-size:13px; color:#888; font-weight:normal; margin-top:2px;">(כולל מע"מ)</div>
        @endif
    </div>
    <div class="footer">
        תודה שבחרתם <a href="https://itaysolutions.com">Itay Solutions</a><br>
    </div>
</body>

</html>
</body>

</html>