<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="utf-8">
    <title>מעבר לתשלום מאובטח</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f5f5f5;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .card {
            background: #ffffff;
            padding: 24px 28px;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            max-width: 420px;
            width: 100%;
            text-align: center;
        }
        h1 {
            font-size: 20px;
            margin-bottom: 12px;
        }
        p {
            font-size: 14px;
            color: #555;
            margin: 4px 0;
        }
        .spinner {
            margin: 20px auto;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 3px solid #f3f3f3;
            border-top-color: #f97316;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .button {
            display: inline-block;
            margin-top: 16px;
            padding: 10px 24px;
            border-radius: 999px;
            border: none;
            background: #f97316;
            color: #fff;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>מעביר אותך לתשלום מאובטח</h1>
        <p>אנא המתן מספר שניות...</p>
        <div class="spinner"></div>
        <p>אם אינך מועבר אוטומטית:</p>
        <a class="button" href="{{ $paymentUrl }}">המשך לתשלום</a>
    </div>

    <script>
        setTimeout(function () {
            window.location.href = @json($paymentUrl);
        }, 600);
    </script>
</body>
</html>
