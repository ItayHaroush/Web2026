<?php

namespace App\Http\Controllers;

use App\Mail\WelcomeMail;
use App\Mail\TrialInfoMail;
use App\Mail\TrialExpiringMail;
use App\Mail\RestaurantApprovedMail;
use App\Mail\MonthlyReportMail;
use App\Mail\CustomMail;
use App\Models\Restaurant;
use App\Models\User;
use App\Models\Order;
use App\Models\Kiosk;
use App\Models\MonthlyInvoice;
use App\Models\RestaurantSubscription;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class SuperAdminEmailController extends Controller
{
    /**
     * רשימת כל תבניות המייל הזמינות
     */
    public function getTemplates()
    {
        $templates = [
            [
                'type' => 'welcome',
                'name' => 'ברכת הצטרפות',
                'description' => 'נשלח אוטומטית בסיום תהליך הרשמת מסעדה חדשה',
                'trigger' => 'auto',
                'requires_restaurant' => true,
            ],
            [
                'type' => 'trial_info',
                'name' => 'מידע תקופת ניסיון',
                'description' => 'טיפים ומידע על המערכת, נשלח ביום 3 ו-7 של הניסיון',
                'trigger' => 'scheduled',
                'requires_restaurant' => true,
            ],
            [
                'type' => 'trial_expiring',
                'name' => 'תזכורת סיום ניסיון',
                'description' => 'תזכורת 3 ימים ויום אחד לפני סיום תקופת הניסיון',
                'trigger' => 'scheduled',
                'requires_restaurant' => true,
            ],
            [
                'type' => 'restaurant_approved',
                'name' => 'אישור מסעדה',
                'description' => 'נשלח אוטומטית כשסופר אדמין מאשר מסעדה',
                'trigger' => 'auto',
                'requires_restaurant' => true,
            ],
            [
                'type' => 'monthly_report',
                'name' => 'דוח חודשי',
                'description' => 'דוח סיכום חודשי לסופר אדמין עם סטטיסטיקות מערכת',
                'trigger' => 'scheduled',
                'requires_restaurant' => false,
            ],
            [
                'type' => 'custom',
                'name' => 'הודעה מותאמת אישית',
                'description' => 'שליחת הודעה חופשית עם תבנית TakeEat',
                'trigger' => 'manual',
                'requires_restaurant' => false,
            ],
        ];

        return response()->json([
            'success' => true,
            'data' => $templates,
        ]);
    }

    /**
     * תצוגה מקדימה של תבנית עם נתוני דוגמה
     */
    public function previewTemplate(Request $request, string $type)
    {
        $restaurantId = $request->query('restaurant_id');
        $restaurant = $restaurantId
            ? Restaurant::find($restaurantId)
            : $this->getSampleRestaurant();

        $html = match ($type) {
            'welcome' => $this->buildWelcomePreview($restaurant),
            'trial_info' => $this->buildTrialInfoPreview($restaurant),
            'trial_expiring' => $this->buildTrialExpiringPreview($restaurant),
            'restaurant_approved' => $this->buildApprovedPreview($restaurant),
            'monthly_report' => $this->buildMonthlyReportPreview(),
            'custom' => $this->buildCustomPreview(),
            default => null,
        };

        if ($html === null) {
            return response()->json([
                'success' => false,
                'message' => 'סוג תבנית לא חוקי',
            ], 400);
        }

        return response($html, 200)->header('Content-Type', 'text/html; charset=UTF-8');
    }

    /**
     * שליחת מייל בדיקה/דוגמה
     */
    public function sendTestEmail(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|string|in:welcome,trial_info,trial_expiring,restaurant_approved,monthly_report,custom',
            'email' => 'required|email',
            'restaurant_id' => 'nullable|integer|exists:restaurants,id',
            'subject' => 'nullable|string|max:255',
            'body' => 'nullable|string|max:5000',
            'recipient_name' => 'nullable|string|max:255',
        ]);

        $type = $validated['type'];
        $email = $validated['email'];
        $restaurantId = $validated['restaurant_id'] ?? null;
        $restaurant = $restaurantId
            ? Restaurant::find($restaurantId)
            : $this->getSampleRestaurant();

        try {
            $mailable = match ($type) {
                'welcome' => $this->buildWelcomeMail($restaurant),
                'trial_info' => $this->buildTrialInfoMail($restaurant),
                'trial_expiring' => $this->buildTrialExpiringMail($restaurant),
                'restaurant_approved' => $this->buildApprovedMail($restaurant),
                'monthly_report' => $this->buildMonthlyReportMail(),
                'custom' => new CustomMail(
                    $validated['subject'] ?? 'הודעה מ-TakeEat',
                    $validated['body'] ?? 'זוהי הודעת בדיקה ממערכת TakeEat.',
                    $validated['recipient_name'] ?? null,
                ),
            };

            Mail::to($email)->send($mailable);

            Log::info('Test email sent by super admin', [
                'type' => $type,
                'email' => $email,
                'restaurant_id' => $restaurantId,
                'user_id' => $request->user()->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => "מייל {$type} נשלח בהצלחה ל-{$email}",
                'sent_to' => $email,
            ]);
        } catch (\Exception $e) {
            Log::error('Test email failed', [
                'type' => $type,
                'email' => $email,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'שליחת המייל נכשלה: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * שליחה גורפת לכל המסעדות / לפי פילטר
     */
    public function sendBulkEmail(Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|string|in:custom,trial_info,trial_expiring',
            'subject' => 'nullable|string|max:255',
            'body' => 'nullable|string|max:5000',
            'filter' => 'nullable|string|in:all,active,trial,approved,pending',
        ]);

        $type = $validated['type'];
        $filter = $validated['filter'] ?? 'all';

        $query = Restaurant::query();
        switch ($filter) {
            case 'active':
                $query->where('is_approved', true)->where('is_open', true);
                break;
            case 'trial':
                $query->where('subscription_status', 'trial');
                break;
            case 'approved':
                $query->where('is_approved', true);
                break;
            case 'pending':
                $query->where('is_approved', false);
                break;
        }

        $restaurants = $query->get();
        $sent = 0;
        $failed = 0;
        $errors = [];

        foreach ($restaurants as $restaurant) {
            $owner = User::where('restaurant_id', $restaurant->id)
                ->where('role', 'owner')
                ->first();

            if (!$owner || !$owner->email) {
                $failed++;
                continue;
            }

            try {
                $mailable = match ($type) {
                    'custom' => new CustomMail(
                        $validated['subject'] ?? 'הודעה מ-TakeEat',
                        $validated['body'] ?? '',
                        $owner->name,
                    ),
                    'trial_info' => $this->buildTrialInfoMail($restaurant),
                    'trial_expiring' => $this->buildTrialExpiringMail($restaurant),
                };

                Mail::to($owner->email)->send($mailable);
                $sent++;
            } catch (\Exception $e) {
                $failed++;
                $errors[] = [
                    'restaurant' => $restaurant->name,
                    'email' => $owner->email,
                    'error' => $e->getMessage(),
                ];
            }
        }

        Log::info('Bulk email sent by super admin', [
            'type' => $type,
            'filter' => $filter,
            'sent' => $sent,
            'failed' => $failed,
            'user_id' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => "נשלחו {$sent} מיילים, {$failed} נכשלו",
            'data' => [
                'sent' => $sent,
                'failed' => $failed,
                'total' => $restaurants->count(),
                'errors' => array_slice($errors, 0, 10),
            ],
        ]);
    }

    // ========================================
    // Private helpers
    // ========================================

    private function getSampleRestaurant(): Restaurant
    {
        return Restaurant::first() ?? new Restaurant([
            'name' => 'מסעדת דוגמה',
            'tenant_id' => 'demo-restaurant',
            'tier' => 'pro',
            'trial_ends_at' => now()->addDays(10),
            'subscription_status' => 'trial',
        ]);
    }

    private function getOwnerForRestaurant(Restaurant $restaurant): ?User
    {
        return User::where('restaurant_id', $restaurant->id)
            ->where('role', 'owner')
            ->first();
    }

    // ---- Build Mailable instances ----

    private function buildWelcomeMail(Restaurant $restaurant): WelcomeMail
    {
        $owner = $this->getOwnerForRestaurant($restaurant);
        return new WelcomeMail(
            $restaurant,
            $owner->name ?? 'בעל המסעדה',
            $owner->email ?? 'demo@takeeat.co.il',
        );
    }

    private function buildTrialInfoMail(Restaurant $restaurant): TrialInfoMail
    {
        $ordersQuery = Order::where('restaurant_id', $restaurant->id)->where('is_test', false);
        $stats = [
            'categories' => $restaurant->categories()->count(),
            'menu_items' => $restaurant->menuItems()->count(),
            'orders' => (clone $ordersQuery)->count(),
            'web_orders' => (clone $ordersQuery)->where('source', 'web')->count(),
            'kiosk_orders' => (clone $ordersQuery)->where('source', 'kiosk')->count(),
        ];
        $dayNumber = $restaurant->created_at
            ? (int) $restaurant->created_at->diffInDays(now())
            : 3;

        return new TrialInfoMail($restaurant, max(1, $dayNumber), $stats);
    }

    private function buildTrialExpiringMail(Restaurant $restaurant): TrialExpiringMail
    {
        $daysRemaining = $restaurant->trial_ends_at
            ? max(0, (int) now()->diffInDays($restaurant->trial_ends_at, false))
            : 3;
        $ordersQuery = Order::where('restaurant_id', $restaurant->id)->where('is_test', false);
        $usageSummary = [
            'orders' => (clone $ordersQuery)->count(),
            'web_orders' => (clone $ordersQuery)->where('source', 'web')->count(),
            'kiosk_orders' => (clone $ordersQuery)->where('source', 'kiosk')->count(),
            'menu_items' => $restaurant->menuItems()->count(),
        ];

        return new TrialExpiringMail($restaurant, $daysRemaining, $usageSummary);
    }

    private function buildApprovedMail(Restaurant $restaurant): RestaurantApprovedMail
    {
        $owner = $this->getOwnerForRestaurant($restaurant);
        return new RestaurantApprovedMail($restaurant, $owner->name ?? 'בעל המסעדה');
    }

    private function buildMonthlyReportMail(): MonthlyReportMail
    {
        $month = now()->subMonth()->format('Y-m');
        $reportData = $this->gatherMonthlyReportData($month);
        return new MonthlyReportMail($month, $reportData);
    }

    // ---- Build Preview HTML ----

    private function buildWelcomePreview(Restaurant $restaurant): string
    {
        return $this->buildWelcomeMail($restaurant)->render();
    }

    private function buildTrialInfoPreview(Restaurant $restaurant): string
    {
        return $this->buildTrialInfoMail($restaurant)->render();
    }

    private function buildTrialExpiringPreview(Restaurant $restaurant): string
    {
        return $this->buildTrialExpiringMail($restaurant)->render();
    }

    private function buildApprovedPreview(Restaurant $restaurant): string
    {
        return $this->buildApprovedMail($restaurant)->render();
    }

    private function buildMonthlyReportPreview(): string
    {
        return $this->buildMonthlyReportMail()->render();
    }

    private function buildCustomPreview(): string
    {
        $mail = new CustomMail(
            'הודעה לדוגמה מ-TakeEat',
            "שלום! זוהי הודעה לדוגמה ממערכת TakeEat.\n\nניתן לשלוח הודעות מותאמות אישית לכל מסעדה או בצורה גורפת.\n\nתודה שאתם חלק מ-TakeEat!",
            'ישראל ישראלי',
        );
        return $mail->render();
    }

    /**
     * אוסף נתוני דוח חודשי (כולל פילוח web/kiosk)
     */
    public function gatherMonthlyReportData(string $month): array
    {
        $parts = explode('-', $month);
        $year = (int) $parts[0];
        $mon = (int) $parts[1];
        $start = "{$month}-01 00:00:00";
        $end = date('Y-m-t 23:59:59', mktime(0, 0, 0, $mon, 1, $year));

        // שאילתת בסיס - כל ההזמנות מכל המסעדות (ללא סינון tenant)
        $baseQuery = fn() => Order::withoutGlobalScopes()
            ->whereBetween('created_at', [$start, $end])
            ->whereNotIn('status', ['cancelled'])
            ->where('is_test', false);

        // סה״כ הזמנות
        $totalOrders = $baseQuery()->count();
        $totalRevenue = $baseQuery()->sum('total_amount');

        // הזמנות אתר (כולל NULL שהוא ברירת מחדל)
        $webOrders = $baseQuery()->where(function ($q) {
            $q->where('source', 'web')->orWhereNull('source');
        })->count();
        $webRevenue = $baseQuery()->where(function ($q) {
            $q->where('source', 'web')->orWhereNull('source');
        })->sum('total_amount');

        // הזמנות קיוסק
        $kioskOrders = $baseQuery()->where('source', 'kiosk')->count();
        $kioskRevenue = $baseQuery()->where('source', 'kiosk')->sum('total_amount');

        // קיוסקים פעילים
        $activeKiosks = Kiosk::withoutGlobalScopes()->where('is_active', true)->count();
        $totalKiosks = Kiosk::withoutGlobalScopes()->count();

        $newRestaurants = Restaurant::withoutGlobalScopes()
            ->whereBetween('created_at', [$start, $end])->count();

        // MRR — חישוב לפי מנויים שהיו פעילים בחודש הנתון
        $mrr = 0;
        try {
            $mrr = RestaurantSubscription::where('status', 'active')
                ->where('created_at', '<=', $end)
                ->sum('monthly_fee');
        } catch (\Exception $e) {
        }

        $invoicesSent = MonthlyInvoice::where('month', $month)->count();
        $invoicesPaid = MonthlyInvoice::where('month', $month)->where('status', 'paid')->count();
        $outstandingAmount = MonthlyInvoice::where('month', $month)
            ->whereIn('status', ['pending', 'overdue'])
            ->sum('total_due');

        // טופ מסעדות (כולל פילוח web/kiosk) — ללא סינון tenant
        $topRestaurants = Restaurant::withoutGlobalScopes()
            ->withCount(['orders as month_orders' => function ($q) use ($start, $end) {
                $q->whereBetween('created_at', [$start, $end])
                    ->whereNotIn('status', ['cancelled'])
                    ->where('is_test', false);
            }])
            ->withCount(['orders as web_orders' => function ($q) use ($start, $end) {
                $q->whereBetween('created_at', [$start, $end])
                    ->whereNotIn('status', ['cancelled'])
                    ->where('is_test', false)
                    ->where(function ($sq) {
                        $sq->where('source', 'web')->orWhereNull('source');
                    });
            }])
            ->withCount(['orders as kiosk_orders' => function ($q) use ($start, $end) {
                $q->whereBetween('created_at', [$start, $end])
                    ->whereNotIn('status', ['cancelled'])
                    ->where('is_test', false)
                    ->where('source', 'kiosk');
            }])
            ->withSum(['orders as month_revenue' => function ($q) use ($start, $end) {
                $q->whereBetween('created_at', [$start, $end])
                    ->whereNotIn('status', ['cancelled'])
                    ->where('is_test', false);
            }], 'total_amount')
            ->orderByDesc('month_orders')
            ->limit(10)
            ->get()
            ->map(fn($r) => [
                'name' => $r->name,
                'orders' => $r->month_orders ?? 0,
                'web_orders' => $r->web_orders ?? 0,
                'kiosk_orders' => $r->kiosk_orders ?? 0,
                'revenue' => $r->month_revenue ?? 0,
            ])
            ->toArray();

        return [
            'total_restaurants' => Restaurant::withoutGlobalScopes()->count(),
            'active_restaurants' => Restaurant::withoutGlobalScopes()
                ->where('is_approved', true)->where('is_open', true)->count(),
            'trial_restaurants' => Restaurant::withoutGlobalScopes()
                ->where('subscription_status', 'trial')->count(),
            'new_restaurants' => $newRestaurants,
            'total_orders' => $totalOrders,
            'total_revenue' => $totalRevenue,
            'web_orders' => $webOrders,
            'web_revenue' => $webRevenue,
            'kiosk_orders' => $kioskOrders,
            'kiosk_revenue' => $kioskRevenue,
            'active_kiosks' => $activeKiosks,
            'total_kiosks' => $totalKiosks,
            'mrr' => $mrr,
            'invoices_sent' => $invoicesSent,
            'invoices_paid' => $invoicesPaid,
            'outstanding_amount' => $outstandingAmount,
            'top_restaurants' => $topRestaurants,
        ];
    }
}
