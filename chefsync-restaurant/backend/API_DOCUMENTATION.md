# API Documentation - ChefSync

API ללא סליקה לניהול הזמנות למסעדות במערכת Multi-Tenant.

---

## תצורת בסיסית

**Base URL:** `http://localhost:8000/api`

**Authentication:** Token (JWT/Sanctum) דרוש רק לממשק מנהל

**Multi-Tenant:** כל בקשה חייבת להכיל `X-Tenant-ID` Header

---

## דוגמאות שימוש עם cURL

### 1. קבלת התפריט

```bash
curl -H "X-Tenant-ID: pizza-palace" \
  http://localhost:8000/api/menu
```

**תגובה (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "פיצה",
      "description": "פיצות בטעמים שונים",
      "items": [
        {
          "id": 1,
          "name": "פיצה מרגריטה",
          "description": "...",
          "price": "45.00",
          "is_available": true
        }
      ]
    }
  ]
}
```

---

### 2. צור הזמנה

```bash
curl -X POST -H "X-Tenant-ID: pizza-palace" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "דוד כהן",
    "customer_phone": "050-1234567",
    "items": [
      {"menu_item_id": 1, "quantity": 2},
      {"menu_item_id": 5, "quantity": 1}
    ]
  }' \
  http://localhost:8000/api/orders
```

**תגובה (201):**
```json
{
  "success": true,
  "message": "הזמנה נקבלה בהצלחה",
  "data": {
    "id": 42,
    "customer_name": "דוד כהן",
    "customer_phone": "050-1234567",
    "status": "received",
    "total_amount": "102.00",
    "created_at": "2026-01-03T10:30:00Z",
    "items": [
      {
        "id": 1,
        "quantity": 2,
        "price_at_order": "45.00",
        "menuItem": {...}
      }
    ]
  }
}
```

---

### 3. קבל סטטוס הזמנה

```bash
curl -H "X-Tenant-ID: pizza-palace" \
  http://localhost:8000/api/orders/42
```

---

### 4. עדכן סטטוס הזמנה (מנהל בלבד)

```bash
curl -X PATCH \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Tenant-ID: pizza-palace" \
  -H "Content-Type: application/json" \
  -d '{"status": "preparing"}' \
  http://localhost:8000/api/orders/42/status
```

**סטטוסים אפשריים:**
- `received` - התקבלה
- `preparing` - בהכנה
- `ready` - מוכנה
- `delivered` - נמסרה

---

### 5. קבל הזמנות פעילות (מנהל)

```bash
curl -H "Authorization: Bearer TOKEN" \
  -H "X-Tenant-ID: pizza-palace" \
  http://localhost:8000/api/restaurant/orders?status=preparing
```

---

### 6. עדכן זמינות פריט תפריט (מנהל)

```bash
curl -X PATCH \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Tenant-ID: pizza-palace" \
  -H "Content-Type: application/json" \
  -d '{"is_available": false}' \
  http://localhost:8000/api/menu-items/1
```

---

## Tenant IDs לדוגמה

```
pizza-palace    # פיצה
burger-central  # המבורגרים
```

---

## Validation Errors

```json
{
  "success": false,
  "message": "שגיאה בתקינות הנתונים",
  "errors": {
    "customer_name": ["שדה זה חובה"],
    "items": ["לפחות פריט אחד דרוש"]
  }
}
```

---

## Multi-Tenant Implementation

כל Tenant מקבל:
- Tenant ID ייחודי
- הנתונים שלו בטבלאות (עם `tenant_id`)
- שום גישה לנתוני Tenants אחרים

Global Scope ב-Models דואגת לזה אוטומטית.
