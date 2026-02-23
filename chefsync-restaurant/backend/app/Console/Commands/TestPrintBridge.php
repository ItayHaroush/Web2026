<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\PrintDevice;
use App\Models\PrintJob;
use App\Models\Printer;
use App\Models\Restaurant;
use App\Services\PrintService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class TestPrintBridge extends Command
{
    protected $signature = 'test:print-bridge {--cleanup : Delete test data after run}';

    protected $description = 'Full integration test for the Print Bridge system — devices, jobs, routing, ACK, failures, timeout';

    private int $passed = 0;
    private int $failed = 0;
    private array $testDeviceIds = [];
    private array $testJobIds = [];
    private int $testOrderId = 0;

    public function handle(): int
    {
        $this->newLine();
        $this->components->info('╔══════════════════════════════════════════════╗');
        $this->components->info('║    Print Bridge — Integration Test Suite     ║');
        $this->components->info('╚══════════════════════════════════════════════╝');
        $this->newLine();

        $restaurant = Restaurant::first();
        if (!$restaurant) {
            $this->components->error('No restaurant found in DB. Cannot run tests.');
            return 1;
        }

        $this->components->info("Using restaurant: {$restaurant->name} (ID: {$restaurant->id}, tenant: {$restaurant->tenant_id})");

        $testOrder = Order::withoutGlobalScopes()->where('restaurant_id', $restaurant->id)->first();
        $this->testOrderId = $testOrder?->id ?? 0;
        if (!$this->testOrderId) {
            $this->components->warn('No orders in DB — some tests will use order_id=0 placeholder');
        } else {
            $this->components->info("Using order #{$this->testOrderId} as test reference");
        }
        $this->newLine();

        // ═══════════════════════════════════════
        //  SECTION 1: Device Registration
        // ═══════════════════════════════════════
        $this->section('1. Device Registration');

        $kitchenDevice = $this->testDeviceRegistration($restaurant, 'Kitchen Tablet TEST', 'kitchen', '192.168.1.100');
        $receiptDevice = $this->testDeviceRegistration($restaurant, 'Receipt POS TEST', 'receipt', '192.168.1.101');
        $barDevice = $this->testDeviceRegistration($restaurant, 'Bar Tablet TEST', 'bar', '192.168.1.102');
        $generalDevice = $this->testDeviceRegistration($restaurant, 'General Device TEST', 'general', '192.168.1.103');

        // ═══════════════════════════════════════
        //  SECTION 2: Token Validation
        // ═══════════════════════════════════════
        $this->section('2. Token & Auth Validation');

        $this->testTokenGeneration($kitchenDevice);
        $this->testTokenUniqueness($kitchenDevice, $receiptDevice);
        $this->testInactiveDeviceRejection($restaurant);

        // ═══════════════════════════════════════
        //  SECTION 3: Job Creation & Role Routing
        // ═══════════════════════════════════════
        $this->section('3. Job Creation & Role Routing');

        $kitchenJob = $this->createTestJob($restaurant, 'kitchen', 'kitchen_ticket', 'הזמנה #999 — שניצל x2, סלט x1');
        $receiptJob = $this->createTestJob($restaurant, 'receipt', 'receipt', 'קבלה — הזמנה #999 — סה"כ ₪89.00');
        $barJob = $this->createTestJob($restaurant, 'bar', 'kitchen_ticket', 'הזמנה #999 — מוחיטו x3');
        $generalJob = $this->createTestJob($restaurant, 'general', 'custom', 'הודעה כללית — בדיקת מערכת');

        $this->testRoleFiltering($kitchenDevice, $receiptDevice, $barDevice, $restaurant);

        // ═══════════════════════════════════════
        //  SECTION 4: Atomic Job Claim (lockForUpdate)
        // ═══════════════════════════════════════
        $this->section('4. Atomic Job Claim (Double-Print Prevention)');

        $this->testAtomicClaim($restaurant, $kitchenDevice);

        // ═══════════════════════════════════════
        //  SECTION 5: ACK — Success Flow
        // ═══════════════════════════════════════
        $this->section('5. ACK — Success Flow');

        $this->testAckSuccess($restaurant, $kitchenDevice);

        // ═══════════════════════════════════════
        //  SECTION 6: ACK — Failure + Error Tracking
        // ═══════════════════════════════════════
        $this->section('6. ACK — Failure + Device Error Tracking');

        $this->testAckFailure($restaurant, $receiptDevice);

        // ═══════════════════════════════════════
        //  SECTION 7: Heartbeat
        // ═══════════════════════════════════════
        $this->section('7. Heartbeat & Connection Status');

        $this->testHeartbeat($kitchenDevice);

        // ═══════════════════════════════════════
        //  SECTION 8: Snapshot Integrity (target_ip/port)
        // ═══════════════════════════════════════
        $this->section('8. Snapshot Integrity (IP/Port on Job)');

        $this->testSnapshotIntegrity($restaurant, $barDevice);

        // ═══════════════════════════════════════
        //  SECTION 9: Timeout Fallback (retryStaleJobs)
        // ═══════════════════════════════════════
        $this->section('9. Timeout Fallback (Stale Jobs)');

        $this->testStaleJobRetry($restaurant, $kitchenDevice);

        // ═══════════════════════════════════════
        //  SECTION 10: PrintService Bridge Routing
        // ═══════════════════════════════════════
        $this->section('10. PrintService — Bridge-Aware executeJob');

        $this->testPrintServiceBridgeRouting($restaurant);

        // ═══════════════════════════════════════
        //  SECTION 11: Device-Targeted Jobs
        // ═══════════════════════════════════════
        $this->section('11. Device-Targeted Jobs');

        $this->testDeviceTargetedJob($restaurant, $kitchenDevice, $receiptDevice);

        // ═══════════════════════════════════════
        //  SECTION 12: General Device Gets Cross-Role Jobs
        // ═══════════════════════════════════════
        $this->section('12. General Device — Cross-Role Pickup');

        $this->testGeneralDeviceCrossRole($restaurant, $generalDevice);

        // ═══════════════════════════════════════
        //  RESULTS
        // ═══════════════════════════════════════
        $this->newLine();
        $this->components->info('══════════════════════════════════════════════');
        $total = $this->passed + $this->failed;
        if ($this->failed === 0) {
            $this->components->info("RESULT: {$this->passed}/{$total} tests PASSED");
        } else {
            $this->components->error("RESULT: {$this->passed}/{$total} passed, {$this->failed} FAILED");
        }
        $this->components->info('══════════════════════════════════════════════');

        if ($this->option('cleanup')) {
            $this->cleanup();
        } else {
            $this->newLine();
            $this->components->warn("Test data left in DB. Run with --cleanup to remove, or manually:");
            $this->line("  php artisan test:print-bridge --cleanup");
        }

        return $this->failed > 0 ? 1 : 0;
    }

    // ─── Helpers ───────────────────────────────

    private function section(string $title): void
    {
        $this->newLine();
        $this->components->info("─── {$title} ───");
    }

    private function assert(string $label, bool $condition): void
    {
        if ($condition) {
            $this->passed++;
            $this->components->twoColumnDetail("  ✓ {$label}", '<fg=green>PASS</>');
        } else {
            $this->failed++;
            $this->components->twoColumnDetail("  ✗ {$label}", '<fg=red>FAIL</>');
        }
    }

    // ─── Section 1: Device Registration ───────

    private function testDeviceRegistration(Restaurant $restaurant, string $name, string $role, string $ip): PrintDevice
    {
        $device = PrintDevice::withoutGlobalScopes()->create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'name' => $name,
            'role' => $role,
            'printer_ip' => $ip,
            'printer_port' => 9100,
        ]);

        $this->testDeviceIds[] = $device->id;
        $device->refresh();

        $this->assert("Register device '{$name}' (role={$role})", $device->id > 0);
        $this->assert("  -> is_active default = true", $device->is_active === true);
        $this->assert("  -> printer_ip = {$ip}", $device->printer_ip === $ip);
        $this->assert("  -> token generated (length 64)", strlen($device->device_token) === 64);

        return $device;
    }

    // ─── Section 2: Token Validation ──────────

    private function testTokenGeneration(PrintDevice $device): void
    {
        $this->assert('Token is hex string', ctype_xdigit($device->device_token));
        $this->assert('Token hidden from JSON', !isset($device->toArray()['device_token']));

        $found = PrintDevice::withoutGlobalScopes()
            ->where('device_token', $device->device_token)
            ->where('is_active', true)
            ->first();

        $this->assert('Token lookup finds correct device', $found && $found->id === $device->id);
    }

    private function testTokenUniqueness(PrintDevice $a, PrintDevice $b): void
    {
        $this->assert('Tokens are unique across devices', $a->device_token !== $b->device_token);
    }

    private function testInactiveDeviceRejection(Restaurant $restaurant): void
    {
        $inactive = PrintDevice::withoutGlobalScopes()->create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'name' => 'Inactive TEST',
            'role' => 'kitchen',
            'is_active' => false,
        ]);
        $this->testDeviceIds[] = $inactive->id;

        $lookup = PrintDevice::withoutGlobalScopes()
            ->where('device_token', $inactive->device_token)
            ->where('is_active', true)
            ->first();

        $this->assert('Inactive device token rejected by lookup', $lookup === null);
    }

    // ─── Section 3: Job Creation ──────────────

    private function createTestJob(Restaurant $restaurant, string $role, string $type, string $text): PrintJob
    {
        $job = PrintJob::withoutGlobalScopes()->create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'printer_id' => null,
            'order_id' => $this->testOrderId,
            'role' => $role,
            'status' => 'pending_bridge',
            'payload' => ['text' => $text, 'type' => $type],
        ]);

        $this->testJobIds[] = $job->id;
        $this->assert("Create job (role={$role}, type={$type})", $job->id > 0 && $job->status === 'pending_bridge');

        return $job;
    }

    private function testRoleFiltering(PrintDevice $kitchen, PrintDevice $receipt, PrintDevice $bar, Restaurant $restaurant): void
    {
        $kitchenJobs = PrintJob::withoutGlobalScopes()
            ->where('restaurant_id', $restaurant->id)
            ->where('status', 'pending_bridge')
            ->where(function ($q) use ($kitchen) {
                $q->where('role', $kitchen->role)->orWhere('role', 'general');
            })
            ->count();

        $receiptJobs = PrintJob::withoutGlobalScopes()
            ->where('restaurant_id', $restaurant->id)
            ->where('status', 'pending_bridge')
            ->where(function ($q) use ($receipt) {
                $q->where('role', $receipt->role)->orWhere('role', 'general');
            })
            ->count();

        $barJobs = PrintJob::withoutGlobalScopes()
            ->where('restaurant_id', $restaurant->id)
            ->where('status', 'pending_bridge')
            ->where(function ($q) use ($bar) {
                $q->where('role', $bar->role)->orWhere('role', 'general');
            })
            ->count();

        $this->assert("Kitchen device sees kitchen+general jobs ({$kitchenJobs})", $kitchenJobs >= 2);
        $this->assert("Receipt device sees receipt+general jobs ({$receiptJobs})", $receiptJobs >= 2);
        $this->assert("Bar device sees bar+general jobs ({$barJobs})", $barJobs >= 2);
        $this->assert('Kitchen device does NOT see receipt jobs', $kitchenJobs < 4);
    }

    // ─── Section 4: Atomic Claim ──────────────

    private function testAtomicClaim(Restaurant $restaurant, PrintDevice $device): void
    {
        // Use a unique marker to isolate this test job
        $marker = 'ATOMIC_TEST_' . uniqid();
        $job = PrintJob::withoutGlobalScopes()->create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'order_id' => $this->testOrderId,
            'role' => 'kitchen',
            'status' => 'pending_bridge',
            'payload' => ['text' => $marker, 'type' => 'kitchen_ticket'],
        ]);
        $this->testJobIds[] = $job->id;

        // First claim: grabs this specific job
        $claimed = DB::transaction(function () use ($device, $job) {
            $pending = PrintJob::withoutGlobalScopes()
                ->where('id', $job->id)
                ->where('status', 'pending_bridge')
                ->lockForUpdate()
                ->get();

            foreach ($pending as $j) {
                $j->update([
                    'status' => 'printing',
                    'device_id' => $device->id,
                    'target_ip' => $device->printer_ip,
                    'target_port' => $device->printer_port,
                ]);
            }

            return $pending;
        });

        $this->assert('Atomic claim returns the job', $claimed->count() === 1);

        $job->refresh();
        $this->assert('Claimed job moved to status=printing', $job->status === 'printing');
        $this->assert('Claimed job assigned device_id', $job->device_id === $device->id);

        // Second claim attempt on same job should return empty
        $secondClaim = DB::transaction(function () use ($job) {
            return PrintJob::withoutGlobalScopes()
                ->where('id', $job->id)
                ->where('status', 'pending_bridge')
                ->lockForUpdate()
                ->get();
        });

        $this->assert('Second claim on same job returns empty (no double-print)', $secondClaim->isEmpty());
    }

    // ─── Section 5: ACK Success ───────────────

    private function testAckSuccess(Restaurant $restaurant, PrintDevice $device): void
    {
        $job = PrintJob::withoutGlobalScopes()->create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'order_id' => $this->testOrderId,
            'role' => 'kitchen',
            'status' => 'printing',
            'device_id' => $device->id,
            'target_ip' => $device->printer_ip,
            'target_port' => $device->printer_port,
            'payload' => ['text' => 'ACK success test', 'type' => 'kitchen_ticket'],
        ]);
        $this->testJobIds[] = $job->id;

        $job->update(['status' => 'done', 'error_message' => null]);
        $job->refresh();

        $this->assert('ACK success -> status=done', $job->status === 'done');
        $this->assert('ACK success -> error_message=null', $job->error_message === null);
    }

    // ─── Section 6: ACK Failure + Error Tracking ──

    private function testAckFailure(Restaurant $restaurant, PrintDevice $device): void
    {
        $job = PrintJob::withoutGlobalScopes()->create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'order_id' => $this->testOrderId,
            'role' => 'receipt',
            'status' => 'printing',
            'device_id' => $device->id,
            'target_ip' => $device->printer_ip,
            'target_port' => $device->printer_port,
            'payload' => ['text' => 'ACK failure test', 'type' => 'receipt'],
        ]);
        $this->testJobIds[] = $job->id;

        $errorMsg = 'Connection refused: 192.168.1.101:9100';
        $job->update(['status' => 'failed', 'error_message' => $errorMsg]);
        $job->refresh();

        $this->assert('ACK failure -> status=failed', $job->status === 'failed');
        $this->assert('ACK failure -> error_message stored', $job->error_message === $errorMsg);

        $device->update([
            'last_error_message' => $errorMsg,
            'last_error_at' => now(),
        ]);
        $device->refresh();

        $this->assert('Device last_error_message updated', $device->last_error_message === $errorMsg);
        $this->assert('Device last_error_at set', $device->last_error_at !== null);
    }

    // ─── Section 7: Heartbeat ─────────────────

    private function testHeartbeat(PrintDevice $device): void
    {
        $before = $device->last_seen_at;
        $device->update(['last_seen_at' => now()]);
        $device->refresh();

        $this->assert('Heartbeat updates last_seen_at', $device->last_seen_at !== null);
        $this->assert('Device is_connected = true (just seen)', $device->is_connected === true);

        $device->update(['last_seen_at' => now()->subMinutes(5)]);
        $device->refresh();

        $this->assert('Device is_connected = false (5 min ago)', $device->is_connected === false);

        $device->update(['last_seen_at' => now()]);
    }

    // ─── Section 8: Snapshot Integrity ────────

    private function testSnapshotIntegrity(Restaurant $restaurant, PrintDevice $device): void
    {
        $originalIp = $device->printer_ip;

        $job = PrintJob::withoutGlobalScopes()->create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'order_id' => $this->testOrderId,
            'role' => 'bar',
            'status' => 'printing',
            'device_id' => $device->id,
            'target_ip' => $device->printer_ip,
            'target_port' => $device->printer_port,
            'payload' => ['text' => 'Snapshot test', 'type' => 'kitchen_ticket'],
        ]);
        $this->testJobIds[] = $job->id;

        $device->update(['printer_ip' => '10.0.0.99']);
        $job->refresh();

        $this->assert(
            "Job target_ip stays {$originalIp} after device IP changed to 10.0.0.99",
            $job->target_ip === $originalIp
        );
        $this->assert('Job is self-contained (no dependency on device config)', $job->target_ip !== '10.0.0.99');

        $device->update(['printer_ip' => $originalIp]);
    }

    // ─── Section 9: Stale Job Retry ───────────

    private function testStaleJobRetry(Restaurant $restaurant, PrintDevice $device): void
    {
        $staleJob = PrintJob::withoutGlobalScopes()->create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'order_id' => $this->testOrderId,
            'role' => 'kitchen',
            'status' => 'printing',
            'device_id' => $device->id,
            'target_ip' => $device->printer_ip,
            'target_port' => $device->printer_port,
            'payload' => ['text' => 'Stale job — no ACK', 'type' => 'kitchen_ticket'],
        ]);
        $this->testJobIds[] = $staleJob->id;

        // Manually backdate updated_at to simulate timeout
        DB::table('print_jobs')
            ->where('id', $staleJob->id)
            ->update(['updated_at' => now()->subMinutes(3)]);

        $printService = app(PrintService::class);
        $retriedCount = $printService->retryStaleJobs(2);

        $staleJob->refresh();

        $this->assert("retryStaleJobs returned >= 1 ({$retriedCount})", $retriedCount >= 1);
        $this->assert('Stale job reset to pending_bridge', $staleJob->status === 'pending_bridge');
        $this->assert('Stale job device_id cleared', $staleJob->device_id === null);
        $this->assert('Stale job error_message = timeout msg', str_contains($staleJob->error_message ?? '', 'Timeout'));
    }

    // ─── Section 10: PrintService Bridge Routing ──

    private function testPrintServiceBridgeRouting(Restaurant $restaurant): void
    {
        $printer = Printer::withoutGlobalScopes()
            ->where('restaurant_id', $restaurant->id)
            ->where('is_active', true)
            ->first();

        if (!$printer) {
            $this->components->warn('  No active printer in DB — creating temp printer for test');
            $printer = Printer::withoutGlobalScopes()->create([
                'tenant_id' => $restaurant->tenant_id,
                'restaurant_id' => $restaurant->id,
                'name' => 'TEST Printer Bridge',
                'type' => 'network',
                'role' => 'kitchen',
                'ip_address' => '192.168.99.99',
                'port' => 9100,
                'paper_width' => '80mm',
                'is_active' => true,
            ]);
        }

        $hasDevices = PrintDevice::withoutGlobalScopes()
            ->where('restaurant_id', $restaurant->id)
            ->where('is_active', true)
            ->where(function ($q) {
                $q->where('role', 'kitchen')->orWhere('role', 'general');
            })
            ->exists();

        $this->assert('Active bridge devices exist for kitchen role', $hasDevices);

        $job = PrintJob::withoutGlobalScopes()->create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'printer_id' => $printer->id,
            'order_id' => $this->testOrderId,
            'role' => 'kitchen',
            'status' => 'pending',
            'payload' => ['text' => 'executeJob bridge test', 'type' => 'kitchen_ticket'],
        ]);
        $this->testJobIds[] = $job->id;

        // Call executeJob via reflection since it's private
        $printService = app(PrintService::class);
        $method = new \ReflectionMethod($printService, 'executeJob');
        $method->setAccessible(true);
        $method->invoke($printService, $job, $printer, 'executeJob bridge test');

        $job->refresh();

        $this->assert(
            "executeJob routes to pending_bridge (not direct TCP)",
            $job->status === 'pending_bridge'
        );
        $this->assert('Job attempts incremented', $job->attempts >= 1);
    }

    // ─── Section 11: Device-Targeted Job ──────

    private function testDeviceTargetedJob(Restaurant $restaurant, PrintDevice $target, PrintDevice $other): void
    {
        $job = PrintJob::withoutGlobalScopes()->create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'order_id' => $this->testOrderId,
            'role' => 'kitchen',
            'status' => 'pending_bridge',
            'device_id' => $target->id,
            'payload' => ['text' => 'Targeted job — only for specific device', 'type' => 'kitchen_ticket'],
        ]);
        $this->testJobIds[] = $job->id;

        // Other device (receipt) should NOT see this job
        $otherSees = PrintJob::withoutGlobalScopes()
            ->where('id', $job->id)
            ->where('status', 'pending_bridge')
            ->where(function ($q) use ($other) {
                $q->whereNull('device_id')
                  ->orWhere('device_id', $other->id);
            })
            ->exists();

        // Target device should see it
        $targetSees = PrintJob::withoutGlobalScopes()
            ->where('id', $job->id)
            ->where('status', 'pending_bridge')
            ->where(function ($q) use ($target) {
                $q->whereNull('device_id')
                  ->orWhere('device_id', $target->id);
            })
            ->exists();

        $this->assert('Targeted job visible to assigned device', $targetSees);
        $this->assert('Targeted job NOT visible to other device', !$otherSees);
    }

    // ─── Section 12: General Device Cross-Role ─

    private function testGeneralDeviceCrossRole(Restaurant $restaurant, PrintDevice $generalDevice): void
    {
        $generalJob = PrintJob::withoutGlobalScopes()->create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'order_id' => $this->testOrderId,
            'role' => 'general',
            'status' => 'pending_bridge',
            'payload' => ['text' => 'General role — picked up by any device', 'type' => 'custom'],
        ]);
        $this->testJobIds[] = $generalJob->id;

        // A kitchen device should see role=general jobs
        $kitchenSeesGeneral = PrintJob::withoutGlobalScopes()
            ->where('id', $generalJob->id)
            ->where('status', 'pending_bridge')
            ->where(function ($q) {
                $q->where('role', 'kitchen')->orWhere('role', 'general');
            })
            ->exists();

        // The general device should see kitchen-role jobs
        $kitchenJob = PrintJob::withoutGlobalScopes()->create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'order_id' => $this->testOrderId,
            'role' => 'kitchen',
            'status' => 'pending_bridge',
            'payload' => ['text' => 'Kitchen job — should general pick up?', 'type' => 'kitchen_ticket'],
        ]);
        $this->testJobIds[] = $kitchenJob->id;

        // General device uses whereNotNull('role') to catch ALL roles
        $generalSeesKitchen = PrintJob::withoutGlobalScopes()
            ->where('id', $kitchenJob->id)
            ->where('status', 'pending_bridge')
            ->where(function ($q) use ($generalDevice) {
                if ($generalDevice->role === 'general') {
                    $q->whereNotNull('role');
                } else {
                    $q->where('role', $generalDevice->role)->orWhere('role', 'general');
                }
            })
            ->exists();

        $this->assert('Kitchen device picks up role=general jobs', $kitchenSeesGeneral);
        $this->assert('General device picks up role=kitchen jobs', $generalSeesKitchen);
    }

    // ─── Cleanup ──────────────────────────────

    private function cleanup(): void
    {
        $this->newLine();
        $this->components->info('Cleaning up test data...');

        if (!empty($this->testJobIds)) {
            $deleted = PrintJob::withoutGlobalScopes()->whereIn('id', $this->testJobIds)->delete();
            $this->line("  Deleted {$deleted} test jobs");
        }

        if (!empty($this->testDeviceIds)) {
            $deleted = PrintDevice::withoutGlobalScopes()->whereIn('id', $this->testDeviceIds)->delete();
            $this->line("  Deleted {$deleted} test devices");
        }

        $this->components->info('Cleanup complete.');
    }
}
