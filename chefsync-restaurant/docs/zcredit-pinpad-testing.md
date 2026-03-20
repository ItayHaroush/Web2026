# תכנית בדיקות Z-Credit (דמה מול PinPad)

תיעוד זה משלים את הקוד ב־`backend/app/Services/ZCreditService.php`.  
תיעוד API רשמי: [Z-Credit Gateway API (Apiary)](https://zcreditws.docs.apiary.io/)

## עקרונות: לא לשבור לוגיקה / מעבר למסופון אמיתי

- זרימת ברירת המחדל: `chargePinPad` → `CommitFullTransaction` עם `Track2` = `PINPAD` + מזהה — **אין לשנות** ללא תיעוד Z-Credit.
- מעבר דמה → אמיתי: בעיקר עדכון **`.env`** (`ZCREDIT_*`), בלי שינוי קוד.
- הרחבות עתידיות (כרטיס בדיקה וכו'): מתודה נפרדת או `ZCREDIT_TEST_MODE` — לא מחליפים את `chargePinPad`.

---

## נתיבי API בפרויקט (לא קיים `/api/pos/charge`)

| שימוש | Method | נתיב |
|--------|--------|------|
| חיוב הזמנה קיימת דרך PinPad (מוגן: `auth:sanctum` + POS session) | `POST` | `/api/admin/pos/orders/{id}/charge-credit` |
| גוף הבקשה | — | הבקר משתמש ב־**`total_amount` של ההזמנה** בבסיס הנתונים, לא בשדה `amount` ב־JSON (אם שלחת — זה לא משנה את הסכום). |

**בדיקה עם curl (דורש Bearer + `X-Tenant-ID` + סשן POS לפי ההגדרות אצלכם):**

```bash
curl -X POST "http://localhost/api/admin/pos/orders/206/charge-credit" \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant-ID: <tenant>" \
  -H "X-POS-Session: <pos_token_if_required>"
```

## בדיקת PinPad בלי auth (רק `APP_ENV=local`)

נרשם ב־`routes/api.php` נתיב:

`POST /api/zcredit/test-pinpad-charge`

```bash
curl -X POST "http://localhost/api/zcredit/test-pinpad-charge" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10}'
```

בפרודקשן / בשרת staging הנתיב **לא** קיים — בכוונה.

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
