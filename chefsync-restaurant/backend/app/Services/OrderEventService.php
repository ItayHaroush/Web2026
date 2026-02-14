<?php

namespace App\Services;

use App\Models\OrderEvent;
use App\Models\Order;
use Illuminate\Http\Request;

class OrderEventService
{
    /**
     * Log an order event
     */
    public static function log(
        int $orderId,
        string $eventType,
        string $actorType,
        ?int $actorId = null,
        ?array $payload = null,
        ?Request $request = null
    ): OrderEvent {
        $order = Order::withoutGlobalScopes()->find($orderId);

        return OrderEvent::create([
            'tenant_id' => $order?->tenant_id ?? '',
            'order_id' => $orderId,
            'event_type' => $eventType,
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'payload' => $payload,
            'ip_address' => $request?->ip(),
            'correlation_id' => $order?->correlation_id,
        ]);
    }

    /**
     * Log a status change event
     */
    public static function logStatusChange(
        int $orderId,
        ?string $oldStatus,
        string $newStatus,
        string $actorType,
        ?int $actorId = null,
        ?Request $request = null
    ): OrderEvent {
        $order = Order::withoutGlobalScopes()->find($orderId);

        return OrderEvent::create([
            'tenant_id' => $order?->tenant_id ?? '',
            'order_id' => $orderId,
            'event_type' => 'status_changed',
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'ip_address' => $request?->ip(),
            'correlation_id' => $order?->correlation_id,
        ]);
    }
}
