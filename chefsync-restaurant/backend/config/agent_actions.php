<?php

/**
 * Agent Actions Registry
 *
 * Defines all executable actions the AI Super Agent can propose.
 * Each action maps to an existing AdminController method.
 *
 * Risk levels:
 * - low: simple toggles, non-destructive updates (inline card)
 * - medium: data modifications (inline card)
 * - high: significant changes (modal confirmation)
 * - critical: irreversible deletions (modal with warning)
 */

return [

    // ═══════════════════════════════════════
    //  CATEGORIES
    // ═══════════════════════════════════════

    'category.create' => [
        'name_he' => 'יצירת קטגוריה',
        'description_he' => 'יצירת קטגוריה חדשה בתפריט',
        'risk' => 'low',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'storeCategory',
        'http_method' => 'POST',
        'required_role' => 'employee',
        'params' => [
            'name'        => ['type' => 'string', 'required' => true, 'label_he' => 'שם'],
            'description' => ['type' => 'string', 'required' => false, 'label_he' => 'תיאור'],
            'icon'        => ['type' => 'string', 'required' => false, 'label_he' => 'אייקון'],
            'dish_type'   => ['type' => 'enum', 'values' => ['plate', 'sandwich', 'both'], 'required' => false, 'label_he' => 'סוג מנה'],
        ],
    ],

    'category.update' => [
        'name_he' => 'עדכון קטגוריה',
        'description_he' => 'עדכון פרטי קטגוריה קיימת',
        'risk' => 'low',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'updateCategory',
        'http_method' => 'PUT',
        'required_role' => 'employee',
        'route_params' => ['id'],
        'params' => [
            'id'          => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה קטגוריה'],
            'name'        => ['type' => 'string', 'required' => false, 'label_he' => 'שם'],
            'description' => ['type' => 'string', 'required' => false, 'label_he' => 'תיאור'],
            'icon'        => ['type' => 'string', 'required' => false, 'label_he' => 'אייקון'],
            'is_active'   => ['type' => 'boolean', 'required' => false, 'label_he' => 'פעיל'],
        ],
    ],

    'category.delete' => [
        'name_he' => 'מחיקת קטגוריה',
        'description_he' => 'מחיקת קטגוריה מהתפריט',
        'risk' => 'high',
        'approval_type' => 'modal',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'deleteCategory',
        'http_method' => 'DELETE',
        'required_role' => 'manager',
        'route_params' => ['id'],
        'params' => [
            'id' => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה קטגוריה'],
        ],
    ],

    'category.toggle_active' => [
        'name_he' => 'הפעלה/השבתה של קטגוריה',
        'description_he' => 'החלפת מצב פעיל/לא פעיל של קטגוריה בתפריט',
        'risk' => 'low',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'toggleCategoryActive',
        'http_method' => 'PATCH',
        'required_role' => 'employee',
        'route_params' => ['id'],
        'params' => [
            'id' => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה קטגוריה'],
        ],
    ],

    // ═══════════════════════════════════════
    //  MENU ITEMS
    // ═══════════════════════════════════════

    'menu_item.create' => [
        'name_he' => 'הוספת פריט לתפריט',
        'description_he' => 'יצירת פריט תפריט חדש בקטגוריה',
        'risk' => 'low',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'storeMenuItem',
        'http_method' => 'POST',
        'required_role' => 'employee',
        'params' => [
            'category_id' => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה קטגוריה'],
            'name'        => ['type' => 'string', 'required' => true, 'label_he' => 'שם'],
            'description' => ['type' => 'string', 'required' => false, 'label_he' => 'תיאור'],
            'price'       => ['type' => 'number', 'required' => true, 'label_he' => 'מחיר (₪)'],
            'is_available' => ['type' => 'boolean', 'required' => false, 'label_he' => 'זמין'],
        ],
    ],

    'menu_item.update' => [
        'name_he' => 'עדכון פריט תפריט',
        'description_he' => 'עדכון שם, מחיר, תיאור או זמינות של פריט',
        'risk' => 'medium',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'updateMenuItem',
        'http_method' => 'PUT',
        'required_role' => 'employee',
        'route_params' => ['id'],
        'params' => [
            'id'           => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה פריט'],
            'name'         => ['type' => 'string', 'required' => false, 'label_he' => 'שם'],
            'description'  => ['type' => 'string', 'required' => false, 'label_he' => 'תיאור'],
            'price'        => ['type' => 'number', 'required' => false, 'label_he' => 'מחיר (₪)'],
            'is_available' => ['type' => 'boolean', 'required' => false, 'label_he' => 'זמין'],
        ],
    ],

    'menu_item.delete' => [
        'name_he' => 'מחיקת/ארכוב פריט מהתפריט',
        'description_he' => 'ארכוב פריט שהופיע בהזמנות, או מחיקה לצמיתות של פריט ללא היסטוריית הזמנות',
        'risk' => 'critical',
        'approval_type' => 'modal',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'deleteMenuItem',
        'http_method' => 'DELETE',
        'required_role' => 'manager',
        'route_params' => ['id'],
        'params' => [
            'id' => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה פריט'],
        ],
    ],

    // ═══════════════════════════════════════
    //  ORDERS
    // ═══════════════════════════════════════

    'order.update_status' => [
        'name_he' => 'עדכון סטטוס הזמנה',
        'description_he' => 'שינוי סטטוס הזמנה (התקבלה, בהכנה, מוכנה, וכו\')',
        'risk' => 'medium',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'updateOrderStatus',
        'http_method' => 'PATCH',
        'required_role' => 'employee',
        'route_params' => ['id'],
        'params' => [
            'id'     => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה הזמנה'],
            'status' => ['type' => 'enum', 'values' => ['received', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'], 'required' => true, 'label_he' => 'סטטוס חדש'],
        ],
    ],

    'order.update_eta' => [
        'name_he' => 'עדכון זמן הגעה משוער',
        'description_he' => 'עדכון ה-ETA של הזמנה',
        'risk' => 'low',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'updateOrderEta',
        'http_method' => 'PATCH',
        'required_role' => 'employee',
        'route_params' => ['id'],
        'params' => [
            'id'          => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה הזמנה'],
            'eta_minutes' => ['type' => 'integer', 'required' => true, 'label_he' => 'דקות'],
            'eta_note'    => ['type' => 'string', 'required' => false, 'label_he' => 'הערה'],
        ],
    ],

    // ═══════════════════════════════════════
    //  RESTAURANT SETTINGS
    // ═══════════════════════════════════════

    'restaurant.update' => [
        'name_he' => 'עדכון הגדרות מסעדה',
        'description_he' => 'שינוי שם, טלפון, תיאור, סטטוס פתוח/סגור',
        'risk' => 'medium',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'updateRestaurant',
        'http_method' => 'PUT',
        'required_role' => 'owner',
        'params' => [
            'name'               => ['type' => 'string', 'required' => false, 'label_he' => 'שם מסעדה'],
            'phone'              => ['type' => 'string', 'required' => false, 'label_he' => 'טלפון'],
            'description'        => ['type' => 'string', 'required' => false, 'label_he' => 'תיאור'],
            'is_open'            => ['type' => 'boolean', 'required' => false, 'label_he' => 'פתוח/סגור'],
            'is_override_status' => ['type' => 'boolean', 'required' => false, 'label_he' => 'כפיית סטטוס'],
        ],
    ],

    // ═══════════════════════════════════════
    //  SALADS / ADD-ONS
    // ═══════════════════════════════════════

    'salad.create' => [
        'name_he' => 'הוספת סלט/תוספת',
        'description_he' => 'הוספת פריט תוספת חדש',
        'risk' => 'low',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'storeSalad',
        'http_method' => 'POST',
        'required_role' => 'manager',
        'params' => [
            'name'        => ['type' => 'string', 'required' => true, 'label_he' => 'שם'],
            'price_delta' => ['type' => 'number', 'required' => false, 'label_he' => 'תוספת מחיר (₪)'],
            'group_id'    => ['type' => 'integer', 'required' => false, 'label_he' => 'מזהה קבוצה'],
        ],
    ],

    'salad.update' => [
        'name_he' => 'עדכון סלט/תוספת',
        'description_he' => 'עדכון פרטי תוספת קיימת',
        'risk' => 'low',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'updateSalad',
        'http_method' => 'PUT',
        'required_role' => 'manager',
        'route_params' => ['id'],
        'params' => [
            'id'          => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה'],
            'name'        => ['type' => 'string', 'required' => false, 'label_he' => 'שם'],
            'price_delta' => ['type' => 'number', 'required' => false, 'label_he' => 'תוספת מחיר (₪)'],
            'is_active'   => ['type' => 'boolean', 'required' => false, 'label_he' => 'פעיל'],
        ],
    ],

    'salad.delete' => [
        'name_he' => 'מחיקת סלט/תוספת',
        'description_he' => 'מחיקת תוספת מהתפריט',
        'risk' => 'high',
        'approval_type' => 'modal',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'deleteSalad',
        'http_method' => 'DELETE',
        'required_role' => 'manager',
        'route_params' => ['id'],
        'params' => [
            'id' => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה'],
        ],
    ],

    // ═══════════════════════════════════════
    //  BASES / VARIANTS
    // ═══════════════════════════════════════

    'base.create' => [
        'name_he' => 'הוספת בסיס כריך',
        'description_he' => 'הוספת סוג בסיס חדש (לחם, פיתה, וכו\')',
        'risk' => 'low',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'storeBase',
        'http_method' => 'POST',
        'required_role' => 'manager',
        'params' => [
            'name'        => ['type' => 'string', 'required' => true, 'label_he' => 'שם'],
            'price_delta' => ['type' => 'number', 'required' => false, 'label_he' => 'תוספת מחיר (₪)'],
            'is_active'   => ['type' => 'boolean', 'required' => false, 'label_he' => 'פעיל'],
            'is_default'  => ['type' => 'boolean', 'required' => false, 'label_he' => 'ברירת מחדל'],
        ],
    ],

    'base.update' => [
        'name_he' => 'עדכון בסיס כריך',
        'description_he' => 'עדכון פרטי בסיס קיים',
        'risk' => 'low',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'updateBase',
        'http_method' => 'PUT',
        'required_role' => 'manager',
        'route_params' => ['id'],
        'params' => [
            'id'          => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה'],
            'name'        => ['type' => 'string', 'required' => false, 'label_he' => 'שם'],
            'price_delta' => ['type' => 'number', 'required' => false, 'label_he' => 'תוספת מחיר (₪)'],
            'is_active'   => ['type' => 'boolean', 'required' => false, 'label_he' => 'פעיל'],
            'is_default'  => ['type' => 'boolean', 'required' => false, 'label_he' => 'ברירת מחדל'],
        ],
    ],

    'base.delete' => [
        'name_he' => 'מחיקת בסיס כריך',
        'description_he' => 'מחיקת בסיס מהתפריט',
        'risk' => 'high',
        'approval_type' => 'modal',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'deleteBase',
        'http_method' => 'DELETE',
        'required_role' => 'manager',
        'route_params' => ['id'],
        'params' => [
            'id' => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה'],
        ],
    ],

    // ═══════════════════════════════════════
    //  DELIVERY ZONES
    // ═══════════════════════════════════════

    'delivery_zone.create' => [
        'name_he' => 'הוספת אזור משלוח',
        'description_he' => 'יצירת אזור משלוח חדש',
        'risk' => 'medium',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'storeDeliveryZone',
        'http_method' => 'POST',
        'required_role' => 'manager',
        'params' => [
            'name'         => ['type' => 'string', 'required' => true, 'label_he' => 'שם'],
            'pricing_type' => ['type' => 'enum', 'values' => ['fixed', 'per_km', 'tiered'], 'required' => true, 'label_he' => 'סוג תמחור'],
            'fixed_fee'    => ['type' => 'number', 'required' => false, 'label_he' => 'מחיר קבוע (₪)'],
        ],
    ],

    // ═══════════════════════════════════════
    //  EMPLOYEES
    // ═══════════════════════════════════════

    'employee.update' => [
        'name_he' => 'עדכון עובד',
        'description_he' => 'עדכון פרטי עובד (תפקיד, סטטוס)',
        'risk' => 'medium',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'updateEmployee',
        'http_method' => 'PUT',
        'required_role' => 'manager',
        'route_params' => ['id'],
        'params' => [
            'id'        => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה עובד'],
            'name'      => ['type' => 'string', 'required' => false, 'label_he' => 'שם'],
            'role'      => ['type' => 'enum', 'values' => ['manager', 'employee', 'delivery'], 'required' => false, 'label_he' => 'תפקיד'],
            'is_active' => ['type' => 'boolean', 'required' => false, 'label_he' => 'פעיל'],
        ],
    ],

    'employee.delete' => [
        'name_he' => 'מחיקת עובד',
        'description_he' => 'הסרת עובד מהמסעדה',
        'risk' => 'critical',
        'approval_type' => 'modal',
        'controller' => \App\Http\Controllers\AdminController::class,
        'method' => 'deleteEmployee',
        'http_method' => 'DELETE',
        'required_role' => 'manager',
        'route_params' => ['id'],
        'params' => [
            'id' => ['type' => 'integer', 'required' => true, 'label_he' => 'מזהה עובד'],
        ],
    ],

    // ═══════════════════════════════════════
    //  NOTIFICATIONS (new capabilities)
    // ═══════════════════════════════════════

    'notification.send_push' => [
        'name_he' => 'שליחת התראת Push',
        'description_he' => 'שליחת התראת Push לצוות המסעדה',
        'risk' => 'medium',
        'approval_type' => 'inline',
        'controller' => \App\Http\Controllers\AgentActionController::class,
        'method' => 'sendPushNotification',
        'http_method' => 'POST',
        'required_role' => 'manager',
        'params' => [
            'title' => ['type' => 'string', 'required' => true, 'label_he' => 'כותרת'],
            'body'  => ['type' => 'string', 'required' => true, 'label_he' => 'תוכן'],
        ],
    ],
];
