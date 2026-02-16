<!DOCTYPE html>
<html dir="rtl" lang="he">

<head>
    <meta charset="UTF-8">
    <link rel="shortcut icon" href="/images/1.png" type="image/png">
    <title>הפק חשבונית מותאמת ל-Itay Solutions</title>
    <style>
        body {
            direction: rtl;
            font-family: Arial, sans-serif;
            color: #222;
            padding: 30px;
            background: #f9fafb;
        }

        .container {
            max-width: 420px;
            margin: 40px auto;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 2px 12px #0001;
            padding: 32px 28px;
        }

        h2 {
            color: #22c55e;
            font-size: 22px;
            margin-bottom: 18px;
            text-align: center;
        }

        .form-group {
            margin-bottom: 16px;
        }

        label {
            font-size: 13px;
            color: #444;
            font-weight: bold;
            display: block;
            margin-bottom: 4px;
        }

        input[type="text"],
        input[type="number"],
        input[type="file"] {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 15px;
        }

        .btn-primary {
            background: #22c55e;
            color: #fff;
            border: none;
            padding: 10px 0;
            width: 100%;
            border-radius: 6px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 10px;
        }

        .btn-primary:hover {
            background: #16a34a;
        }
    </style>
</head>

<body>
    <div class="container">
        <h2>הפק חשבונית מותאמת ל-Itay Solutions</h2>
        <form method="POST" action="{{ route('custom-invoice.generate') }}" enctype="multipart/form-data">
            @csrf
            <div class="form-group" style="text-align:center;">
                <label style="display:block; margin-bottom:6px;">לוגו שיופיע בחשבונית:</label>
                <img id="logo-preview" src="/images/itay-logo.png" alt="לוגו קבוע" style="height:60px; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto; border-radius:8px; box-shadow:0 1px 6px #0001;">
                <input type="file" name="logo" class="form-control" accept="image/*" onchange="previewLogo(event)">
                <div style="font-size:12px; color:#888; margin-top:2px;">ניתן להעלות לוגו אחר זמנית לחשבונית זו בלבד</div>
            </div>
            <script>
                function previewLogo(event) {
                    const [file] = event.target.files;
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = e => {
                            document.getElementById('logo-preview').src = e.target.result;
                        };
                        reader.readAsDataURL(file);
                    } else {
                        document.getElementById('logo-preview').src = '/images/itay-logo.png';
                    }
                }
            </script>
            <div class="form-group">
                <label>פריטים בחשבונית:</label>
                <table id="items-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#f3f4f6;">
                            <th style="border:1px solid #eee; padding:6px;">תיאור</th>
                            <th style="border:1px solid #eee; padding:6px;">כמות</th>
                            <th style="border:1px solid #eee; padding:6px;">מחיר ליחידה</th>
                            <th style="border:1px solid #eee; padding:6px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><input type="text" name="items[0][description]" class="form-control" required></td>
                            <td><input type="number" name="items[0][quantity]" class="form-control" value="1" min="1" required></td>
                            <td><input type="number" name="items[0][unit_price]" class="form-control" step="0.01" min="0" required></td>
                            <td><button type="button" class="remove-row" onclick="removeRow(this)">✖</button></td>
                        </tr>
                    </tbody>
                </table>
                <button type="button" class="btn-primary" style="background:#7c3aed; margin-top:8px;" onclick="addRow()">הוסף פריט</button>
            </div>
            <div class="custumer-info" style="margin-top:18px; padding-top:18px; border-top:1px solid #eee;">
                <div class="form-group">
                    <label>שם הלקוח:</label>
                    <input type="text" name="customer_name" class="form-control" required>
                </div>
                <div class=" form-group">
                    <label>אמצעי תשלום:</label>
                    <select name="payment_method" class="form-control" required>
                        <option value="cash">מזומן</option>
                        <option value="credit">אשראי</option>
                    </select>
                </div>
                <div class="toPay form-group">
                    <label style="margin-left: 18px;">
                        <input type="radio" name="to_pay" value="1" required> לתשלום
                    </label>
                    <label>
                        <input type="radio" name="to_pay" value="0"> שולם
                    </label>
                    <div class=" form-group">
                        <input type="hidden" name="contact" value="Itay Solutions | 050-1234567 | info@itaysolutions.co.il">
                    </div>
                    <button type="submit" class="btn-primary">הפק חשבונית</button>
                    <script>
                        let rowIdx = 1;

                        function addRow() {
                            const table = document.getElementById('items-table').getElementsByTagName('tbody')[0];
                            const row = table.insertRow();
                            row.innerHTML = `
                        <td><input type="text" name="items[${rowIdx}][description]" class="form-control" required></td>
                        <td><input type="number" name="items[${rowIdx}][quantity]" class="form-control" value="1" min="1" required></td>
                        <td><input type="number" name="items[${rowIdx}][unit_price]" class="form-control" step="0.01" min="0" required></td>
                        <td><button type="button" class="remove-row" onclick="removeRow(this)">✖</button></td>
                    `;
                            rowIdx++;
                        }

                        function removeRow(btn) {
                            const row = btn.closest('tr');
                            const table = document.getElementById('items-table').getElementsByTagName('tbody')[0];
                            if (table.rows.length > 1) row.remove();
                        }
                    </script>
        </form>
    </div>
</body>

</html>