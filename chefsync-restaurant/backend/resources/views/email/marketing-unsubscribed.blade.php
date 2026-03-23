<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ביטול הרשמה</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 40px 16px; text-align: center; }
        .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.06); }
        h1 { color: #111827; font-size: 1.25rem; margin: 0 0 12px; }
        p { color: #6b7280; font-size: 0.95rem; line-height: 1.6; margin: 0; }
        .email { color: #f97316; font-weight: bold; word-break: break-all; }
    </style>
</head>
<body>
    <div class="card">
        <h1>הוסרת בהצלחה מרשימת התפוצה</h1>
        <p>לא נשלחו עוד מיילים שיווקיים לכתובת <span class="email">{{ $email }}</span>.</p>
        <p style="margin-top: 16px; font-size: 0.85rem;">הודעות טרנזקציוניות (חשבוניות, אימות וכו׳) עלולות להישלח כרגיל לפי מדיניות המערכת.</p>
    </div>
</body>
</html>
