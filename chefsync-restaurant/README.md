# TakeEat - אפליקציית הזמנות למסעדות

PWA מודרנית להזמנות למסעדה בעמדה רבת-ערים (Multi-Tenant)

---

## 🎯 מטרה

בניית מערכת הזמנות קלה וממשק מנהל למסעדות, עם:
- ✅ ממשק לקוח (תפריט, סל, סטטוס)
- ✅ ממשק מנהל (הזמנות, ניהול תפריט)
- ✅ תמיכה Multi-Tenant (כל מסעדה = Tenant)
- ✅ RTL מלא (עברית)
- ✅ PWA (עובד ללא אינטרנט)
- ✅ ללא סליקה - שם וטלפון בלבד

---

## 🛠️ סטאק טכנולוגיה

### Frontend
- **React 19** + Vite
- **Tailwind CSS** עם RTL
- **React Router DOM**
- **Axios** לבקשות HTTP
- **Context API** לניהול מצב

### Backend
- **Laravel 11** (PHP 8.2+)
- **MySQL**
- **Laravel Sanctum** (אימות)
- **Global Scopes** (Multi-Tenant)

---

## 📂 מבנה הפרויקט

```
TakeEat-restaurant/
├── frontend/                      # React PWA
│   ├── src/
│   │   ├── pages/               # עמודים (Home, Menu, Cart, OrderStatus)
│   │   ├── components/          # קומפוננטים (מוכן להרחבה)
│   │   ├── layouts/             # Layouts (Customer, Restaurant)
│   │   ├── services/            # API Services (menu, order, apiClient)
│   │   ├── context/             # Context (Auth, Cart)
│   │   ├── constants/           # קבועים (API endpoints, UI text, statuses)
│   │   ├── hooks/               # Custom Hooks (מוכן להרחבה)
│   │   ├── utils/               # Utilities (מוכן להרחבה)
│   │   └── App.jsx              # Routing ראשי
│   ├── package.json
│   ├── tailwind.config.js       # RTL setup
│   ├── .env                     # DEV: localhost:8000
│   └── .env.production          # PROD: URL אמיתי
│
└── backend/                       # Laravel API
    ├── app/
    │   ├── Models/              # Restaurant, Category, MenuItem, Order, OrderItem
    │   └── Http/
    │       ├── Controllers/     # MenuController, OrderController, RestaurantController
    │       └── Middleware/      # EnsureTenantId
    ├── database/
    │   ├── migrations/          # סכימות טבלאות
    │   └── seeders/             # RestaurantSeeder (נתונים לדוגמה)
    ├── routes/
    │   └── api.php              # Endpoints
    └── README.md                # הוראות התקנה
```

---

## ⚡ התקנה מהירה

### Frontend

```bash
cd frontend
npm install
npm run dev
```

פותח ב: `http://localhost:5173`

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed --class=RestaurantSeeder
php artisan serve
```

API ב: `http://localhost:8000/api`

---

## 🚀 שימוש

### 1. כניסה כלקוח

1. פתח את Frontend
2. הכנס קוד מסעדה: `pizza-palace`
3. בחר פריטים מהתפריט
4. ההזמנה עם שם וטלפון
5. עקוב סטטוס בזמן אמת

### 2. Tenant IDs לדוגמה

```
pizza-palace      # פיצה 🍕
burger-central    # המבורגרים 🍔
```

---

## 📡 API Endpoints

כל בקשה חייבת Header: `X-Tenant-ID: pizza-palace`

```
GET    /api/menu                      # קבל תפריט
POST   /api/orders                    # צור הזמנה
GET    /api/orders/{id}               # קבל סטטוס
PATCH  /api/orders/{id}/status        # עדכן סטטוס
```

📖 **תיעוד מלא:** `backend/API_DOCUMENTATION.md`

---

## 🔐 Multi-Tenant Implementation

כל Tenant:
- Tenant ID ייחודי
- נתונים בטבלאות (עם `tenant_id` column)
- בידוד מלא מTenants אחרים
- Global Scope ב-Models דואג לבדיקה אוטומטית

**Example:**
```php
// Header בכל בקשה
X-Tenant-ID: pizza-palace

// או URL parameter
/api/menu?tenant_id=pizza-palace
```

---

## 💾 סטטוסי הזמנה

1. **received** (התקבלה) - הזמנה חדשה
2. **preparing** (בהכנה) - בתהליך הכנה
3. **ready** (מוכנה) - מוכנה לאיסוף
4. **delivered** (נמסרה) - הוכמת מסיימת

---

## 📱 תכונות PWA

- ✅ דמויי מתקן (Manifest)
- ✅ Service Worker (אפשרי בהרחבה)
- ✅ Offline support (אפשרי בהרחבה)
- ✅ RTL מלא

---

## 🔧 Customization

### הוספת מסעדה חדשה

```php
// backend/database/seeders/RestaurantSeeder.php
Restaurant::create([
    'tenant_id' => 'my-restaurant',
    'name' => 'שם המסעדה',
    'slug' => 'my-restaurant',
    // ... פרטים נוספים
]);
```

### שינוי צבעים Tailwind

```javascript
// frontend/tailwind.config.js
colors: {
  brand: {
    primary: '#1F2937',      // הרגש לשנות
    accent: '#EF4444',
    // ...
  }
}
```

---

## 🐛 Debug

### Frontend

```javascript
// console.log Tenant ID
console.log(localStorage.getItem('tenantId'));
```

### Backend

```bash
# צפה בלוגים
tail -f storage/logs/laravel.log
```

---

## 📝 הערות חשובות

- **ללא סליקה**: לא משלמים בהזמנה, רק מזמינים
- **English naming**: משתנים, פונקציות, דוגמים - באנגלית בלבד
- **Hebrew UI**: כל ממשק המשתמש בעברית
- **Single tenant app**: ניתן להפוך לMulti-Tenant בקלות

---

## 📚 תיעוד נוסף

- [Frontend README](./frontend/README.md)
- [Backend README](./backend/README.md)
- [API Documentation](./backend/API_DOCUMENTATION.md)

---

**בנוי עם ❤️ להזמנות קלות למסעדה**

TakeEat IL © 2026
