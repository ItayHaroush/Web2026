# תכנית בדיקות Z-Credit (דמה מול PinPad)

תיעוד זה משלים את הקוד ב־`backend/app/Services/ZCreditService.php`.  
תיעוד API רשמי: [Z-Credit Gateway API (Apiary)](https://zcreditws.docs.apiary.io/)

## עקרונות: לא לשבור לוגיקה / מעבר למסופון אמיתי

- זרימת ברירת המחדל: `chargePinPad` → `CommitFullTransaction` עם `Track2` = `PINPAD` + מזהה — **אין לשנות** ללא תיעוד Z-Credit.
- מעבר דמה → אמיתי: בעיקר עדכון **`.env`** (`ZCREDIT_*`), בלי שינוי קוד.
- הרחבות עתידיות (כרטיס בדיקה וכו'): מתודה נפרדת או `ZCREDIT_TEST_MODE` — לא מחליפים את `chargePinPad`.

### איפה מגדירים בממשק (TakeEat)

- **הגדרות תשלום** — נתיב האדמין: `/admin/payment-settings` (כולל Z-Credit למסעדה, רשימת מסופונים, וברירת מחדל).
- **קיוסק** — בחירת מסוף בניהול קיוסקים (כשיש מסופונים ברשימה).
- **קופה (POS Lite)** — בחירת מסוף בכניסה עם PIN (כשיש מסופונים).

### סדר עדיפות: מאיזה מסוף משתמשים בחיוב

בקוד (`ZCreditResolver` ומקבילים):

1. הזמנה מקיוסק עם `payment_terminal_id` על הקיוסק → רשומה ב־`payment_terminals`.
2. סשן קופה עם `payment_terminal_id` (נבחר ב־`verify-pin`) → אותו מסוף.
3. מסעדה עם `default_payment_terminal_id` → ברירת מחדל.
4. שדות על `restaurants` (`zcredit_terminal_number` וכו') — **בלי** נפילה ל־`.env` לחיובי POS/קיוסק.

**מצב Mock (`ZCREDIT_MOCK=true` ב־`.env`):** חיוב/החזר מדומים בלי HTTP — מתאים עד חיבור מסופון אמיתי במסעדה. בייצור: `ZCREDIT_MOCK=false` והגדרת מסופון ב־`/admin/payment-settings`.  
החזר POS (`POST .../orders/{id}/refund`) קורא ל־`refundTransaction` — במוק נרשם אישור מדומה; מזהה עסקה מסוג `MOCK_*` מזוהה גם בלי דגל המוק.

משתני `ZCREDIT_TERMINAL_*` ב־`.env` נשארים אופציונליים לכלים (`php artisan zcredit:verify-config`) / route בדיקה מקומית בלבד.

---

## nginx מחזיר מסך 404 עם `<html>…nginx/1.x` (לא Laravel)

זה אומר שהבקשה **לא מגיעה ל־`public/index.php`** — בדרך כלל `root` / `location` ב־nginx לא מצביעים על תיקיית `backend/public` של הפרויקט, או ש־`http://localhost` משרת את ה־default site (למשל `/var/www/html`) ולא את האפליקציה.

**בדיקה מהירה:**

```bash
# אם יש דומיין שמוגדר ב־server_name — השתמש בו
curl -sS -o /dev/null -w "%{http_code}\n" https://YOUR_DOMAIN/api/up

# או מול PHP ישירות (עוקף nginx)
cd /var/www/Web2026/chefsync-restaurant/backend && php artisan serve --host=127.0.0.1 --port=8000
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/api/up
```

אם `artisan serve` מחזיר 200 ל־`/api/up` אבל nginx ל־localhost לא — צריך לתקן vhost (למשל `root` ל־`.../chefsync-restaurant/backend/public` ו־`try_files $uri $uri/ /index.php?$query_string`).

**שגיאה נפוצה:** להריץ `/api/zcredit/test-pinpad-charge` בטרמינל — זה לא פקודה. צריך `curl -X POST ...` מלא.

---

## נתיבי API בפרויקט (לא קיים `/api/pos/charge`)

| שימוש | Method | נתיב |
|--------|--------|------|
| חיוב הזמנה קיימת דרך PinPad (מוגן: `auth:sanctum` + POS session) | `POST` | `/api/admin/pos/orders/{id}/charge-credit` |
| חיוב PinPad אחרי הזמנת קיוסק (טוקן קיוסק) | `POST` | `/api/kiosk/{token}/orders/{id}/charge-pinpad` |
| גוף הבקשה | — | הבקר משתמש ב־**`total_amount` של ההזמנה** בבסיס הנתונים, לא בשדה `amount` ב־JSON (אם שלחת — זה לא משנה את הסכום). |

**בדיקה עם curl (דורש Bearer + `X-Tenant-ID` + סשן POS לפי ההגדרות אצלכם):**

```bash
curl -X POST "http://localhost/api/admin/pos/orders/206/charge-credit" \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant-ID: <tenant>" \
  -H "X-POS-Session: <pos_token_if_required>"
```

## בדיקת PinPad בלי auth (`POST /api/zcredit/test-pinpad-charge`)

נרשם כש־`APP_ENV=local` **או** כשב־`.env` מוגדר `ZCREDIT_ALLOW_TEST_ROUTE=true` (זמני בשרת — **חשוף**, ללא auth).

```bash
curl -X POST "https://YOUR_DOMAIN/api/zcredit/test-pinpad-charge" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10}'
```

בפרודקשן השאר רק `false` או הסר את השורה.

---

## שלב 0: צ'ק־ליסט לפני ניסיון

| פריט | הערה |
|------|------|
| `ZCREDIT_TERMINAL_NUMBER` / `ZCREDIT_TERMINAL_PASSWORD` | תואמים לחשבון שקיבלת מ־Z-Credit |
| `ZCREDIT_PINPAD_ID` | המזהה המדויק של המסופון; בקוד יפוך ל־`PINPAD{מזהה}` |
| PinPad פיזי | מחובר ומוגדר אצל Z-Credit |
| Timeout בפרונט | `posApi.createOrderCredit` — 90 שניות |

**אימות מהיר מהטרמינל (ללא חיוב):**

```bash
cd backend && php artisan zcredit:verify-config
```

---

## שלב 1: בדיקת API בלי PinPad (אופציונלי)

**מטרה:** לוודא מסוף/סיסמה/רשת — עם **כרטיסי בדיקה** מהמסמך של Z-Credit (לא דרך זרימת ה־POS הנוכחית).

האפליקציה שולחת כרגע רק `CommitFullTransaction` עם `Track2` ל־PinPad. בדיקת כרטיס מלאה = **Postman / curl** לפי Apiary.

### דוגמה: שלד JSON (השלם שדות לפי המסמך שלך)

`POST https://pci.zcredit.co.il/ZCreditWS/api/Transaction/CommitFullTransaction`  
`Content-Type: application/json`

```json
{
  "TerminalNumber": "<מספר מסוף>",
  "Password": "<סיסמה>",
  "TransactionSum": 100,
  "CreditType": 1,
  "NumOfPayments": 1,
  "Currency": "ILS",
  "CardNumber": "<כרטיס בדיקה>",
  "ExpDate_MMYY": "<תוקף>"
}
```

**ללא** PinPad — אל תשלח `Track2` עם `PINPAD...` באותה בדיקה אם המטרה היא כרטיס ידני.

השווה `HasError`, `ReturnCode`, `ReturnMessage` לתיעוד.

---

## שלב 2: בדיקת PinPad דרך ChefSync (POS)

1. Backend עם `.env` מתוקן.
2. POS → תשלום אשראי → «חייב באשראי».
3. **בזמן הספין** — השלם פעולה ב־PinPad (הכנסה / מגע / קוד).
4. ראה תשובה ב־`storage/logs/laravel.log` (חיפוש `[ZCredit]`).

**פרשנות:**

- שגיאה **מיידית** לפני מגע במכשיר → config / Track2 / חוסר מכשיר.
- סירוב **אחרי** פעולה במכשיר → כרטיס / סכום / הגדרות מסוף.

---

## שלב 3: מטריצת תרחישים

| # | תרחיש | צפי |
|---|--------|-----|
| 3.1 | `ZCREDIT_PINPAD_ID` שגוי | שגיאה מהירה מה־API |
| 3.2 | מזהה נכון, מכשיר כבוי | timeout / שגיאה לפי Z-Credit |
| 3.3 | מכשיר פעיל + כרטיס בדיקה | JSON מפורש (אישור או דחייה) |
| 3.4 | אותו `TransactionUniqueID` פעמיים | התנהגות כפילות (אם רלוונטי בתיעוד) |

---

## שלב 4: תיעוד לניתוח (בלי סיסמאות)

מלא אחרי כל ניסיון:

### בקשה (ללא רגישים)

| שדה | ערך |
|-----|-----|
| TerminalNumber | (רק ספרות/מסכה) |
| TransactionSum (אגורות) | |
| Track2 | `PINPAD...` |
| Currency | ILS |
| TransactionUniqueID | אם נשלח |

### תשובה

הדבק JSON מלא מה־API (הסר/מסך `Password` אם הופיע).

### תזמון

- [ ] השגיאה **לפני** מגע ב־PinPad  
- [ ] השגיאה **אחרי** מגע ב־PinPad  

**מקור אמת:** תמיד תשובת ה־API, לא רק תצוגת המסופון.
