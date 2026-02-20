<!DOCTYPE html>
<html dir="rtl" lang="he">

<head>
    <meta charset="UTF-8">
    <title>תצוגה מקדימה — חשבונית Itay Solutions</title>
    <style>
        * { box-sizing: border-box; }
        body { direction: rtl; font-family: Arial, sans-serif; color: #222; padding: 24px; margin: 0; background: #f9fafb; }
        .actions-wrap { position: sticky; top: 0; background: #fff; padding: 16px 0; margin-bottom: 20px; z-index: 9999; box-shadow: 0 1px 3px #0001; border-radius: 12px; }
        .actions-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .btn { border: none; padding: 10px 20px; border-radius: 12px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
        .btn-download { background: #059669; color: #fff; }
        .btn-download:hover { background: #047857; }
        .btn-print { background: #7c3aed; color: #fff; }
        .btn-print:hover { background: #6d28d9; }
        .btn-email { background: #2563eb; color: #fff; }
        .btn-email:hover { background: #1d4ed8; }
        .btn-send { background: #0f766e; color: #fff; }
        .btn-send:hover { background: #0d5c56; }
        .invoice-paper { background: #fff; padding: 28px; border-radius: 12px; box-shadow: 0 1px 3px #0001; max-width: 800px; margin: 0 auto; }
        .email-form { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
        .email-form input { flex: 1; min-width: 200px; padding: 10px 14px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 14px; }
        .msg { padding: 10px 14px; border-radius: 10px; margin-bottom: 12px; font-size: 14px; }
        .msg.success { background: #d1fae5; color: #166534; }
        .msg.error { background: #fee2e2; color: #991b1b; }
        @media print {
            body { padding: 0; background: #fff; }
            .actions-wrap { display: none !important; }
        }
    </style>
</head>

<body>
    <div class="actions-wrap">
        @if(session('success'))
        <div class="msg success">{{ session('success') }}</div>
        @endif
        @if(session('error'))
        <div class="msg error">{{ session('error') }}</div>
        @endif

        <form method="POST" action="{{ route('custom-invoice.send-email') }}" class="email-form">
            @csrf
            <input type="hidden" name="invoice_token" value="{{ $invoiceToken ?? '' }}">
            <input type="hidden" name="customer_name" value="{{ $customer_name ?? '' }}">
            <input type="hidden" name="customer_email" value="{{ $customer_email ?? '' }}">
            <input type="hidden" name="to_pay" value="{{ isset($toPay) && $toPay ? '1' : '0' }}">
            @foreach($items as $idx => $item)
            <input type="hidden" name="items[{{ $idx }}][description]" value="{{ $item['description'] ?? '' }}">
            <input type="hidden" name="items[{{ $idx }}][quantity]" value="{{ $item['quantity'] ?? 1 }}">
            <input type="hidden" name="items[{{ $idx }}][unit_price]" value="{{ $item['unit_price'] ?? 0 }}">
            @endforeach
            <input type="email" name="email" placeholder="אימייל נמען (ריק = פרטי הלקוח)" value="{{ $customer_email ?? '' }}" dir="ltr">
            <button type="submit" class="btn btn-send">שלח במייל</button>
        </form>

        <div class="actions-row">
            <form method="POST" action="{{ route('custom-invoice.download') }}" style="margin: 0; display: inline;">
                @csrf
                <input type="hidden" name="invoice_token" value="{{ $invoiceToken ?? '' }}">
                <input type="hidden" name="customer_name" value="{{ $customer_name ?? '' }}">
                <input type="hidden" name="customer_id" value="{{ $customer_id ?? '' }}">
                <input type="hidden" name="customer_email" value="{{ $customer_email ?? '' }}">
                <input type="hidden" name="payment_method" value="{{ $payment_method ?? 'credit' }}">
                <input type="hidden" name="contact" value="{{ $contact ?? '' }}">
                <input type="hidden" name="to_pay" value="{{ isset($toPay) && $toPay ? '1' : '0' }}">
                @foreach($items as $idx => $item)
                <input type="hidden" name="items[{{ $idx }}][description]" value="{{ $item['description'] ?? '' }}">
                <input type="hidden" name="items[{{ $idx }}][quantity]" value="{{ $item['quantity'] ?? 1 }}">
                <input type="hidden" name="items[{{ $idx }}][unit_price]" value="{{ $item['unit_price'] ?? 0 }}">
                @endforeach
                <button type="submit" class="btn btn-download">הורד PDF</button>
            </form>
            <button type="button" onclick="window.print()" class="btn btn-print">הדפס</button>
            <a href="{{ route('custom-invoice.new') }}" class="btn" style="background:#6b7280; color:#fff; text-decoration:none;">צור חשבונית חדשה</a>
        </div>
    </div>

    <div class="invoice-paper">
        @include('invoices.itay_invoice_content', get_defined_vars())
    </div>
</body>

</html>