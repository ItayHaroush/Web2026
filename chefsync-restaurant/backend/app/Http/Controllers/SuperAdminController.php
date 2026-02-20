<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Models\User;
use App\Models\Order;
use App\Models\City;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use App\Services\SmsService;
use App\Models\RestaurantSubscription;
use App\Models\RestaurantPayment;
use App\Models\SystemError;
use App\Mail\RestaurantApprovedMail;
use Illuminate\Support\Facades\Mail;

/**
 * SuperAdminController - ניהול מערכת כללי
 * 
 * דורש הרשאת super_admin
 */
class SuperAdminController extends Controller
{
    /**
     * דשבורד Super Admin - סטטיסטיקות כלליות
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();

        // סטטיסטיקות כלליות
        $stats = [
            'total_restaurants' => Restaurant::count(),
            'active_restaurants' => Restaurant::where('is_open', true)->count(),
            'total_orders' => Order::where('status', '!=', 'cancelled')->where('is_test', false)->count(),
            'total_revenue' => Order::where('status', '!=', 'cancelled')->where('is_test', false)->sum('total_amount'),
            'orders_today' => Order::whereDate('created_at', today())
                ->where('status', '!=', 'cancelled')
                ->where('is_test', false)
                ->count(),
            'revenue_today' => Order::whereDate('created_at', today())
                ->where('status', '!=', 'cancelled')
                ->where('is_test', false)
                ->sum('total_amount'),
        ];

        // SaaS KPIs
        $mrr = 0;
        $trialRestaurants = 0;
        $suspendedRestaurants = 0;
        $failedPaymentsRecent = 0;

        try {
            $mrr = RestaurantSubscription::where('status', 'active')->sum('monthly_fee');
            $trialRestaurants = Restaurant::where('is_demo', true)->count();
            $suspendedRestaurants = RestaurantSubscription::where('status', 'suspended')->count();
            $failedPaymentsRecent = RestaurantPayment::where('status', 'failed')
                ->where('created_at', '>=', now()->subDays(30))
                ->count();
        } catch (\Exception $e) {
            // Tables might not exist yet
        }

        $recentSystemErrors = SystemError::unresolved()->recent(24)->count();

        // מסעדות לפי סטטוס
        $restaurantsByStatus = [
            'active' => Restaurant::where('is_open', true)->count(),
            'inactive' => Restaurant::where('is_open', false)->count(),
        ];

        // הזמנות לפי סטטוס
        $ordersByStatus = Order::select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $stats,
                'saas' => [
                    'mrr' => $mrr,
                    'trial_restaurants' => $trialRestaurants,
                    'suspended_restaurants' => $suspendedRestaurants,
                    'failed_payments_recent' => $failedPaymentsRecent,
                    'system_errors_unresolved' => $recentSystemErrors,
                ],
                'restaurants_by_status' => $restaurantsByStatus,
                'orders_by_status' => $ordersByStatus,
            ],
        ]);
    }

    /**
     * רשימת כל המסעדות
     */
    public function listRestaurants(Request $request)
    {
        $query = Restaurant::withCount(['orders', 'categories', 'menuItems']);

        // סינון לפי סטטוס
        if ($request->has('status')) {
            if ($request->status === 'active') {
                $query->where('is_open', true);
            } elseif ($request->status === 'inactive') {
                $query->where('is_open', false);
            }
        }

        // חיפוש
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('tenant_id', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $restaurants = $query->orderBy('created_at', 'desc')->paginate(20);

        // הוספת נתוני הכנסות לכל מסעדה
        $restaurants->getCollection()->transform(function ($restaurant) {
            $restaurant->total_revenue = Order::where('restaurant_id', $restaurant->id)
                ->where('status', '!=', 'cancelled')
                ->where('is_test', false)
                ->sum('total_amount');
            $restaurant->orders_count = Order::where('restaurant_id', $restaurant->id)
                ->where('status', '!=', 'cancelled')
                ->where('is_test', false)
                ->count();
            return $restaurant;
        });

        return response()->json([
            'success' => true,
            'restaurants' => $restaurants,
        ]);
    }

    /**
     * פרטי מסעדה ספציפית
     */
    public function getRestaurant($id)
    {
        $restaurant = Restaurant::withCount([
            'orders as orders_count' => function ($q) {
                $q->where('status', '!=', 'cancelled')->where('is_test', false);
            },
            'categories',
            'menuItems',
            'displayScreens as display_screens_count',
        ])->findOrFail($id);

        $restaurant->kiosks_count = \App\Models\Kiosk::where('restaurant_id', $restaurant->id)->count();
        $restaurant->active_kiosks_count = \App\Models\Kiosk::where('restaurant_id', $restaurant->id)->where('is_active', true)->count();
        $restaurant->active_screens_count = $restaurant->displayScreens()->where('is_active', true)->count();

        $restaurant->total_revenue = Order::where('restaurant_id', $restaurant->id)
            ->where('status', '!=', 'cancelled')
            ->where('is_test', false)
            ->sum('total_amount');

        $restaurant->users = User::where('restaurant_id', $restaurant->id)
            ->select('id', 'name', 'email', 'phone', 'role', 'is_active')
            ->get();

        $owner = User::where('restaurant_id', $restaurant->id)
            ->where('role', 'owner')
            ->first();
        $restaurant->owner_info = $owner ? [
            'name' => $owner->name,
            'email' => $owner->email,
            'phone' => $owner->phone,
        ] : null;

        return response()->json([
            'success' => true,
            'restaurant' => $restaurant,
        ]);
    }

    /**
     * יצירת מסעדה חדשה
     */
    public function createRestaurant(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'tenant_id' => 'required|string|max:255|unique:restaurants,tenant_id|regex:/^[a-z0-9-]+$/',
            'phone' => 'required|string|max:20',
            'address' => 'nullable|string',
            'description' => 'nullable|string',
            'city' => 'required|string|max:255',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            'is_demo' => 'nullable|boolean',

            // פרטי בעל המסעדה
            'owner_name' => 'required|string|max:255',
            'owner_email' => 'required|email|unique:users,email',
            'owner_phone' => 'required|string|max:20',
            'owner_password' => 'nullable|string|min:6',
        ]);

