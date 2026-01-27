# TakeEat Backend - Laravel API

Backend API לאפליקציית הזמנות למסעדות בעמדה רבת-ערים (Multi-Tenant).

## דרישות

- PHP 8.2+
- Laravel 11+
- MySQL 8.0+
- Composer

## התקנה

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

## ארכיטקטורה

### Multi-Tenant
כל מסעדה = Tenant שונה
- Tenant ID בכל טבלה
- Middleware אוטומטי לבדיקת הרשאה
- נתונים מופרדים לוגית

### נקודות API (Endpoints)

```
GET    /api/menu                    # קבל תפריט (לפי Tenant)
POST   /api/orders                  # צור הזמנה חדשה
GET    /api/orders/{id}             # קבל פרטי הזמנה
PATCH  /api/orders/{id}/status      # עדכן סטטוס הזמנה

# ממשק מנהל (דורש אימות)
GET    /api/restaurant              # הגדרות המסעדה
PATCH  /api/restaurant              # עדכן הגדרות
PATCH  /api/menu-items/{id}         # עדכן זמינות פריט
```

### דגמים (Models)

- **Restaurant** - מסעדה (Tenant)
- **Category** - קטגוריות תפריט
- **MenuItem** - פריטי תפריט עם מחיר וזמינות
- **Order** - הזמנה (received → preparing → ready → delivered)
- **OrderItem** - פריטים בהזמנה
- **User** - מנהל מסעדה (אם צריך אימות)

### סטטוסי הזמנה

1. `received` - התקבלה
2. `preparing` - בהכנה
3. `ready` - מוכנה
4. `delivered` - נמסרה

## הגדרות Multi-Tenant

כל בקשה API חייבת להכיל:
- Header `X-Tenant-ID` או
- URL Parameter `tenant_id`

דוגמה:
```bash
curl -H "X-Tenant-ID: restaurant-1" http://localhost:8000/api/menu
```

---
בנוי עם ❤️ להזמנות קלות למסעדה.
