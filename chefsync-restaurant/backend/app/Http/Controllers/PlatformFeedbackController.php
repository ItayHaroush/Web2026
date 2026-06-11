<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Order;
use App\Models\PlatformFeedback;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * משוב פלטפורמה ממשתמשי קצה:
 * - לקוח רשום עם לפחות הזמנה אחת שנמסרה יכול לשלוח משוב
 * - סופר אדמין רואה ומנהל את כל המשובים
 */
class PlatformFeedbackController extends Controller
{
    /** מקסימום משובים ללקוח ב-24 שעות (מניעת ספאם) */
    private const MAX_PER_DAY = 3;

    /**
     * האם הלקוח זכאי לשלוח משוב (רשום + הזמנה שנמסרה לפחות פעם אחת)
     */
    public function eligibility(Request $request)
    {
        $customer = $request->customer;

        return response()->json([
            'success' => true,
            'data' => [
                'eligible' => $this->isEligible($customer),
            ],
        ]);
    }

    /**
     * שליחת משוב ע"י לקוח מאומת
     */
    public function store(Request $request)
    {
        $customer = $request->customer;

        if (!$this->isEligible($customer)) {
            return response()->json([
                'success' => false,
                'message' => 'שליחת משוב זמינה ללקוחות רשומים שביצעו לפחות הזמנה אחת',
            ], 403);
        }

        $recentCount = PlatformFeedback::where('customer_id', $customer->id)
            ->where('created_at', '>=', now()->subDay())
            ->count();

        if ($recentCount >= self::MAX_PER_DAY) {
            return response()->json([
                'success' => false,
                'message' => 'שלחת כבר מספר משובים היום, נסה שוב מחר. תודה!',
            ], 429);
        }

        $validated = $request->validate([
            'category' => ['required', Rule::in(PlatformFeedback::CATEGORIES)],
            'rating' => 'nullable|integer|min:1|max:5',
            'message' => 'required|string|min:3|max:2000',
            'page_url' => 'nullable|string|max:500',
        ]);

        $feedback = PlatformFeedback::create([
            'customer_id' => $customer->id,
            'category' => $validated['category'],
            'rating' => $validated['rating'] ?? null,
            'message' => $validated['message'],
            'page_url' => $validated['page_url'] ?? null,
            'status' => 'new',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'תודה! המשוב התקבל ויעזור לנו להשתפר',
            'data' => ['id' => $feedback->id],
        ], 201);
    }

    /**
     * רשימת משובים לסופר אדמין (paginated + פילטרים)
     */
    public function index(Request $request)
    {
        $query = PlatformFeedback::with([
            'customer:id,name,phone,email,total_orders',
            'handler:id,name',
        ]);

        if ($request->filled('status') && in_array($request->status, PlatformFeedback::STATUSES)) {
            $query->where('status', $request->status);
        }

        if ($request->filled('category') && in_array($request->category, PlatformFeedback::CATEGORIES)) {
            $query->where('category', $request->category);
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->search);
            $query->where(function ($q) use ($search) {
                $q->where('message', 'like', "%{$search}%")
                    ->orWhereHas('customer', function ($cq) use ($search) {
                        $cq->where('name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%");
                    });
            });
        }

        $feedback = $query->orderByDesc('created_at')->paginate(20);

        $stats = [
            'total' => PlatformFeedback::count(),
            'new' => PlatformFeedback::where('status', 'new')->count(),
            'in_review' => PlatformFeedback::where('status', 'in_review')->count(),
            'resolved' => PlatformFeedback::where('status', 'resolved')->count(),
            'avg_rating' => round((float) PlatformFeedback::whereNotNull('rating')->avg('rating'), 1),
        ];

        return response()->json([
            'success' => true,
            'data' => $feedback,
            'stats' => $stats,
        ]);
    }

    /**
     * עדכון סטטוס טיפול / הערות פנימיות
     */
    public function update(Request $request, int $id)
    {
        $feedback = PlatformFeedback::findOrFail($id);

        $validated = $request->validate([
            'status' => ['sometimes', Rule::in(PlatformFeedback::STATUSES)],
            'admin_notes' => 'nullable|string|max:2000',
        ]);

        if (isset($validated['status']) && $validated['status'] !== $feedback->status) {
            $validated['handled_by'] = $request->user()->id;
            $validated['handled_at'] = now();
        }

        $feedback->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'המשוב עודכן',
            'data' => $feedback->fresh(['customer:id,name,phone,email,total_orders', 'handler:id,name']),
        ]);
    }

    /**
     * מחיקת משוב
     */
    public function destroy(int $id)
    {
        PlatformFeedback::findOrFail($id)->delete();

        return response()->json([
            'success' => true,
            'message' => 'המשוב נמחק',
        ]);
    }

    /**
     * לקוח רשום + לפחות הזמנה אחת שנמסרה (בכל המסעדות)
     */
    private function isEligible(?Customer $customer): bool
    {
        if (!$customer || !$customer->is_registered) {
            return false;
        }

        return Order::withoutGlobalScope('tenant')
            ->where('customer_id', $customer->id)
            ->where('status', Order::STATUS_DELIVERED)
            ->exists();
    }
}
