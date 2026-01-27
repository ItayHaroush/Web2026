# TakeEat Codebase Guide for AI Agents

## Project Overview

**TakeEat** is a multi-tenant restaurant ordering PWA (React + Laravel). Each restaurant operates as an isolated tenant with separate data, while sharing the same infrastructure.

- **Frontend:** React 19 + Vite + Tailwind CSS (RTL/Hebrew)
- **Backend:** Laravel 11 API + MySQL
- **Architecture:** Multi-Tenant (logical isolation via middleware + global scopes)
- **Auth:** Laravel Sanctum (restaurant staff) + Token-less (customers)

---

## Critical Architectural Pattern: Multi-Tenant

Every API request **must** include `X-Tenant-ID` header (tenant identifier like `pizza-palace`, `burger-central`). This is enforced at two levels:

### Backend (Laravel)
- **Middleware:** [EnsureTenantId.php](backend/app/Http/Middleware/EnsureTenantId.php) — validates and stores tenant in `app('tenant_id')`
- **Global Scopes:** [Restaurant.php](backend/app/Models/Restaurant.php#L51), [Category.php](backend/app/Models/Category.php), [MenuItem.php](backend/app/Models/MenuItem.php) automatically filter queries by current tenant
- **Route Groups:** All tenant-aware routes in [api.php](backend/routes/api.php#L72) use `middleware(['api', 'tenant'])`

**Pattern Example:**
```php
// Automatic tenant filtering via global scope
$items = MenuItem::where('price', '>', 10)->get(); 
// Internally becomes: WHERE restaurant_id = $tenantId AND price > 10
```

### Frontend (React)
- **apiClient Interceptor:** [apiClient.js](frontend/src/services/apiClient.js#L37-L44) injects `X-Tenant-ID` header from `localStorage.getItem('tenantId')`
- **Context State:** [AuthContext.jsx](frontend/src/context/AuthContext.jsx#L46-L50) manages `tenantId` and `role` (`'customer'` or `'restaurant'`)
- **Cart Isolation:** [CartContext.jsx](frontend/src/context/CartContext.jsx#L21-L28) clears cart when switching tenants

**Key:** Tenant ID comes from URL selection (not auth). Customers are identified by `tenantId` + name + phone only (no passwords).

---

## Data Flow & Key Services

### Order Creation Flow
1. **Frontend:** Customer selects tenant on home page → stored in localStorage
2. **MenuService:** `getMenu(tenantId)` fetches categories + items
3. **OrderService:** `createOrder()` sends POST with items array, name, phone
4. **Backend:** [OrderController.store()](backend/app/Http/Controllers/OrderController.php) validates, creates order + order_items records
5. **Status Polling:** [OrderStatus page](frontend/src/pages/customer/OrderStatus.jsx) polls `/orders/{id}` every 3-5s

### Admin Workflow
1. Login at `/admin/login` → token stored, role = `'restaurant'`
2. [AdminRestaurant](frontend/src/pages/admin/AdminRestaurant.jsx) dashboard fetches orders via [AdminController](backend/app/Http/Controllers/AdminController.php)
3. Status updates via PATCH `/admin/orders/{id}/status` (statuses: `received` → `preparing` → `ready` → `delivered`)

---

## File Structure & Key Files

### Backend
- **Routes:** [api.php](backend/routes/api.php) — main routing (auth, admin, tenant-aware)
- **Controllers:** [MenuController](backend/app/Http/Controllers/MenuController.php), [OrderController](backend/app/Http/Controllers/OrderController.php), [AdminController](backend/app/Http/Controllers/AdminController.php)
- **Models:** Standard Eloquent with global scopes for tenant filtering
- **Migrations:** Database tables include `tenant_id` column for logical isolation

### Frontend
- **Services:** [apiClient.js](frontend/src/services/apiClient.js) (Axios + interceptors), menuService.js, orderService.js, restaurantService.js
- **Context Providers:** AuthContext (auth state + tenant), CartContext (items + customer info), ToastContext (notifications)
- **Pages:** `/` (home/select restaurant), `/menu`, `/cart`, `/order-status`, `/admin/login`, `/admin/dashboard`
- **Constants:** [api.js](frontend/src/constants/api.js) has API_BASE_URL + TENANT_HEADER

---

## Development Workflows

### Start Development
```bash
# Terminal 1 - Backend
cd backend && php artisan key:generate && php artisan migrate && \
  php artisan db:seed --class=RestaurantSeeder && php artisan serve
# Server runs on http://localhost:8000

# Terminal 2 - Frontend  
cd frontend && npm install && npm run dev
# Dev server runs on http://localhost:5173 (default Vite)
```

### Database Setup
- Migrations auto-seed with `RestaurantSeeder` (creates 2 test restaurants: `pizza-palace`, `burger-central`)
- Manually test with curl: `curl -H "X-Tenant-ID: pizza-palace" http://localhost:8000/api/menu`

### Testing Tenant Isolation
Always include `X-Tenant-ID` header:
```bash
# Works
curl -H "X-Tenant-ID: pizza-palace" http://localhost:8000/api/menu

# Fails (400 error)
curl http://localhost:8000/api/menu
```

---

## Project-Specific Conventions

1. **Tenant ID Naming:** Lowercase kebab-case (`pizza-palace`, `burger-central`), stored in localStorage
2. **API Responses:** All responses wrapped in `{ success: boolean, message: string, data: {} }`
3. **Order Statuses:** Fixed enum: `received`, `preparing`, `ready`, `delivered`
4. **RTL Support:** Tailwind uses `tailwindcss-rtl` plugin; all text naturally flows right-to-left
5. **No Payment:** System collects name + phone only; payment handled separately
6. **Error Handling:** 401 errors redirect to `/login` (customer) or `/admin/login` (restaurant staff)

---

## Common Patterns & Examples

### Adding a New Admin Feature
1. Add route in [api.php](backend/routes/api.php#L38-L65) under admin middleware
2. Create controller method in [AdminController.php](backend/app/Http/Controllers/AdminController.php)
3. Controller retrieves tenant via `app('tenant_id')` (auto-filtered by global scopes)
4. Create frontend service in [services/](frontend/src/services/) calling the endpoint
5. Call service from [AdminRestaurant.jsx](frontend/src/pages/admin/AdminRestaurant.jsx) or new admin page

### Querying with Tenant Isolation
```php
// Global scope auto-filters — no manual tenant_id check needed
$categories = Category::orderBy('sort_order')->get(); // Only current tenant's
$orders = Order::where('status', 'received')->get();  // Only current tenant's
```

### Fetching in Frontend
```javascript
// apiClient auto-injects X-Tenant-ID header
const { data } = await apiClient.get('/menu');
// Header: X-Tenant-ID: pizza-palace (from localStorage)
```

---

## Integration Points & Dependencies

- **External APIs:** None (payment handled separately)
- **Database:** MySQL (seeded with RestaurantSeeder)
- **Auth:** Laravel Sanctum for restaurant staff; customers use tenantId + name + phone
- **Frontend Libraries:** React Router, Axios, Context API (no Redux)
- **State Management:** React Context (AuthContext, CartContext, ToastContext)

---

## Critical Notes for Modifications

1. **Always include tenant filtering** when adding queries — use models (global scopes work automatically)
2. **Test multi-tenant safety:** Never hardcode tenant IDs; always use `app('tenant_id')` or header
3. **Update migrations carefully:** Add `tenant_id` column + migration runs on all existing databases
4. **Frontend localStorage:** Cart/auth state tied to tenantId — test when switching restaurants
5. **Error responses:** Match existing format: `{ success, message, errors: {} }`

---

**Language:** Project is bilingual (Hebrew comments in code, English variable names).
