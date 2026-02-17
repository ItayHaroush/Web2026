<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="utf-8">
    <title>שגיאה בתשלום</title>
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
            color: #b91c1c;
        }
        p {
            font-size: 14px;
            color: #555;
            margin: 4px 0;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>לא הצלחנו להתחבר למסוף התשלום</h1>
        <p>{{ $message ?? 'אירעה שגיאה בעת ניסיון התחברות לעמוד התשלום.' }}</p>
        <p>אם הבעיה נמשכת, נסה לרענן את העמוד או לחזור לסל הקניות.</p>
    </div>
</body>
</html>

