# תוכנית: החלפת EZcount מ-HYP ל-API ישיר

## מצב קיים
כרגע החשבוניות עוברות דרך HYP (פרמטר `SendHesh=True`) → HYP שולח ל-EZcount בשם המסעדה.
הבעיה: תלות ב-HYP, אין שליטה מלאה, `HeshASM` לא חוזר ב-callback.

## מצב חדש
אחרי תשלום מוצלח ב-HYP → קריאה ישירה ל-`EZcount createDoc API` עם `api_key` של המסעדה.

---

## שינויים נדרשים

### 1. Migration: הוספת שדות EZcount למסעדה + pdf_url להזמנה
**קובץ חדש:** `backend/database/migrations/..._add_ezcount_credentials_to_restaurants.php`

על `restaurants`:
- `ezcount_api_key` (string, nullable, encrypted) — מפתח API של EZcount
- `ezcount_api_email` (string, nullable) — אימייל חשבון EZcount

על `orders`:
- `invoice_pdf_url` (string, nullable) — לינק ל-PDF חשבונית

### 2. Restaurant Model: הוספת שדות חדשים
**קובץ:** `backend/app/Models/Restaurant.php`
- הוספה ל-`$fillable`: `ezcount_api_key`, `ezcount_api_email`
- הוספה ל-`$hidden`: `ezcount_api_key`
- הוספה ל-`$casts`: `ezcount_api_key` → `encrypted`

### 3. Order Model: הוספת שדה PDF
**קובץ:** `backend/app/Models/Order.php`
- הוספה ל-`$fillable`: `invoice_pdf_url`

### 4. שירות EZcount חדש
**קובץ חדש:** `backend/app/Services/EZcountService.php`
- מתודה `createInvoice(Restaurant, Order, transactionId)`:
  - `POST` ל-`https://api.ezcount.co.il/api/createDoc` (או demo URL)
  - שולח `api_key`, `api_email`, `type: 320` (חשבונית קבלה)
  - פירוט פריטים (`item[]`), תשלום (`payment[]`), `price_total`
  - מחזיר `doc_number`, `pdf_link`

### 5. HypOrderRedirectController: הסרת SendHesh
**קובץ:** `backend/app/Http/Controllers/HypOrderRedirectController.php`
- **הסרת** כל הבלוק של `if ($restaurant->ezcount_invoices_enabled)` שמוסיף `SendHesh`, `Pritim`, `heshDesc`
- **הסרת** `buildInvoiceItems()` ו-`calcInvoiceItemsTotal()`
- החשבונית תיווצר ב-callback, לא ב-redirect

### 6. HypOrderCallbackController: קריאה ל-EZcount ישירות
**קובץ:** `backend/app/Http/Controllers/HypOrderCallbackController.php`
- **הסרת** הבלוק של `fetchInvoiceNumber` (שורות 242-261) — כבר לא רלוונטי
- **הוספת** קריאה ל-`EZcountService::createInvoice()` אחרי תשלום מלא מוצלח
- שמירת `invoice_number` + `invoice_pdf_url` + `invoice_generated_at` על ההזמנה

### 7. RestaurantPaymentService: ניקוי
**קובץ:** `backend/app/Services/RestaurantPaymentService.php`
- **הסרת** `getInvoiceUrl()` (PrintHesh) — כבר לא נחוץ, עוברים ל-EZcount ישיר
- **הסרת** `fetchInvoiceNumber()` — כנ"ל

### 8. PaymentSettingsController: שמירת credentials
**קובץ:** `backend/app/Http/Controllers/PaymentSettingsController.php`  
- `getSettings()`: הוספת `has_ezcount_api_key`, `ezcount_api_email`
- `saveSettings()`: ולידציה + שמירת `ezcount_api_key`, `ezcount_api_email`

### 9. Frontend: AdminPaymentSettings
**קובץ:** `frontend/src/pages/admin/AdminPaymentSettings.jsx`
- הוספת שדות input: `ezcount_api_key`, `ezcount_api_email`
- הצגה רק כש-toggle מופעל
- הסרת ההודעה "ודא שחשבון EZcount מחובר ל-HYP" (כבר לא רלוונטי)

### 10. Frontend: OrderStatusPage — הצגת PDF link
**קובץ:** `frontend/src/pages/OrderStatusPage.jsx`
- אם `invoice_pdf_url` קיים → לינק ישיר ל-PDF
