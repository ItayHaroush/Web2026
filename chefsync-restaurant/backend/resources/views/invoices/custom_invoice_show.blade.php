<!DOCTYPE html>
<html dir="rtl" lang="he">

<head>
    <meta charset="UTF-8">
    <title>חשבונית Itay Solutions</title>
    <style>
        .action-bar {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            position: sticky;
            top: 0;
            left: 0;
            width: 100%;
            background: #fff;
            box-shadow: 0 2px 12px #0002;
            padding: 12px 8px;
            z-index: 9999;
            margin-bottom: 18px;
        }

        @media (max-width: 600px) {
            .action-bar {
                flex-direction: column;
                gap: 0;
            }

            .btn-primary {
                width: 100%;
                margin-right: 0;
                margin-bottom: 8px;
            }
        }

        body {
            padding-top: 70px;
        }

        body {
            direction: rtl;
            font-family: Arial, sans-serif;
            color: #222;
            padding: 30px;
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #22c55e;
            margin-bottom: 20px;
        }

        .logo {
            height: 50px;
        }

        .btn-primary {
            background: #22c55e;
            color: #fff;
            border: none;
            padding: 10px 24px;
            border-radius: 6px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 8px;
            margin-right: 0;
            display: inline-block;
            transition: background 0.2s;
        }

        .btn-primary.print {
            background: #7c3aed;
        }

        .btn-primary:hover {
            background: #16a34a;
        }

        .btn-primary.print:hover {
            background: #4c1d95;
        }

        .action-bar {
            display: flex;
            gap: 12px;
            margin-bottom: 18px;
            flex-wrap: wrap;
        }

        @media (max-width: 600px) {
            .action-bar {
                flex-direction: column;
                gap: 0;
            }

            .btn-primary {
                width: 100%;
                margin-right: 0;
                margin-bottom: 8px;
            }
        }

        .info-value {
            font-weight: bold;
            font-size: 15px;
        }

        .amount {
            font-size: 28px;
            color: #22c55e;
            font-weight: bold;
            margin: 20px 0 10px;
        }

        .desc {
            font-size: 16px;
            margin-bottom: 10px;
        }

        .row {
            margin-bottom: 8px;
        }

        .footer {
            margin-top: 40px;
            color: #666;
            font-size: 13px;
        }

        .box {
            background: #f9fafb;
            border-radius: 7px;
            padding: 18px 20px;
            margin-bottom: 18px;
        }
    </style>
</head>

<body>
    <div class="header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px;">
        <div style="display: flex; align-items: center; gap: 12px;">
            <form method="POST" action="{{ route('custom-invoice.download') }}" style="margin-bottom: 0;">
                @csrf
                <input type="hidden" name="customer_name" value="{{ $customer_name }}">
                <input type="hidden" name="customer_id" value="{{ $customer_id }}">
                <input type="hidden" name="customer_email" value="{{ $customer_email }}">
                <input type="hidden" name="payment_method" value="{{ $payment_method }}">
                <input type="hidden" name="contact" value="{{ $contact }}">
                <input type="hidden" name="to_pay" value="{{ $toPay ? '1' : '0' }}">
                @foreach($items as $idx => $item)
                <input type="hidden" name="items[{{ $idx }}][description]" value="{{ $item['description'] }}">
                <input type="hidden" name="items[{{ $idx }}][quantity]" value="{{ $item['quantity'] }}">
                <input type="hidden" name="items[{{ $idx }}][unit_price]" value="{{ $item['unit_price'] }}">
                @endforeach
                <button type="submit" class="btn-primary" style="background:#22c55e; color:#fff; font-size:15px; padding:8px 18px; border-radius:6px; margin-right:8px;">הורד PDF</button>
            </form>
            <button type="button" onclick="window.print()" class="btn-primary print" style="background:#7c3aed; color:#fff; font-size:15px; padding:8px 18px; border-radius:6px; margin-right:8px;">הדפס</button>
        </div>
        <div>

            {{-- הצגת המסמך מתחת לכפתורים --}}
            @include('invoices.itay_invoice', get_defined_vars())


        </div>
</body>

</html>