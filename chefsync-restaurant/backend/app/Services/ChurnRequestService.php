<?php

namespace App\Services;

use App\Mail\ChurnRequestMail;
use App\Models\MonitoringAlert;
use App\Models\NotificationLog;
use App\Models\Restaurant;
use App\Models\RestaurantSubscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ChurnRequestService
{
    public const REASONS = [
        'closing_business' => 'סגירת העסק',
        'too_expensive' => 'יקר מדי',
        'switching_provider' => 'מעבר למתחרה',
        'not_using' => 'לא משתמשים במערכת',
        'missing_features' => 'חסרים פיצ\'רים',
        'other' => 'אחר',
    ];

    public static function reasonLabel(?string $reason): string
    {
        return self::REASONS[$reason] ?? ($reason ?: 'לא צוין');
    }

    public static function notifySuperAdmins(Restaurant $restaurant, User $requestedBy, string $reason, ?string $note, ?string $effectiveDate): void
    {
        $reasonLabel = self::reasonLabel($reason);
        $dateLabel = $effectiveDate
            ? \Carbon\Carbon::parse($effectiveDate)->format('d/m/Y')
            : 'לא צוין';

        try {
            MonitoringAlert::withoutGlobalScopes()->create([
                'tenant_id'     => $restaurant->tenant_id,
                'restaurant_id' => $restaurant->id,
                'alert_type'    => 'churn_request',
                'title'         => "בקשת סיום: {$restaurant->name}",
                'body'          => "המסעדן ביקש לסיים התקשרות. סיבה: {$reasonLabel}. תאריך מבוקש: {$dateLabel}.",
                'severity'      => 'warning',
                'metadata'      => [
                    'restaurant_id' => $restaurant->id,
                    'reason'        => $reason,
                    'requested_by'  => $requestedBy->id,
                ],
                'is_read'       => false,
            ]);
        } catch (\Throwable $e) {
            Log::warning('ChurnRequestService: MonitoringAlert failed', ['error' => $e->getMessage()]);
        }

        try {
            NotificationLog::create([
                'channel'               => 'system',
                'type'                  => 'churn_request',
                'title'                 => "בקשת סיום התקשרות: {$restaurant->name}",
                'body'                  => "סיבה: {$reasonLabel}. הערה: " . ($note ?: '—') . ". תאריך מבוקש: {$dateLabel}.",
                'sender_id'             => $requestedBy->id,
                'target_restaurant_ids' => [$restaurant->id],
                'tokens_targeted'       => 0,
                'sent_ok'               => 0,
                'metadata'              => [
                    'action'        => 'churn_request',
                    'restaurant_id' => $restaurant->id,
                    'reason'        => $reason,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('ChurnRequestService: NotificationLog failed', ['error' => $e->getMessage()]);
        }

        $superAdminEmails = User::where('is_super_admin', true)
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->pluck('email')
            ->unique()
            ->values()
            ->all();

        foreach ($superAdminEmails as $email) {
            try {
                Mail::to($email)->send(new ChurnRequestMail(
                    $restaurant,
                    $requestedBy,
                    $reasonLabel,
                    $note,
                    $effectiveDate,
                ));
            } catch (\Throwable $e) {
                Log::warning('ChurnRequestService: mail failed', ['email' => $email, 'error' => $e->getMessage()]);
            }
        }
    }

    public static function clearRequestFields(Restaurant $restaurant): void
    {
        $restaurant->update([
            'deletion_requested_at'              => null,
            'cancellation_reason'                => null,
            'cancellation_note'                  => null,
            'cancellation_effective_date'        => null,
            'cancellation_requested_by_user_id'  => null,
        ]);
    }

    public static function approve(Restaurant $restaurant, User $admin, ?string $adminNote = null): void
    {
        $reason = $restaurant->cancellation_reason;
        $reasonLabel = self::reasonLabel($reason);

        DB::transaction(function () use ($restaurant, $admin, $adminNote, $reasonLabel) {
            $restaurant->update([
                'subscription_status'  => 'cancelled',
                'is_open'              => false,
                'is_approved'          => false,
                'subscription_ends_at' => now(),
                'next_payment_at'      => null,
                'payment_failed_at'    => null,
                'payment_failure_count'=> 0,
            ]);

            $subscription = RestaurantSubscription::where('restaurant_id', $restaurant->id)->first();
            if ($subscription) {
                $noteLine = now()->format('Y-m-d') . ' - בקשת סיום אושרה על ידי סופר-אדמין';
                if ($adminNote) {
                    $noteLine .= ': ' . $adminNote;
                }
                if ($reasonLabel) {
                    $noteLine .= " (סיבה: {$reasonLabel})";
                }
                $subscription->update([
                    'status'         => 'cancelled',
                    'next_charge_at' => null,
                    'notes'          => trim(($subscription->notes ?? '') . "\n" . $noteLine),
                ]);
            }

            self::clearRequestFields($restaurant);

            MonitoringAlert::withoutGlobalScopes()
                ->where('restaurant_id', $restaurant->id)
                ->where('alert_type', 'churn_request')
                ->where('is_read', false)
                ->update(['is_read' => true]);
        });

        try {
            NotificationLog::create([
                'channel'               => 'system',
                'type'                  => 'churn_approved',
                'title'                 => "סיום התקשרות אושר: {$restaurant->name}",
                'body'                  => "המנוי בוטל, האישור הוסר והמסעדה נסגרה ללקוחות. ({$admin->name})",
                'sender_id'             => $admin->id,
                'target_restaurant_ids' => [$restaurant->id],
                'tokens_targeted'       => 0,
                'sent_ok'               => 0,
                'metadata'              => ['action' => 'churn_approved', 'restaurant_id' => $restaurant->id],
            ]);
        } catch (\Throwable $e) {
            Log::warning('ChurnRequestService: approve NotificationLog failed', ['error' => $e->getMessage()]);
        }

        Log::info('ChurnRequestService: cancellation approved', [
            'restaurant_id' => $restaurant->id,
            'admin_id'      => $admin->id,
        ]);
    }

    public static function dismiss(Restaurant $restaurant, User $admin, ?string $adminNote = null): void
    {
        self::clearRequestFields($restaurant);

        MonitoringAlert::withoutGlobalScopes()
            ->where('restaurant_id', $restaurant->id)
            ->where('alert_type', 'churn_request')
            ->where('is_read', false)
            ->update(['is_read' => true]);

        try {
            NotificationLog::create([
                'channel'               => 'system',
                'type'                  => 'churn_dismissed',
                'title'                 => "בקשת סיום נדחתה: {$restaurant->name}",
                'body'                  => ($adminNote ?: 'הבקשה נסגרה ללא ביטול מנוי.') . " ({$admin->name})",
                'sender_id'             => $admin->id,
                'target_restaurant_ids' => [$restaurant->id],
                'tokens_targeted'       => 0,
                'sent_ok'               => 0,
                'metadata'              => ['action' => 'churn_dismissed', 'restaurant_id' => $restaurant->id],
            ]);
        } catch (\Throwable $e) {
            Log::warning('ChurnRequestService: dismiss NotificationLog failed', ['error' => $e->getMessage()]);
        }
    }

    public static function cancellationPayload(Restaurant $restaurant): array
    {
        $pending = $restaurant->deletion_requested_at !== null;

        return [
            'pending'          => $pending,
            'requested_at'     => $restaurant->deletion_requested_at,
            'reason'           => $restaurant->cancellation_reason,
            'reason_label'     => self::reasonLabel($restaurant->cancellation_reason),
            'note'             => $restaurant->cancellation_note,
            'effective_date'   => $restaurant->cancellation_effective_date,
            'reason_options'   => collect(self::REASONS)->map(fn ($label, $key) => ['value' => $key, 'label' => $label])->values(),
        ];
    }
}