        DB::beginTransaction();
        try {
            $slugValue = Str::slug($validated['name']);
            $tenantId = $validated['tenant_id'];
            if (empty($tenantId)) {
                throw new \Exception('tenant_id is required');
            }
            if (empty($slugValue)) {
                $slugValue = Str::slug($tenantId) ?: $tenantId;
            }

            // קואורדינטות: ידני > לפי עיר
            $latitude = null;
            $longitude = null;
            if ($request->filled(['latitude', 'longitude'])) {
                $latitude = $validated['latitude'];
                $longitude = $validated['longitude'];
            } else {
                $cityData = City::where('hebrew_name', $validated['city'])->first();
                $latitude = $cityData?->latitude;
                $longitude = $cityData?->longitude;
            }

            $logoUrl = null;
            if ($request->hasFile('logo') && $request->file('logo')->isValid()) {
                $logoFile = $request->file('logo');
                $logoPath = $logoFile->store('logos', 'public');
                $logoUrl = '/storage/' . $logoPath;
            }

            Log::info('Creating restaurant', [
                'name' => $validated['name'],
                'slug' => $slugValue,
                'tenant_id' => $tenantId,
                'logo_path' => $logoUrl,
            ]);

            $restaurant = Restaurant::create([
                'tenant_id' => $tenantId,
                'name' => $validated['name'],
                'slug' => $slugValue,
                'phone' => $this->formatPhoneForDisplay($validated['phone']),
                'address' => $validated['address'] ?? null,
                'description' => $validated['description'] ?? null,
                'city' => $validated['city'],
                'latitude' => $latitude,
                'longitude' => $longitude,
                'logo_url' => $logoUrl,
                'is_open' => false, // כברירת מחדל סגור עד שיסיימו הגדרה
                'is_approved' => false,
                'is_demo' => $validated['is_demo'] ?? true,
            ]);

            // יצירת משתמש בעלים
            $password = $validated['owner_password'] ?? Str::random(10);
            $owner = User::create([
                'restaurant_id' => $restaurant->id,
                'name' => $validated['owner_name'],
                'email' => $validated['owner_email'],
                'phone' => $this->formatPhoneForDisplay($validated['owner_phone']),
                'password' => Hash::make($password),
                'role' => 'owner',
                'is_active' => true,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'מסעדה נוצרה בהצלחה!',
                'restaurant' => $restaurant,
                'owner' => [
                    'id' => $owner->id,
                    'name' => $owner->name,
                    'email' => $owner->email,
                    'temporary_password' => $validated['owner_password'] ?? $password,
                ],
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Restaurant creation error: ' . $e->getMessage(), [
                'exception' => $e,
                'validated_data' => $validated,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'שגיאה ביצירת המסעדה: ' . $e->getMessage(),
                'error_detail' => env('APP_DEBUG') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * עדכון מסעדה
     */
    public function updateRestaurant(Request $request, $id)
    {
        $restaurant = Restaurant::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'tenant_id' => 'sometimes|string|max:255|unique:restaurants,tenant_id,' . $id . '|regex:/^[a-z0-9-]+$/',
            'phone' => 'sometimes|string|max:20',
            'address' => 'nullable|string',
            'description' => 'nullable|string',
            'logo_url' => 'nullable|url',
            'is_open' => 'sometimes|boolean',
            'is_demo' => 'sometimes|boolean',
        ]);

        // אם השם משתנה, עדכן את ה-slug
        if (isset($validated['name'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $restaurant->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'המסעדה עודכנה בהצלחה!',
            'restaurant' => $restaurant,
        ]);
    }

    /**
     * מחיקת מסעדה (soft delete או hard delete)
     */
    public function deleteRestaurant($id)
    {
        $restaurant = Restaurant::findOrFail($id);

        // בדיקה אם יש הזמנות פעילות
        $activeOrders = Order::where('restaurant_id', $id)
            ->whereIn('status', ['pending', 'received', 'preparing', 'ready', 'delivering'])
            ->count();

        if ($activeOrders > 0) {
            return response()->json([
                'success' => false,
                'message' => 'לא ניתן למחוק מסעדה עם הזמנות פעילות',
            ], 400);
        }

        $restaurant->delete();

        return response()->json([
            'success' => true,
            'message' => 'המסעדה נמחקה בהצלחה!',
        ]);
    }

    /**
     * החלפת סטטוס מסעדה (פעיל/לא פעיל)
     */
    public function toggleRestaurantStatus($id)
    {
        $restaurant = Restaurant::findOrFail($id);
        $currentOpen = (bool) ($restaurant->is_open_now ?? $restaurant->is_open);
        $restaurant->is_override_status = true;
        $restaurant->is_open = !$currentOpen;
        $restaurant->save();

        return response()->json([
            'success' => true,
            'message' => 'סטטוס המסעדה עודכן!',
            'restaurant' => $restaurant,
        ]);
    }

    /**
     * אישור מסעדה חדשה (סופר אדמין בלבד)
     */
    public function approveRestaurant($id)
    {
        $restaurant = Restaurant::findOrFail($id);

        if ($restaurant->is_approved) {
            return response()->json([
                'success' => true,
                'message' => 'המסעדה כבר מאושרת',
                'restaurant' => $restaurant,
            ]);
        }

        $restaurant->is_approved = true;
        $restaurant->is_demo = false; // אישור = מסעדה אמיתית
        $restaurant->is_open = false; // נותר סגור עד שבעלים יפתח ידנית לאחר אישור
        $restaurant->is_override_status = false;
        $restaurant->save();

        $owner = User::where('restaurant_id', $restaurant->id)
            ->where('role', 'owner')
            ->orderBy('id')
            ->first();

        $smsSent = null;
        if ($owner && $owner->phone) {
            $ownerPhone = $this->normalizePhoneE164($owner->phone);
            $smsSent = SmsService::sendApprovalMessage($ownerPhone, $restaurant->name);
        }

        // שליחת מייל אישור לבעל המסעדה
        $emailSent = false;
        if ($owner && $owner->email) {
            try {
                Mail::to($owner->email)->send(new RestaurantApprovedMail($restaurant, $owner->name));
                $emailSent = true;
            } catch (\Exception $mailError) {
                Log::warning('Restaurant approval email failed', [
                    'restaurant_id' => $restaurant->id,
                    'email' => $owner->email,
                    'error' => $mailError->getMessage(),
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'המסעדה אושרה בהצלחה',
            'restaurant' => $restaurant,
            'notification' => [
                'sms_sent' => $smsSent,
                'email_sent' => $emailSent,
                'owner_id' => $owner?->id,
            ],
        ]);
    }

    /**
     * ביטול אישור מסעדה (סופר אדמין בלבד)
     */
    public function revokeApproval($id)
    {
        $restaurant = Restaurant::withoutGlobalScopes()->findOrFail($id);

        if (!$restaurant->is_approved) {
            return response()->json([
                'success' => true,
                'message' => 'המסעדה כבר לא מאושרת',
                'restaurant' => $restaurant,
            ]);
        }

        $restaurant->is_approved = false;
        $restaurant->is_open = false;
        $restaurant->save();

        return response()->json([
            'success' => true,
            'message' => 'אישור המסעדה בוטל בהצלחה',
            'restaurant' => $restaurant,
        ]);
    }

    /**
     * סטטיסטיקות מסעדה ספציפית
     */
    public function getRestaurantStats($id)
    {
        $restaurant = Restaurant::findOrFail($id);

        $stats = [
            'total_orders' => Order::where('restaurant_id', $id)
                ->where('status', '!=', 'cancelled')
                ->where('is_test', false)
                ->count(),
            'total_revenue' => Order::where('restaurant_id', $id)
                ->where('status', '!=', 'cancelled')
                ->where('is_test', false)
                ->sum('total_amount'),
            'orders_today' => Order::where('restaurant_id', $id)
                ->whereDate('created_at', today())
                ->where('status', '!=', 'cancelled')
                ->where('is_test', false)
                ->count(),
            'revenue_today' => Order::where('restaurant_id', $id)
                ->whereDate('created_at', today())
                ->where('status', '!=', 'cancelled')
                ->where('is_test', false)
                ->sum('total_amount'),
            'orders_by_status' => Order::where('restaurant_id', $id)
                ->select('status', DB::raw('count(*) as count'))
                ->groupBy('status')
                ->pluck('count', 'status'),
            'menu_items_count' => $restaurant->menuItems()->count(),
            'categories_count' => $restaurant->categories()->count(),
        ];

        return response()->json([
            'success' => true,
            'stats' => $stats,
        ]);
    }

    /**
     * קבל רשימת כל הערים בישראל
     */
    public function getCities()
    {
        $cities = City::orderBy('hebrew_name')->get();
        return response()->json([
            'success' => true,
            'data' => $cities,
        ]);
    }

    /**
     * סטטוס סכימת בסיס נתונים ומיגרציות - לאבחון הבדלים בין סביבות
     */
    public function schemaStatus()
    {
        try {
            // פרטים כלליים
            $app = [
                'laravel_version' => app()->version(),
                'php_version' => PHP_VERSION,
                'app_env' => config('app.env'),
                'app_debug' => (bool) config('app.debug'),
                'app_url' => config('app.url'),
            ];

            // שם הדאטאבייס וגרסת ה-DB
            $dbName = optional(collect(DB::select('SELECT DATABASE() as db'))->first())->db;
            $dbVersion = optional(collect(DB::select('SELECT VERSION() as v'))->first())->v;

            // מיגרציות שהורצו
            $migrations = collect(DB::table('migrations')->select('migration', 'batch')->orderBy('id')->get())
                ->map(function ($row) {
                    return [
                        'migration' => $row->migration,
                        'batch' => (int) $row->batch,
                    ];
                })->values();

            // טבלאות ועמודות מתוך information_schema
            $columns = collect(DB::select(<<<SQL
                SELECT TABLE_NAME as table_name,
                       COLUMN_NAME as column_name,
                       COLUMN_TYPE as column_type,
                       IS_NULLABLE as is_nullable,
                       COLUMN_DEFAULT as column_default,
                       COLUMN_KEY as column_key,
                       EXTRA as extra
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ?
                ORDER BY TABLE_NAME, ORDINAL_POSITION
            SQL, [$dbName]))
                ->groupBy('table_name')
                ->map(function ($cols, $table) {
                    return $cols->map(function ($c) {
                        return [
                            'column' => $c->column_name,
                            'type' => $c->column_type,
                            'nullable' => $c->is_nullable === 'YES',
                            'default' => $c->column_default,
                            'key' => $c->column_key,
                            'extra' => $c->extra,
                        ];
                    })->values();
                });

            // חישוב checksum להשוואה מהירה בין סביבות
            $checksum = sha1(json_encode([
                'migrations' => $migrations,
                'columns' => $columns,
            ]));

            return response()->json([
                'success' => true,
                'data' => [
                    'app' => $app,
                    'database' => [
                        'name' => $dbName,
                        'version' => $dbVersion,
                    ],
                    'migrations' => $migrations,
                    'schema' => $columns,
                    'checksum' => $checksum,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Schema status error: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בשליפת סטטוס הסכימה: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * SMS Debug - שליחת הודעת אימות (OTP) לבדיקה מתוך פאנל סופר אדמין
     *
     * מאפשר לבחור ספק (twilio/sms019) או להשתמש בברירת מחדל (twilio).
     * ברירת מחדל: לא מחזיר את הקוד בתגובה (ניתן לבקש reveal_code=true).
     */
    public function testSms(Request $request)
    {
        $validated = $request->validate([
            'phone' => 'required|string',
            'provider' => 'nullable|string|in:auto,twilio,sms019,019,019sms',
            'dry_run' => 'nullable|boolean',
            'reveal_code' => 'nullable|boolean',
        ]);

        $phone = $this->normalizePhoneE164($validated['phone']);
        $providerRequested = (string) ($validated['provider'] ?? 'auto');
        $dryRun = (bool) ($validated['dry_run'] ?? false);
        $revealCode = (bool) ($validated['reveal_code'] ?? false);

        if ($providerRequested !== '' && $providerRequested !== 'auto') {
            config([
                'sms.pilot' => false,
                'sms.provider' => $providerRequested,
            ]);
        }

        $pilot = filter_var(config('sms.pilot', false), FILTER_VALIDATE_BOOLEAN);
        $providerSelected = $pilot ? 'twilio' : (string) config('sms.provider', 'twilio');

        $code = (string) random_int(100000, 999999);

        $configHealth = [
            'twilio' => [
                'sid' => (bool) config('sms.providers.twilio.sid'),
                'token' => (bool) config('sms.providers.twilio.token'),
                'messaging_service_sid' => (bool) config('sms.providers.twilio.messaging_service_sid'),
                'from' => (bool) config('sms.providers.twilio.from'),
            ],
            'sms019' => [
                'endpoint' => (bool) config('sms.providers.sms019.endpoint'),
                'token' => (bool) config('sms.providers.sms019.token'),
                'username' => (bool) config('sms.providers.sms019.username'),
                'source' => (bool) config('sms.providers.sms019.source'),
            ],
        ];

        $sent = false;
        $providerDebug = [
            'sent' => null,
            'resolved_source' => null,
            'resolved_destination' => null,
            'used_username' => null,
            'token_tail' => null,
            'http_status' => null,
            'provider_status' => null,
            'provider_message' => null,
        ];
        if (!$dryRun) {
            $providerDebug = SmsService::sendVerificationCodeDetailed($phone, $code);
            $sent = (bool) ($providerDebug['sent'] ?? false);
        }

        Log::info('Super admin SMS test', [
            'user_id' => optional($request->user())->id,
            'phone_masked' => $this->maskPhone($phone),
            'provider_requested' => $providerRequested,
            'provider_selected' => $providerSelected,
            'pilot' => $pilot,
            'dry_run' => $dryRun,
            'sent' => $sent,
            'provider_debug' => [
                'resolved_source' => $providerDebug['resolved_source'] ?? null,
                'resolved_destination' => $providerDebug['resolved_destination'] ?? null,
                'used_username' => $providerDebug['used_username'] ?? null,
                'token_tail' => $providerDebug['token_tail'] ?? null,
                'http_status' => $providerDebug['http_status'] ?? null,
                'provider_status' => $providerDebug['provider_status'] ?? null,
            ],
        ]);

        if (!$dryRun && !$sent) {
            return response()->json([
                'success' => false,
                'message' => 'שליחת SMS נכשלה',
                'data' => [
                    'provider_requested' => $providerRequested,
                    'provider_selected' => $providerSelected,
                    'pilot' => $pilot,
                    'phone_masked' => $this->maskPhone($phone),
                    'config_health' => $configHealth,
                    'resolved_source' => $providerDebug['resolved_source'] ?? null,
                    'resolved_destination' => $providerDebug['resolved_destination'] ?? null,
                    'used_username' => $providerDebug['used_username'] ?? null,
                    'token_tail' => $providerDebug['token_tail'] ?? null,
                    'http_status' => $providerDebug['http_status'] ?? null,
                    'provider_status' => $providerDebug['provider_status'] ?? null,
                    'provider_message' => $providerDebug['provider_message'] ?? null,
                ],
            ], 502);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'provider_requested' => $providerRequested,
                'provider_selected' => $providerSelected,
                'pilot' => $pilot,
                'dry_run' => $dryRun,
                'sent' => $dryRun ? null : $sent,
                'phone_masked' => $this->maskPhone($phone),
                'config_health' => $configHealth,
                'code' => $revealCode ? $code : null,
                'resolved_source' => $providerDebug['resolved_source'] ?? null,
                'resolved_destination' => $providerDebug['resolved_destination'] ?? null,
                'used_username' => $providerDebug['used_username'] ?? null,
                'token_tail' => $providerDebug['token_tail'] ?? null,
                'http_status' => $providerDebug['http_status'] ?? null,
                'provider_status' => $providerDebug['provider_status'] ?? null,
                'provider_message' => $providerDebug['provider_message'] ?? null,
            ],
        ]);
    }

    /**
     * Impersonation - כניסה כמסעדה (Context Switch)
     */
    public function impersonate(Request $request, $restaurantId)
    {
        $restaurant = Restaurant::findOrFail($restaurantId);

        $owner = User::where('restaurant_id', $restaurant->id)
            ->where('role', 'owner')
            ->first();

        Log::info('Super admin impersonation', [
            'super_admin_id' => $request->user()->id,
            'restaurant_id' => $restaurant->id,
            'tenant_id' => $restaurant->tenant_id,
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'tenant_id' => $restaurant->tenant_id,
                'restaurant_id' => $restaurant->id,
                'restaurant_name' => $restaurant->name,
                'owner_name' => $owner?->name,
                'owner_email' => $owner?->email,
            ],
        ]);
    }

    private function normalizePhoneE164(string $raw): string
    {
        $phone = preg_replace('/\s+/', '', $raw);
        if (str_starts_with($phone, '0')) {
            return '+972' . substr($phone, 1);
        }
        return $phone;
    }

    private function maskPhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if ($digits === '') {
            return '***';
        }
        $last4 = substr($digits, -4);
        return '***' . $last4;
    }

    private function formatPhoneForDisplay(string $raw): string
    {
        $phone = preg_replace('/\D/', '', $raw);
        if (strlen($phone) === 10 && str_starts_with($phone, '05')) {
            return substr($phone, 0, 3) . '-' . substr($phone, 3);
        }
        if (strlen($phone) === 9 && str_starts_with($phone, '0')) {
            return substr($phone, 0, 2) . '-' . substr($phone, 2);
        }
        return $raw;
    }
}
